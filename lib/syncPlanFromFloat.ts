import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { FLOAT_HOURS_BATCH_SIZE } from "@/lib/floatImportApply";
import {
  createProjectImportMergeState,
  finalizeProjectImportMerge,
  mergeProjectDataFromRun,
} from "@/lib/floatImportUtils";
import { iterateFloatImportRunsAsc } from "@/lib/backfillFloatFromImports";
import { isCompletedWeek } from "@/lib/weekUtils";

export type PlannedHourUpsertRow = {
  projectId: string;
  personId: string;
  weekStartDate: Date;
  hours: number;
};

function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

/** Bulk upsert PlannedHours (same ON CONFLICT shape as FloatScheduledHours batch upsert). */
export async function batchUpsertPlannedHours(
  prisma: PrismaClient,
  rows: PlannedHourUpsertRow[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += FLOAT_HOURS_BATCH_SIZE) {
    const chunk = rows.slice(i, i + FLOAT_HOURS_BATCH_SIZE);
    if (chunk.length === 0) continue;
    await prisma.$executeRaw`
      INSERT INTO "PlannedHours" ("projectId", "personId", "weekStartDate", "hours", "createdAt", "updatedAt")
      VALUES ${Prisma.join(
        chunk.map((r) =>
          Prisma.sql`(${Prisma.join([r.projectId, r.personId, r.weekStartDate, r.hours])}, now(), now())`
        )
      )}
      ON CONFLICT ("projectId", "personId", "weekStartDate")
      DO UPDATE SET hours = EXCLUDED.hours, "updatedAt" = now()
    `;
  }
}

export type SyncPlanFromFloatResult = {
  updated: number;
  message: string;
};

/**
 * Copy Float scheduled hours into PlannedHours for assigned people.
 * Uses DB rows for all weeks; streams import runs only to gap-fill completed weeks.
 */
export async function syncPlannedHoursFromFloat(
  prisma: PrismaClient,
  params: {
    projectId: string;
    projectName: string;
    assignedPersonIds: Set<string>;
    asOf: Date;
  }
): Promise<SyncPlanFromFloatResult> {
  const { projectId, projectName, assignedPersonIds, asOf } = params;

  const floatRows = await prisma.floatScheduledHours.findMany({
    where: { projectId },
    select: { personId: true, weekStartDate: true, hours: true },
  });

  const planHoursByPersonWeek = new Map<string, number>();

  for (const r of floatRows) {
    if (!assignedPersonIds.has(r.personId)) continue;
    const weekKey = r.weekStartDate.toISOString().slice(0, 10);
    planHoursByPersonWeek.set(`${r.personId}|${weekKey}`, roundToQuarter(Number(r.hours)));
  }

  const mergeState = createProjectImportMergeState();
  for await (const run of iterateFloatImportRunsAsc(prisma)) {
    mergeProjectDataFromRun(mergeState, run, projectName);
  }
  const { floatList } = finalizeProjectImportMerge(mergeState);

  if (floatList.length > 0) {
    const people = await prisma.person.findMany({ select: { id: true, name: true } });
    const personIdByLowerName = new Map(
      people.map((p) => [p.name.trim().toLowerCase(), p.id] as const)
    );

    for (const { personName, weeks } of floatList) {
      const personId = personIdByLowerName.get(personName.trim().toLowerCase());
      if (!personId || !assignedPersonIds.has(personId)) continue;
      for (const { weekStart, hours } of weeks ?? []) {
        if (hours == null || hours === undefined) continue;
        const weekStartDate = new Date(weekStart + "T00:00:00.000Z");
        if (!isCompletedWeek(weekStartDate, asOf)) continue;
        const weekKey = weekStart.slice(0, 10);
        const key = `${personId}|${weekKey}`;
        if (!planHoursByPersonWeek.has(key)) {
          planHoursByPersonWeek.set(key, roundToQuarter(hours));
        }
      }
    }
  }

  const entries = Array.from(planHoursByPersonWeek.entries());
  if (entries.length === 0) {
    return {
      updated: 0,
      message:
        "No Float scheduled hours for this project (run Admin Float sync or Backfill, and check assignments). Nothing to sync.",
    };
  }

  const rows: PlannedHourUpsertRow[] = entries.map(([personWeekKey, hours]) => {
    const [personId, weekKey] = personWeekKey.split("|");
    return {
      projectId,
      personId,
      weekStartDate: new Date(weekKey + "T00:00:00.000Z"),
      hours,
    };
  });

  await batchUpsertPlannedHours(prisma, rows);

  return {
    updated: rows.length,
    message:
      rows.length === 0
        ? "No plan entries updated."
        : `Synced ${rows.length} project plan ${rows.length === 1 ? "entry" : "entries"} from Float scheduled hours.`,
  };
}
