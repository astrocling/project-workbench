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
 * Sync PlannedHours (project plan) from Float scheduled hours in the DB.
 *
 * - **All weeks** that exist in `FloatScheduledHours` for assigned people are copied
 *   into `PlannedHours` (current, future, and past). That fixes cases like Planned still
 *   at an old value (e.g. 10.5) while the Float column already shows the latest sync (e.g. 7.5).
 * - **Gap fill for completed weeks only:** For past weeks with no Float row in the DB,
 *   stored Float import JSON (`getProjectDataFromAllImports`) is used so revenue recovery
 *   still gets historical hours from exports.
 *
 * **Important:** Past `FloatScheduledHours` rows are **not** updated by Admin Float API sync
 * (only current/future are overwritten). If the Float **product** shows different hours than
 * Workbench’s Float column for a **completed** week, the DB is stale until a **Backfill**
 * or a deliberate data fix; this route cannot invent Float values that were never stored.
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

  /** All person|week keys from FloatScheduledHours (assigned) — every week, not only past. */
  const planHoursByPersonWeek = new Map<string, number>();

  for (const r of floatRows) {
    if (!assignedPersonIds.has(r.personId)) continue;
    const weekKey = r.weekStartDate.toISOString().slice(0, 10);
    planHoursByPersonWeek.set(`${r.personId}|${weekKey}`, roundToQuarter(Number(r.hours)));
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
      if (!planHoursByPersonWeek.has(key)) {
        planHoursByPersonWeek.set(key, roundToQuarter(hours));
      }
    }
  }

  const entries = Array.from(planHoursByPersonWeek.entries());
  if (entries.length === 0) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      message:
        "No Float scheduled hours for this project (run Admin Float sync or Backfill, and check assignments). Nothing to sync.",
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

  revalidateTag("portfolio-metrics", "max");
  revalidateTag("project-budget", "max");
  revalidateTag("project-revenue", "max");
  revalidateTag(`project-resourcing:${id}`, "max");

  return NextResponse.json({
    ok: true,
    updated,
    message:
      updated === 0
        ? "No plan entries updated."
        : `Synced ${updated} project plan ${updated === 1 ? "entry" : "entries"} from Float scheduled hours.`,
  });
}
