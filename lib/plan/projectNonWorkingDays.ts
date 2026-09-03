import type { PrismaClient } from "@prisma/client";
import { PTOHolidayType } from "@prisma/client";
import { expandInclusiveUtcRangeToYmds } from "@/lib/float/excludedDays";

function isWeekendYmd(ymd: string): boolean {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Union of weekends and regional holidays for project assignees in [fromYmd, toYmd].
 */
export async function getProjectNonWorkingDays(
  db: PrismaClient,
  projectId: string,
  fromYmd: string,
  toYmd: string
): Promise<Set<string>> {
  const nonWorking = new Set<string>();

  for (const ymd of expandInclusiveUtcRangeToYmds(fromYmd, toYmd)) {
    if (isWeekendYmd(ymd)) nonWorking.add(ymd);
  }

  const assignments = await db.projectAssignment.findMany({
    where: { projectId },
    select: {
      person: {
        select: {
          id: true,
          floatRegionId: true,
        },
      },
    },
  });

  if (assignments.length === 0) return nonWorking;

  const personRegionById = new Map<string, number | null>();
  for (const assignment of assignments) {
    personRegionById.set(assignment.person.id, assignment.person.floatRegionId);
  }

  const personIds = [...personRegionById.keys()];
  const from = new Date(`${fromYmd}T00:00:00.000Z`);
  const to = new Date(`${toYmd}T00:00:00.000Z`);

  const holidays = await db.pTOHolidayImpact.findMany({
    where: {
      personId: { in: personIds },
      type: PTOHolidayType.Holiday,
      date: { gte: from, lte: to },
    },
    select: {
      personId: true,
      date: true,
      floatRegionId: true,
    },
  });

  for (const holiday of holidays) {
    const personRegion = personRegionById.get(holiday.personId);
    if (personRegion == null) continue;
    if (holiday.floatRegionId != null && holiday.floatRegionId !== personRegion) continue;
    nonWorking.add(holiday.date.toISOString().slice(0, 10));
  }

  return nonWorking;
}
