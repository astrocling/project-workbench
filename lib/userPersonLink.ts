import type { Prisma } from "@prisma/client";

/**
 * Clears this user's Person link and/or sets `userId` on the given Person row.
 * Caller is responsible for any business rules (e.g. self-service: target Person must be unlinked or already this user).
 */
export async function applyUserPersonLinkInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  personId: string | null | undefined
): Promise<void> {
  if (personId === null || personId === undefined || String(personId).trim() === "") {
    await tx.person.updateMany({
      where: { userId },
      data: { userId: null },
    });
    return;
  }

  const linkedPersonId = String(personId).trim();
  await tx.person.updateMany({
    where: { userId },
    data: { userId: null },
  });
  await tx.person.updateMany({
    where: { id: linkedPersonId },
    data: { userId },
  });
}
