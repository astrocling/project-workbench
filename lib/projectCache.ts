/**
 * Cached project lookup so generateMetadata and the page can share one query.
 */

import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { IMMEDIATE_EXPIRATION } from "@/lib/cacheProfiles";

export const PROJECT_DETAIL_TAG = "project-detail";

const PROJECT_DETAIL_INCLUDE = {
  assignments: { include: { person: true, role: true } },
  projectRoleRates: { include: { role: true } },
  projectKeyRoles: { include: { person: true } },
  budgetLines: true,
  plannedHours: true,
  actualHours: true,
  account: {
    select: {
      id: true,
      industryGroup: { select: { id: true, name: true, archivedAt: true } },
    },
  },
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
    [PROJECT_DETAIL_TAG, slugOrId],
    { revalidate: 30, tags: [PROJECT_DETAIL_TAG] }
  )();
}

/**
 * Invalidates the cached project detail payload after a mutation. Uses immediate expiration
 * rather than the `"max"` stale-while-revalidate profile: clients re-read these server props
 * right after the response (Settings calls `router.refresh()`), and a deleted or just-edited
 * project must not be served from cache. `updateTag` is not an option — it is Server-Action only.
 *
 * The tag is global, so every project's cached detail payload expires and the next read of each
 * costs one DB round-trip. That was already the shape of the `"max"` call (all entries were
 * marked stale, then revalidated on read); the change is that reads now block instead of being
 * served stale. Callers on hot paths (`actual-hours`) pay that cost for correctness.
 */
export function revalidateProjectDetail() {
  revalidateTag(PROJECT_DETAIL_TAG, IMMEDIATE_EXPIRATION);
}
