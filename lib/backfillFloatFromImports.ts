/**
 * Restore `FloatScheduledHours` from stored `FloatImportRun` JSON (same merge rules as per-project backfill).
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { FLOAT_HOURS_BATCH_SIZE } from "@/lib/floatImportApply";
import {
  createProjectImportMergeState,
  finalizeProjectImportMerge,
  getProjectDataFromImport,
  mergeFloatHoursForProjectsFromRuns,
  mergeProjectDataFromRun,
  normalizeProjectNameForLookup,
  type FloatImportRunWithDate,
} from "@/lib/floatImportUtils";

const floatImportRunSelect = {
  completedAt: true,
  projectNames: true,
  projectAssignments: true,
  projectFloatHours: true,
} as const;

export async function loadFloatImportRunsForBackfill(prisma: PrismaClient) {
  return prisma.floatImportRun.findMany({
    orderBy: { completedAt: "asc" },
    select: floatImportRunSelect,
  });
}

/** Collect distinct Float project names from import runs without loading full hour JSON. */
export async function loadAvailableFloatProjectNamesFromRuns(
  prisma: PrismaClient
): Promise<string[]> {
  const names = new Set<string>();
  for await (const run of iterateFloatImportRunsAsc(prisma)) {
    for (const name of (run.projectNames as string[] | undefined) ?? []) {
      if (name?.trim()) names.add(name);
    }
  }
  return Array.from(names);
}

/** Names that have stored float hour JSON in at least one import run. */
export async function loadAvailableFloatProjectNamesWithHoursFromRuns(
  prisma: PrismaClient
): Promise<string[]> {
  const names = new Set<string>();
  for await (const run of iterateFloatImportRunsAsc(prisma)) {
    const hours = run.projectFloatHours as Record<string, unknown[]> | undefined;
    if (!hours) continue;
    for (const key of Object.keys(hours)) {
      const list = hours[key];
      if (Array.isArray(list) && list.length > 0) names.add(key);
    }
  }
  return Array.from(names);
}

export type FloatBackfillDiagnostics = {
  lookupName: string;
  normalizedLookupName: string;
  importRunCount: number;
  runsWithNameMatch: number;
  runsWithFloatHours: number;
  runsWithAssignmentsOnly: number;
  mergedPersonCount: number;
  mergedWeekCount: number;
  lastMatchedKey: string | null;
};

/** Four-digit years extracted from a project name (e.g. 2025, 2026). */
export function extractYearTokensFromProjectName(name: string): Set<string> {
  const matches = normalizeProjectNameForLookup(name).match(/\b20\d{2}\b/g);
  return new Set(matches ?? []);
}

/** True when both names carry year tokens and they refer to different ranges. */
export function projectNamesHaveDistinctYearRanges(a: string, b: string): boolean {
  const yearsA = extractYearTokensFromProjectName(a);
  const yearsB = extractYearTokensFromProjectName(b);
  if (yearsA.size === 0 || yearsB.size === 0) return false;
  const keyA = [...yearsA].sort().join(",");
  const keyB = [...yearsB].sort().join(",");
  return keyA !== keyB;
}

/** Score Float import keys by normalized overlap with the lookup name. */
export function scoreCloseFloatProjectNames(
  lookupName: string,
  available: string[]
): Array<{ name: string; score: number }> {
  const norm = normalizeProjectNameForLookup(lookupName);
  if (!norm) return [];
  const tokens = norm.split(" ").filter((t) => t.length > 2);
  return available
    .map((name) => {
      if (projectNamesHaveDistinctYearRanges(lookupName, name)) {
        return { name, score: 0 };
      }
      const nn = normalizeProjectNameForLookup(name);
      let score = 0;
      if (nn === norm) score += 100;
      if (nn.includes(norm) || norm.includes(nn)) score += 50;
      for (const token of tokens) {
        if (nn.includes(token)) score += 10;
      }
      return { name, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Suggest Float import keys whose normalized name overlaps the lookup name. */
export function suggestCloseFloatProjectNames(
  lookupName: string,
  available: string[],
  limit = 5
): string[] {
  return scoreCloseFloatProjectNames(lookupName, available)
    .slice(0, limit)
    .map((x) => x.name);
}

/** Stream import runs one at a time to avoid loading all JSON blobs into memory at once. */
export async function* iterateFloatImportRunsAsc(
  prisma: PrismaClient
): AsyncGenerator<FloatImportRunWithDate & { id: string }> {
  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.floatImportRun.findMany({
      take: 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { completedAt: "asc" },
      select: { id: true, ...floatImportRunSelect },
    });
    if (batch.length === 0) break;
    const run = batch[0];
    yield run;
    cursor = run.id;
  }
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
 * Upsert scheduled hours for one project by streaming import runs (memory-safe for production).
 * Semantics match {@link backfillFloatScheduledHoursForProjectFromRuns}.
 */
export async function backfillFloatScheduledHoursForProjectStreaming(
  prisma: PrismaClient,
  params: {
    projectId: string;
    projectName: string;
    personIdByLowerName?: Map<string, string>;
  }
): Promise<
  BackfillFloatFromImportsResult & {
    importRunCount: number;
    diagnostics: FloatBackfillDiagnostics;
  }
> {
  const lookupName = params.projectName.trim();
  const normalizedLookupName = normalizeProjectNameForLookup(lookupName);
  const mergeState = createProjectImportMergeState();
  let importRunCount = 0;
  let runsWithNameMatch = 0;
  let runsWithFloatHours = 0;
  let runsWithAssignmentsOnly = 0;
  let lastMatchedKey: string | null = null;

  for await (const run of iterateFloatImportRunsAsc(prisma)) {
    const preview = getProjectDataFromImport(run, lookupName);
    if (preview.matchedKey) {
      runsWithNameMatch += 1;
      lastMatchedKey = preview.matchedKey;
      if (preview.floatList.length > 0) runsWithFloatHours += 1;
      else if (preview.assignmentsList.length > 0) runsWithAssignmentsOnly += 1;
    }
    mergeProjectDataFromRun(mergeState, run, lookupName);
    importRunCount += 1;
  }

  const { floatList } = finalizeProjectImportMerge(mergeState);
  const mergedPersonCount = floatList.length;
  const mergedWeekCount = floatList.reduce(
    (sum, item) => sum + (item.weeks?.length ?? 0),
    0
  );
  const diagnostics: FloatBackfillDiagnostics = {
    lookupName,
    normalizedLookupName,
    importRunCount,
    runsWithNameMatch,
    runsWithFloatHours,
    runsWithAssignmentsOnly,
    mergedPersonCount,
    mergedWeekCount,
    lastMatchedKey,
  };

  if (floatList.length === 0) {
    return { upserted: 0, hadImportData: false, importRunCount, diagnostics };
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

  return {
    upserted: rows.length,
    hadImportData: true,
    importRunCount,
    diagnostics,
  };
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
