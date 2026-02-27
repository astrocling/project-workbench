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
