/**
 * Snapshot window for resourcing requests / fulfill variance (UTC date keys, plain Date math).
 */

/** UTC calendar date key YYYY-MM-DD from a Date (use for comparisons with @db.Date fields). */
export function utcDateKey(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

/** Monday 00:00:00 UTC on or before "today" UTC. */
export function mondayOnOrBeforeTodayUTC(): Date {
  const now = new Date();
  const x = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = x.getUTCDay();
  const daysFromMonday = (dow + 6) % 7;
  x.setUTCDate(x.getUTCDate() - daysFromMonday);
  return x;
}

export function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function minDateKey(a: string, b: string): string {
  return a <= b ? a : b;
}

/**
 * Inclusive end date key: min(snapshotMonday + 84 calendar days, project.endDate).
 * When project has no end date, uses snapshotMonday + 84 days only.
 */
export function computeSnapshotWindowEndKey(
  snapshotMondayUtc: Date,
  projectEndDate: Date | null
): string {
  const plus84Key = utcDateKey(addUtcDays(snapshotMondayUtc, 84));
  if (!projectEndDate) return plus84Key;
  const endKey = utcDateKey(new Date(projectEndDate));
  return minDateKey(plus84Key, endKey);
}

export function dateKeyToUtcStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
