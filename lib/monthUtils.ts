/**
 * Month range utilities for CDA and other monthly views.
 */

/**
 * Returns calendar months from start through end (inclusive).
 * Uses UTC so that stored dates like 2025-08-01T00:00:00.000Z
 * are treated as August 2025 regardless of server timezone.
 * monthKey: YYYY-MM for storage. label: MM/YYYY for display.
 */
export function getMonthsInRange(
  start: Date,
  end: Date
): { monthKey: string; label: string }[] {
  const result: { monthKey: string; label: string }[] = [];
  const current = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
  );
  const endMonth = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)
  );

  while (current <= endMonth) {
    const y = current.getUTCFullYear();
    const m = current.getUTCMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = `${String(m + 1).padStart(2, "0")}/${y}`;
    result.push({ monthKey, label });
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return result;
}

/**
 * Returns the 1 or 2 month keys (YYYY-MM) that a week spans.
 * Week = Monday (weekStartDate) through Sunday (+6 days). Uses UTC.
 * If the week is entirely in one calendar month, returns [monthKey].
 * If the week spans two months (e.g. Mon Dec 30–Sun Jan 5), returns [monthKey1, monthKey2] in chronological order.
 */
export function getMonthKeysForWeek(weekStartDate: Date): string[] {
  const monday = new Date(weekStartDate);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const y1 = monday.getUTCFullYear();
  const m1 = monday.getUTCMonth();
  const y2 = sunday.getUTCFullYear();
  const m2 = sunday.getUTCMonth();
  const monthKey1 = `${y1}-${String(m1 + 1).padStart(2, "0")}`;
  if (y1 === y2 && m1 === m2) return [monthKey1];
  const monthKey2 = `${y2}-${String(m2 + 1).padStart(2, "0")}`;
  return [monthKey1, monthKey2];
}
