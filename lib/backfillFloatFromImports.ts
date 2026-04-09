/**
 * Restore `FloatScheduledHours` from stored `FloatImportRun` JSON (same merge rules as per-project backfill).
 */

import type { PrismaClient } from "@prisma/client";
import { getProjectDataFromAllImports } from "@/lib/floatImportUtils";

export async function loadFloatImportRunsForBackfill(prisma: PrismaClient) {
  return prisma.floatImportRun.findMany({
    orderBy: { completedAt: "asc" },
    select: {
      completedAt: true,
      projectNames: true,
      projectAssignments: true,
      projectFloatHours: true,
    },
  });
}

export type BackfillFloatFromImportsResult = {
  /** Rows upserted into FloatScheduledHours */
  upserted: number;
  /** false when no merged float list exists for this project name in any run */
  hadImportData: boolean;
};

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
  const { floatList } = getProjectDataFromAllImports(params.runs, params.projectName);
  if (floatList.length === 0) {
    return { upserted: 0, hadImportData: false };
  }

  let map = params.personIdByLowerName;
  if (!map) {
    const people = await prisma.person.findMany({ select: { id: true, name: true } });
    map = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id] as const));
  }

  let upserted = 0;
  for (const { personName, weeks } of floatList) {
    const personId = map.get(personName.trim().toLowerCase());
    if (!personId) continue;
    for (const { weekStart, hours } of weeks) {
      if (hours == null || hours === undefined) continue;
      const weekStartDate = new Date(weekStart + "T00:00:00.000Z");
      await prisma.floatScheduledHours.upsert({
        where: {
          projectId_personId_weekStartDate: {
            projectId: params.projectId,
            personId,
            weekStartDate,
          },
        },
        create: {
          projectId: params.projectId,
          personId,
          weekStartDate,
          hours,
        },
        update: { hours },
      });
      upserted++;
    }
  }

  return { upserted, hadImportData: true };
}
