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
 * Sync ActualHours from Float for completed (past) weeks only.
 * Uses (1) FloatScheduledHours in the DB and (2) stored Float import runs (projectFloatHours)
 * so past weeks are synced even when the import never wrote them to FloatScheduledHours.
 * Default: only writes when ActualHours is null or missing (does not overwrite manual actuals).
 * Optional ?overwrite=true to replace existing actuals with Float values.
 */
export async function POST(
  req: NextRequest,
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

  const overwrite =
    req.nextUrl.searchParams.get("overwrite") === "true" ||
    req.nextUrl.searchParams.get("overwrite") === "1";

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

  // Build (personId, weekKey) -> hours for past weeks. Prefer FloatScheduledHours, then fill from import JSON.
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

  let existingActuals: Map<string, number | null> = new Map();
  if (!overwrite) {
    const weekDates = [...new Set(entries.map(([k]) => k.split("|")[1]))];
    const actualRows = await prisma.actualHours.findMany({
      where: {
        projectId: id,
        weekStartDate: {
          in: weekDates.map((d) => new Date(d + "T00:00:00.000Z")),
        },
      },
      select: { personId: true, weekStartDate: true, hours: true },
    });
    for (const row of actualRows) {
      const key = `${row.personId}|${row.weekStartDate.toISOString().slice(0, 10)}`;
      existingActuals.set(key, row.hours != null ? Number(row.hours) : null);
    }
  }

  let updated = 0;
  for (const [personWeekKey, hours] of entries) {
    const [personId, weekKey] = personWeekKey.split("|");
    if (!overwrite && existingActuals.get(personWeekKey) != null) continue;
    const weekStartDate = new Date(weekKey + "T00:00:00.000Z");
    await prisma.actualHours.upsert({
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

  revalidateTag("portfolio-metrics", "max");
  revalidateTag("project-budget", "max");
  revalidateTag("project-revenue", "max");
  revalidateTag(`project-resourcing:${id}`, "max");

  return NextResponse.json({
    ok: true,
    updated,
    message:
      updated === 0
        ? "No past weeks were updated (existing actuals were kept). Use ?overwrite=true to replace them with Float values."
        : `Synced ${updated} actual hour ${updated === 1 ? "entry" : "entries"} from Float for past weeks.`,
  });
}
