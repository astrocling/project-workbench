import type { PrismaClient } from "@prisma/client";

/**
 * New assignments must use active (non-archived) groups.
 * Existing rows may keep a group that was later archived.
 */
export async function assertIndustryGroupAssignable(
  prisma: PrismaClient,
  nextId: string | null | undefined,
  currentAssignedId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (nextId == null || nextId === "") return { ok: true };
  if (nextId === currentAssignedId) return { ok: true };
  const g = await prisma.industryGroup.findUnique({ where: { id: nextId } });
  if (!g) return { ok: false, message: "Industry group not found" };
  if (g.archivedAt != null) {
    return {
      ok: false,
      message: "Archived industry groups cannot be newly assigned; pick an active group or clear.",
    };
  }
  return { ok: true };
}
