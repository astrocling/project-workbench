import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { getProjectDataFromAllImports } from "@/lib/floatImportUtils";
import { getAsOfDate, isCompletedWeek } from "@/lib/weekUtils";

function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

/**
 * Sync PlannedHours (project plan) from Float for completed (past) weeks only.
 * Uses FloatScheduledHours and stored Float import runs so past weeks get plan data
 * from the Float Actuals grid. Revenue recovery forecast then uses these values.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const asOf = getAsOfDate();

  const [project, floatRows, allRuns] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        name: true,
        assignments: {
          where: { hiddenFromGrid: false },
          select: { personId: true },
        },
      },
    }),
    prisma.floatScheduledHours.findMany({
      where: { projectId: id },
      select: { personId: true, weekStartDate: true, hours: true },
    }),
    prisma.floatImportRun.findMany({
      orderBy: { completedAt: "asc" },
      select: { completedAt: true, projectNames: true, projectFloatHours: true },
    }),
  ]);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const assignedPersonIds = new Set(project.assignments.map((a) => a.personId));

  const pastHoursByPersonWeek = new Map<string, number>();

  for (const r of floatRows) {
    if (!assignedPersonIds.has(r.personId) || !isCompletedWeek(r.weekStartDate, asOf)) continue;
    const weekKey = r.weekStartDate.toISOString().slice(0, 10);
    pastHoursByPersonWeek.set(`${r.personId}|${weekKey}`, roundToQuarter(Number(r.hours)));
  }

  const { floatList } = getProjectDataFromAllImports(allRuns, project.name);
  for (const { personName, weeks } of floatList) {
    const person = await prisma.person.findFirst({
      where: { name: { equals: personName, mode: "insensitive" } },
    });
    if (!person || !assignedPersonIds.has(person.id)) continue;
    for (const { weekStart, hours } of weeks ?? []) {
      if (hours == null || hours === undefined) continue;
      const weekStartDate = new Date(weekStart + "T00:00:00.000Z");
      if (!isCompletedWeek(weekStartDate, asOf)) continue;
      const weekKey = weekStart.slice(0, 10);
      const key = `${person.id}|${weekKey}`;
      if (!pastHoursByPersonWeek.has(key)) {
        pastHoursByPersonWeek.set(key, roundToQuarter(hours));
      }
    }
  }

  const entries = Array.from(pastHoursByPersonWeek.entries());
  if (entries.length === 0) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      message:
        "No Float data for past weeks on this project (check Float import runs and project name match). Nothing to sync.",
    });
  }

  let updated = 0;
  for (const [personWeekKey, hours] of entries) {
    const [personId, weekKey] = personWeekKey.split("|");
    const weekStartDate = new Date(weekKey + "T00:00:00.000Z");
    await prisma.plannedHours.upsert({
      where: {
        projectId_personId_weekStartDate: {
          projectId: id,
          personId,
          weekStartDate,
        },
      },
      create: {
        projectId: id,
        personId,
        weekStartDate,
        hours,
      },
      update: { hours },
    });
    updated++;
  }

  revalidateTag("portfolio-metrics");
  revalidateTag("project-budget");
  revalidateTag("project-revenue");
  revalidateTag(`project-resourcing:${id}`);

  return NextResponse.json({
    ok: true,
    updated,
    message:
      updated === 0
        ? "No past weeks updated."
        : `Synced ${updated} project plan ${updated === 1 ? "entry" : "entries"} from Float for past weeks.`,
  });
}
