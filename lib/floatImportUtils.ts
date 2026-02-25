/**
 * Helpers for reading Float import data and matching project names so that
 * project create and backfill-float use the same logic and find data reliably.
 */

/**
 * Normalize project name for matching: trim, lowercase, treat hyphens/punctuation as spaces,
 * collapse spaces. So "UFC - Decouple Phase 2" and "UFC Decouple Phase 2" both match.
 */
export function normalizeProjectNameForLookup(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\-_–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type AssignmentItem = { personName: string; roleName: string };
type FloatHourItem = {
  personName: string;
  roleName: string;
  weeks: Array<{ weekStart: string; hours: number }>;
};

/** Accepts Prisma FloatImportRun (JSON columns are JsonValue) or similar. */
type FloatImportRunLike = {
  projectNames?: unknown;
  projectAssignments?: unknown;
  projectFloatHours?: unknown;
};

/** Run with completedAt for merging (latest run wins per week). */
export type FloatImportRunWithDate = FloatImportRunLike & { completedAt: Date };

export function getProjectDataFromImport(
  lastImport: FloatImportRunLike | null | undefined,
  projectName: string
): {
  assignmentsList: AssignmentItem[];
  floatList: FloatHourItem[];
  matchedKey: string | null;
} {
  const assignmentsList: AssignmentItem[] = [];
  const floatList: FloatHourItem[] = [];
  let matchedKey: string | null = null;

  if (!lastImport || !projectName?.trim()) {
    return { assignmentsList, floatList, matchedKey };
  }

  const normalized = normalizeProjectNameForLookup(projectName);
  const assignments =
    (lastImport.projectAssignments as Record<string, AssignmentItem[]> | undefined) ?? {};
  const projectFloatHours =
    (lastImport.projectFloatHours as Record<string, FloatHourItem[]> | undefined) ?? {};
  const projectNames = (lastImport.projectNames as string[] | undefined) ?? [];

  // Prefer matching against projectNames (same source as the dropdown) so we use the exact key
  // that was stored; fall back to matching keys in the record objects.
  for (const key of projectNames) {
    if (normalizeProjectNameForLookup(key) === normalized) {
      matchedKey = key;
      break;
    }
  }
  if (!matchedKey) {
    const allKeys = new Set([
      ...Object.keys(assignments),
      ...Object.keys(projectFloatHours),
    ]);
    for (const key of allKeys) {
      if (normalizeProjectNameForLookup(key) === normalized) {
        matchedKey = key;
        break;
      }
    }
  }

  if (matchedKey) {
    if (Array.isArray(assignments[matchedKey])) {
      assignmentsList.push(...assignments[matchedKey]);
    }
    if (Array.isArray(projectFloatHours[matchedKey])) {
      floatList.push(...projectFloatHours[matchedKey]);
    }
  }

  return { assignmentsList, floatList, matchedKey };
}

/**
 * Merge project data from multiple Float import runs (e.g. all runs ordered by completedAt asc).
 * Assignments: union of all runs, dedupe by person; role "last run wins".
 * Float hours: for each (personName, weekStart), keep the value from the run with the latest completedAt.
 * Use for project create and backfill-float so projects get full history across 12-month exports.
 */
export function getProjectDataFromAllImports(
  runs: FloatImportRunWithDate[],
  projectName: string
): {
  assignmentsList: AssignmentItem[];
  floatList: FloatHourItem[];
  matchedKey: string | null;
} {
  const assignmentsByPerson = new Map<string, AssignmentItem>(); // key: personName lowercase
  const hoursByPerson = new Map<
    string,
    { personName: string; weekMap: Map<string, number> }
  >(); // personKey -> { personName (last seen), weekMap }
  let matchedKey: string | null = null;

  if (!projectName?.trim() || runs.length === 0) {
    return { assignmentsList: [], floatList: [], matchedKey: null };
  }

  for (const run of runs) {
    const { assignmentsList, floatList, matchedKey: key } = getProjectDataFromImport(
      run,
      projectName
    );
    if (key) matchedKey = key;

    for (const a of assignmentsList) {
      const k = a.personName.trim().toLowerCase();
      assignmentsByPerson.set(k, { personName: a.personName, roleName: a.roleName });
    }

    for (const item of floatList) {
      const personName = item.personName;
      const personKey = personName.trim().toLowerCase();
      if (!hoursByPerson.has(personKey)) {
        hoursByPerson.set(personKey, { personName, weekMap: new Map() });
      }
      const entry = hoursByPerson.get(personKey)!;
      entry.personName = personName;
      for (const w of item.weeks ?? []) {
        if (w.weekStart != null && w.hours != null) {
          entry.weekMap.set(w.weekStart, w.hours);
        }
      }
    }
  }

  const assignmentsList = Array.from(assignmentsByPerson.values());
  const floatList: FloatHourItem[] = [];
  for (const { personName, weekMap } of hoursByPerson.values()) {
    const weeks = Array.from(weekMap.entries())
      .map(([weekStart, hours]) => ({ weekStart, hours }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    if (weeks.length > 0) {
      floatList.push({ personName, roleName: "", weeks });
    }
  }

  return { assignmentsList, floatList, matchedKey };
}
