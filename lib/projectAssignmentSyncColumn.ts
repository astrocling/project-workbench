import type { PrismaClient } from "@prisma/client";

/**
 * Whether `ProjectAssignment.syncRoleFromFloat` exists in the connected database.
 * Cached for the process so Float sync / assignments routes don't assume migrations ran
 * (e.g. `.env.local` points at a different DB than `prisma migrate`).
 */
let cachedSyncRoleFromFloatExists: boolean | null = null;

export function resetProjectAssignmentSyncRoleColumnCache(): void {
  cachedSyncRoleFromFloatExists = null;
}

export async function projectAssignmentHasSyncRoleFromFloatColumn(
  prisma: PrismaClient
): Promise<boolean> {
  if (cachedSyncRoleFromFloatExists !== null) {
    return cachedSyncRoleFromFloatExists;
  }
  const rows = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'ProjectAssignment'
        AND column_name = 'syncRoleFromFloat'
    ) AS "exists"
  `;
  cachedSyncRoleFromFloatExists = Boolean(rows[0]?.exists);
  return cachedSyncRoleFromFloatExists;
}
