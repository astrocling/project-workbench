/**
 * Pro-rata allocation of week actual hours across two calendar months (UTC Mon–Sun week).
 * Used for migrating legacy ActualHours rows that have no ActualHoursMonthSplit rows.
 */

import { getMonthKeysForWeek } from "./monthUtils";

const QUARTER_HOUR_EPS = 1e-9;

/** True if n is a multiple of 0.25 (within float tolerance). */
export function isQuarterHour(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 4 - Math.round(n * 4)) < QUARTER_HOUR_EPS;
}

/**
 * Counts how many of the seven UTC calendar days (Mon–Sun) fall in each month key.
 * Sorted by monthKey so order matches chronological order for split weeks.
 */
export function getUtcDayCountsForWeek(weekStartDate: Date): { monthKey: string; days: number }[] {
  const monday = new Date(weekStartDate);
  monday.setUTCHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, days]) => ({ monthKey, days }));
}

/**
 * Splits total quarter-units across two buckets with weights d1/7 and d2/7 using
 * largest-remainder so q1 + q2 === totalQ exactly.
 */
export function allocateQuartersLargestRemainder(totalQ: number, d1: number, d2: number): [number, number] {
  if (!Number.isInteger(totalQ) || totalQ < 0) {
    throw new Error("totalQ must be a non-negative integer (quarter-hour units)");
  }
  if (d1 < 0 || d2 < 0 || d1 + d2 !== 7) {
    throw new Error("d1 and d2 must be non-negative and sum to 7");
  }
  const raw1 = (totalQ * d1) / 7;
  const raw2 = (totalQ * d2) / 7;
  let q1 = Math.floor(raw1);
  let q2 = Math.floor(raw2);
  let rem = totalQ - q1 - q2;
  const frac1 = raw1 - q1;
  const frac2 = raw2 - q2;
  while (rem > 0) {
    if (frac1 >= frac2) {
      q1++;
      rem--;
    } else {
      q2++;
      rem--;
    }
  }
  if (rem !== 0) {
    throw new Error("Internal: quarter allocation remainder should be zero");
  }
  return [q1, q2];
}

/**
 * Pro-rata split of week hours into two months (calendar days in UTC).
 * Returns null if the week does not span two months.
 */
export function allocateProRataHoursForSplitWeek(
  totalHours: number,
  weekStartDate: Date
): { monthKey: string; hours: number }[] | null {
  const monthKeys = getMonthKeysForWeek(weekStartDate);
  if (monthKeys.length !== 2) return null;
  if (!Number.isFinite(totalHours) || totalHours < 0) {
    throw new Error("totalHours must be finite and >= 0");
  }

  const dayCounts = getUtcDayCountsForWeek(weekStartDate);
  if (dayCounts.length !== 2) {
    throw new Error("Expected two month buckets for a split week");
  }

  const [{ monthKey: mk1, days: d1 }, { monthKey: mk2, days: d2 }] = dayCounts;
  if (mk1 !== monthKeys[0] || mk2 !== monthKeys[1]) {
    throw new Error("Day-count month keys do not match getMonthKeysForWeek order");
  }

  const totalQ = Math.round(totalHours * 4);
  const [q1, q2] = allocateQuartersLargestRemainder(totalQ, d1, d2);
  const h1 = q1 / 4;
  const h2 = q2 / 4;

  if (!isQuarterHour(h1) || !isQuarterHour(h2)) {
    throw new Error("Internal: hours must be quarter increments");
  }
  const sum = h1 + h2;
  if (Math.abs(sum - totalHours) > QUARTER_HOUR_EPS) {
    throw new Error("Internal: allocated hours do not sum to total");
  }

  return [
    { monthKey: mk1, hours: h1 },
    { monthKey: mk2, hours: h2 },
  ];
}
