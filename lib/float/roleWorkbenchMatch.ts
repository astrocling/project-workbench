/**
 * Map Float `/v3/roles` labels to Workbench `Role` rows (see `lib/seed.ts` CANONICAL_ROLES).
 */

export type WorkbenchRoleRow = { id: string; name: string };

/**
 * Normalized free-text Float `job_title` → canonical Workbench `Role.name` (see `lib/seed.ts`).
 * Used when assigning project roles from People job title (see `applyFloatImportDatabaseEffects`).
 */
export const FLOAT_JOB_TITLE_ALIASES: Record<string, string> = {
  "senior developer": "Lead Developer",
  "sr developer": "Lead Developer",
  "sr. developer": "Lead Developer",
  "principal developer": "Lead Developer",
  "staff developer": "Lead Developer",
  "senior fe developer": "Senior FE Developer",
  "senior frontend developer": "Senior FE Developer",
  "senior front-end developer": "Senior FE Developer",
  "senior be developer": "Senior BE Developer",
  "senior backend developer": "Senior BE Developer",
  "senior back-end developer": "Senior BE Developer",
  "full stack developer": "FE Developer",
  "fullstack developer": "FE Developer",
  "full-stack developer": "FE Developer",
  "software engineer": "FE Developer",
  "consultant": "Solutions Consultant",
  "senior consultant": "Solutions Consultant",
  "principal consultant": "Solutions Consultant",
  "managing consultant": "Solutions Consultant",
  "data engineer": "Analytics Engineer",
  "bi developer": "Analytics Engineer",
  "reporting analyst": "Analytics Engineer",
  "program manager": "Program Manager",
  "product manager": "Project Manager",
  "scrum master": "Project Manager",
  "ux designer": "UX Lead",
  "ui designer": "Designer",
  "visual designer": "Designer",
  "graphic designer": "Designer",
};

/** Float label (any case) → Workbench role name (exact seed spelling). Extend as needed. */
export const FLOAT_ROLE_NAME_ALIASES: Record<string, string> = {
  pm: "Project Manager",
  pgm: "Program Manager",
  "project manager": "Project Manager",
  "program manager": "Program Manager",
  "analytics engineer": "Analytics Engineer",
  "fe developer": "FE Developer",
  "be developer": "BE Developer",
  "senior fe developer": "Senior FE Developer",
  "senior be developer": "Senior BE Developer",
  "qa engineer": "QA Engineer",
  "ux lead": "UX Lead",
  "cx lead": "CX Lead",
};

/** Prefer this Workbench role when Float has no mappable role for a *new* assignment (not first alphabetically). */
const PREFERRED_FALLBACK_ROLE_NAME = "Solutions Consultant";

export function normalizeFloatRoleName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Build lookup: normalized name → Workbench role id, plus alias keys → id.
 */
export function buildWorkbenchRoleLookup(roles: WorkbenchRoleRow[]): {
  resolveFloatRoleNameToWorkbenchId(floatRoleName: string): string | null;
} {
  const byNorm = new Map<string, string>();
  for (const r of roles) {
    byNorm.set(normalizeFloatRoleName(r.name), r.id);
  }
  for (const [alias, canonical] of Object.entries(FLOAT_ROLE_NAME_ALIASES)) {
    const id = byNorm.get(normalizeFloatRoleName(canonical));
    if (id) {
      byNorm.set(normalizeFloatRoleName(alias), id);
    }
  }

  function resolveFloatRoleNameToWorkbenchId(floatRoleName: string): string | null {
    if (!floatRoleName.trim()) return null;
    const direct = byNorm.get(normalizeFloatRoleName(floatRoleName));
    if (direct) return direct;
    return null;
  }

  return { resolveFloatRoleNameToWorkbenchId };
}

/**
 * Map Float person `job_title` (stored as `Person.floatJobTitle`) to a Workbench `Role` id.
 * Uses normalized exact match on role names plus {@link FLOAT_JOB_TITLE_ALIASES}.
 */
export function resolveJobTitleToWorkbenchId(
  raw: string | null | undefined,
  roles: WorkbenchRoleRow[]
): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const byNorm = new Map<string, string>();
  for (const r of roles) {
    byNorm.set(normalizeFloatRoleName(r.name), r.id);
  }
  for (const [alias, canonical] of Object.entries(FLOAT_JOB_TITLE_ALIASES)) {
    const id = byNorm.get(normalizeFloatRoleName(canonical));
    if (id) {
      byNorm.set(normalizeFloatRoleName(alias), id);
    }
  }
  const n = normalizeFloatRoleName(raw);
  return byNorm.get(n) ?? null;
}

/**
 * Stable default for *new* `(project, person)` rows when Float’s role string does not map.
 * Avoids using the first role alphabetically (often "Analytics Engineer").
 */
export function getFallbackRoleIdForNewAssignment(roles: WorkbenchRoleRow[]): string | undefined {
  if (roles.length === 0) return undefined;
  const preferred = roles.find(
    (r) => normalizeFloatRoleName(r.name) === normalizeFloatRoleName(PREFERRED_FALLBACK_ROLE_NAME)
  );
  if (preferred) return preferred.id;
  const sorted = [...roles].sort((a, b) => a.name.localeCompare(b.name));
  return sorted[sorted.length - 1]?.id;
}

/**
 * Same resolution order as Float import apply for sync-from-Float assignments:
 * job title → Float role label (with aliases) → existing assignment role → fallback for new rows.
 * Use when creating project assignments from Float import JSON without duplicating logic.
 */
export function resolveRoleIdForNewAssignmentFromFloat(params: {
  workbenchRoles: WorkbenchRoleRow[];
  floatRoleName: string;
  floatJobTitle: string | null | undefined;
  /** When the person already has an assignment, keep this role if nothing else resolves (before fallback). */
  existingRoleId?: string | null;
  /**
   * Reuse a resolver from {@link buildWorkbenchRoleLookup} to avoid rebuilding maps per row
   * (e.g. Float import inner loop).
   */
  resolveFloatRoleNameToWorkbenchId?: (floatRoleName: string) => string | null;
  /**
   * Overrides default fallback role id (e.g. `fallbackRoleIdForAssignment` from import apply).
   * When omitted, uses {@link getFallbackRoleIdForNewAssignment}.
   */
  fallbackRoleIdForNew?: string | null;
}): string | undefined {
  const resolveFloat =
    params.resolveFloatRoleNameToWorkbenchId ??
    buildWorkbenchRoleLookup(params.workbenchRoles).resolveFloatRoleNameToWorkbenchId;
  const fromJobTitle = resolveJobTitleToWorkbenchId(params.floatJobTitle, params.workbenchRoles);
  const fromFloatRole = resolveFloat(params.floatRoleName);
  const fallbackForNew =
    params.fallbackRoleIdForNew ?? getFallbackRoleIdForNewAssignment(params.workbenchRoles);

  if (fromJobTitle) return fromJobTitle;
  if (fromFloatRole) return fromFloatRole;
  if (params.existingRoleId) return params.existingRoleId;
  return fallbackForNew;
}
