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
