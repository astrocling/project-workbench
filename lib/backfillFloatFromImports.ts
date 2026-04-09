/**
 * Restore `FloatScheduledHours` from stored `FloatImportRun` JSON (same merge rules as per-project backfill).
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { FLOAT_HOURS_BATCH_SIZE } from "@/lib/floatImportApply";
import {
  mergeFloatHoursForProjectsFromRuns,
  type FloatImportRunWithDate,
} from "@/lib/floatImportUtils";

export async function loadFloatImportRunsForBackfill(prisma: PrismaClient) {
  return prisma.floatImportRun.findMany({
    orderBy: { completedAt: "asc" },
    select: {
      completedAt: true,
      projectNames: true,
      projectAssignments: true,
      projectFloatHours: true,
    },
  });
}

export type BackfillFloatFromImportsResult = {
  /** Rows upserted into FloatScheduledHours */
  upserted: number;
  /** false when no merged float list exists for this project name in any run */
  hadImportData: boolean;
};

export type FloatScheduledHourUpsertRow = {
  projectId: string;
  personId: string;
  weekStartDate: Date;
  hours: number;
};

/** Build DB rows from merged float lists (one project or many). */
export function floatScheduledHourRowsFromMergedLists(
  mergedByProjectId: Map<string, Array<{ personName: string; weeks: Array<{ weekStart: string; hours: number }> }>>,
  personIdByLowerName: Map<string, string>
): FloatScheduledHourUpsertRow[] {
  const rows: FloatScheduledHourUpsertRow[] = [];
  for (const [projectId, floatList] of mergedByProjectId) {
    for (const { personName, weeks } of floatList) {
      const personId = personIdByLowerName.get(personName.trim().toLowerCase());
      if (!personId) continue;
      for (const { weekStart, hours } of weeks) {
        if (hours == null || hours === undefined) continue;
        rows.push({
          projectId,
          personId,
          weekStartDate: new Date(weekStart + "T00:00:00.000Z"),
          hours,
        });
      }
    }
  }
  return rows;
}

/**
 * Bulk upsert FloatScheduledHours (same ON CONFLICT shape as {@link applyFloatImportDatabaseEffects}).
 */
export async function batchUpsertFloatScheduledHours(
  prisma: PrismaClient,
  rows: FloatScheduledHourUpsertRow[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += FLOAT_HOURS_BATCH_SIZE) {
    const chunk = rows.slice(i, i + FLOAT_HOURS_BATCH_SIZE);
    if (chunk.length === 0) continue;
    await prisma.$executeRaw`
      INSERT INTO "FloatScheduledHours" ("projectId", "personId", "weekStartDate", "hours", "createdAt", "updatedAt")
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

/**
 * Upsert scheduled hours for one project from merged import history (latest wins per person/week).
 * Matches {@link app/api/projects/[id]/backfill-float/route.ts} behavior.
 */
export async function backfillFloatScheduledHoursForProjectFromRuns(
  prisma: PrismaClient,
  params: {
    projectId: string;
    projectName: string;
    runs: Awaited<ReturnType<typeof loadFloatImportRunsForBackfill>>;
    /** When batching, pass one map for all projects to avoid N queries. */
    personIdByLowerName?: Map<string, string>;
  }
): Promise<BackfillFloatFromImportsResult> {
  const merged = mergeFloatHoursForProjectsFromRuns(
    params.runs as FloatImportRunWithDate[],
    [{ id: params.projectId, name: params.projectName }]
  );
  const floatList = merged.get(params.projectId) ?? [];
  if (floatList.length === 0) {
    return { upserted: 0, hadImportData: false };
  }

  let map = params.personIdByLowerName;
  if (!map) {
    const people = await prisma.person.findMany({ select: { id: true, name: true } });
    map = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id] as const));
  }

  const rows = floatScheduledHourRowsFromMergedLists(
    new Map([[params.projectId, floatList]]),
    map
  );
  await batchUpsertFloatScheduledHours(prisma, rows);

  return { upserted: rows.length, hadImportData: true };
}

export type BackfillAllProjectsStats = {
  upsertsTotal: number;
  projectsWithData: number;
  projectsSkipped: number;
};

/**
 * Restore FloatScheduledHours for every project in one merged pass over runs + batched SQL upserts.
 * Semantics match calling {@link backfillFloatScheduledHoursForProjectFromRuns} per project.
 */
export async function backfillFloatScheduledHoursAllProjectsFromRuns(
  prisma: PrismaClient,
  params: {
    projects: Array<{ id: string; name: string }>;
    runs: Awaited<ReturnType<typeof loadFloatImportRunsForBackfill>>;
    personIdByLowerName: Map<string, string>;
  }
): Promise<BackfillAllProjectsStats> {
  const merged = mergeFloatHoursForProjectsFromRuns(
    params.runs as FloatImportRunWithDate[],
    params.projects
  );

  let projectsWithData = 0;
  let projectsSkipped = 0;
  for (const p of params.projects) {
    const list = merged.get(p.id) ?? [];
    if (list.length === 0) projectsSkipped++;
    else projectsWithData++;
  }

  const rows = floatScheduledHourRowsFromMergedLists(merged, params.personIdByLowerName);
  await batchUpsertFloatScheduledHours(prisma, rows);

  return {
    upsertsTotal: rows.length,
    projectsWithData,
    projectsSkipped,
  };
}
