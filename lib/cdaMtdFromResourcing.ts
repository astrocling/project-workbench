import { getMonthsInRange, getMonthKeysForWeek } from "@/lib/monthUtils";

export function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

/** Minimal shapes for Prisma rows — keeps this module testable without DB. */
export type ActualHoursMonthSplitLike = {
  personId: string;
  weekStartDate: Date;
  monthKey: string;
  hours: unknown;
};

export type ActualHoursLike = {
  personId: string;
  weekStartDate: Date;
  hours: unknown | null;
};

export type CdaMonthLike = {
  monthKey: string;
  planned: unknown;
};

/**
 * Month-key → hours from ActualHoursMonthSplit (split weeks) plus ActualHours rows
 * for weeks that are not split and fall entirely in one calendar month.
 */
export function computeMtdByMonthKey(
  splits: ActualHoursMonthSplitLike[],
  actualHours: ActualHoursLike[]
): Map<string, number> {
  const resourcingByMonth = new Map<string, number>();
  for (const split of splits) {
    const monthKey = split.monthKey;
    const current = resourcingByMonth.get(monthKey) ?? 0;
    resourcingByMonth.set(monthKey, current + Number(split.hours));
  }
  const weekHasSplits = new Set(
    splits.map(
      (s) => `${s.personId}:${(s.weekStartDate as Date).toISOString().slice(0, 10)}`
    )
  );
  for (const ah of actualHours) {
    if (ah.hours == null) continue;
    const weekKey = (ah.weekStartDate as Date).toISOString().slice(0, 10);
    if (weekHasSplits.has(`${ah.personId}:${weekKey}`)) continue;
    const monthKeys = getMonthKeysForWeek(ah.weekStartDate as Date);
    if (monthKeys.length === 1) {
      const monthKey = monthKeys[0]!;
      const current = resourcingByMonth.get(monthKey) ?? 0;
      resourcingByMonth.set(monthKey, current + Number(ah.hours));
    }
  }
  return resourcingByMonth;
}

export function buildCdaRowsForProject(input: {
  startDate: Date;
  endDate: Date | null;
  cdaMonths: CdaMonthLike[];
  actualHours: ActualHoursLike[];
  actualHoursMonthSplits: ActualHoursMonthSplitLike[];
}): Array<{
  monthKey: string;
  monthLabel: string;
  planned: number;
  mtdActuals: number;
}> {
  const end = input.endDate ?? new Date();
  const months = getMonthsInRange(input.startDate, end);
  const byKey = new Map(
    input.cdaMonths.map((m) => [m.monthKey, { planned: Number(m.planned) }])
  );
  const resourcingByMonth = computeMtdByMonthKey(
    input.actualHoursMonthSplits,
    input.actualHours
  );

  return months.map(({ monthKey, label }) => {
    const data = byKey.get(monthKey);
    const raw = resourcingByMonth.get(monthKey) ?? 0;
    return {
      monthKey,
      monthLabel: label,
      planned: data != null ? Number(data.planned) : 0,
      mtdActuals: roundToQuarter(raw),
    };
  });
}
