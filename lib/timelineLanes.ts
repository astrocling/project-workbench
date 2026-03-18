/**
 * Assigns non-overlapping "lanes" to timeline bars within a row.
 * Bars that overlap in time get different lane indices so they can be
 * stacked vertically and avoid drawing on top of each other.
 *
 * Currently the Timeline tab and status report timeline use full row height
 * bars with top/bottom padding and do not use lane stacking (overlapping
 * bars overlap visually). This module is kept for potential future use if
 * lane stacking is needed again.
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
