/**
 * Guards for the Plan grid's `<input type="date">` cells. A native date input reports a value on
 * every keystroke: empty while a segment is incomplete, and years like `0002` while the year is
 * typed digit by digit. Saving those would PATCH and refetch the plan on each keystroke, so a
 * date is only committed once it is a complete, plausible calendar date.
 */

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

export function isCommittablePlanDate(value: string): boolean {
  if (!YMD_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  // Round-trips only for real calendar days, so 2026-02-30 and 2026-13-01 are rejected.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The date to save for an edited cell, or null when the input should be left alone. */
export function resolvePlanDateCommit(nextValue: string, currentValue: string): string | null {
  if (!isCommittablePlanDate(nextValue) || nextValue === currentValue) return null;
  return nextValue;
}
