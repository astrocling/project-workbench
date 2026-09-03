import { prisma } from "@/lib/prisma";

export async function touchPlan(planId: string, userId: string | undefined) {
  await prisma.projectPlan.update({
    where: { id: planId },
    data: {
      updatedByUserId: userId ?? null,
    },
  });
}
