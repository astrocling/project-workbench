/**
 * Assigns non-overlapping "lanes" to timeline bars within a row.
 * Bars that overlap in time get different lane indices so they can be
 * stacked vertically and avoid drawing on top of each other.
 *
 * Used by:
 * - Timeline tab: full project range; pass bars as-is.
 * - Status report (HTML + PDF): timeline shows a shortened "previous months"
 *   range. Callers must pass **visible segments only** (each bar clipped to
 *   the visible start/end). That way lanes reflect overlap in the visible
 *   window and bars do not overlap. See getVisibleBarSegments() in
 *   StatusReportView.tsx and StatusReportDocument.tsx.
 */
export function assignLanes<T extends { startDate: string; endDate: string }>(
  bars: T[]
): number[] {
  if (bars.length === 0) return [];
  const indexed = bars.map((bar, i) => ({ bar, i }));
  indexed.sort(
    (a, b) =>
      a.bar.startDate.localeCompare(b.bar.startDate) ||
      a.bar.endDate.localeCompare(b.bar.endDate)
  );
  const laneEndMs: number[] = [];
  const laneByIndex: number[] = new Array(bars.length);
  for (const { bar, i } of indexed) {
    const startMs = new Date(bar.startDate).getTime();
    const endMs = new Date(bar.endDate).getTime();
    let lane = 0;
    while (lane < laneEndMs.length && laneEndMs[lane]! > startMs) lane++;
    if (lane === laneEndMs.length) laneEndMs.push(endMs);
    else laneEndMs[lane] = endMs;
    laneByIndex[i] = lane;
  }
  return laneByIndex;
}
