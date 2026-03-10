/**
 * Cached project lookup so generateMetadata and the page can share one query.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const PROJECT_DETAIL_INCLUDE = {
  assignments: { include: { person: true, role: true } },
  projectRoleRates: { include: { role: true } },
  projectKeyRoles: { include: { person: true } },
  budgetLines: true,
  plannedHours: true,
  actualHours: true,
} as const;

export type CachedProject = Awaited<ReturnType<typeof getCachedProjectBySlugOrId>>;

/**
 * Returns project by slug or id (for CUID redirects). Cached 30s so metadata and page share one DB round-trip.
 */
export function getCachedProjectBySlugOrId(slugOrId: string) {
  return unstable_cache(
    async () => {
      return prisma.project.findFirst({
        where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
        include: PROJECT_DETAIL_INCLUDE,
      });
    },
    ["project-detail", slugOrId],
    { revalidate: 30 }
  )();
}
