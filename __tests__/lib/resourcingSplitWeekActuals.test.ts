import { describe, it, expect } from "vitest";
import { getAsOfDate, isFutureWeek, isCurrentWeek } from "@/lib/weekUtils";
import { getMonthKeysForWeek, isPastLastUtcDayOfMonthInWeek } from "@/lib/monthUtils";

/**
 * Mirrors ResourcingGrids `actualsSplitCell` editableFirst (excluding canEdit).
 * Current week is "future" relative to asOf (end of previous Sunday) but must still
 * allow the first month sub-cell once that calendar month has ended (UTC).
 */
function editableFirstSplitActual(
  weekDate: Date,
  asOf: Date,
  now: Date,
  monthKeys: [string, string]
): boolean {
  return (
    (!isFutureWeek(weekDate, asOf) || isCurrentWeek(weekDate, now)) &&
    isPastLastUtcDayOfMonthInWeek(weekDate, monthKeys[0]!, now)
  );
}

describe("split-week actuals — first month editable (matches ResourcingGrids)", () => {
  // Mon Mar 30 – Sun Apr 5, 2026 (spans March / April)
  const splitWeekStart = new Date("2026-03-30T00:00:00.000Z");
  const monthKeys = getMonthKeysForWeek(splitWeekStart) as [string, string];

  it("has two month keys for this fixture week", () => {
    expect(monthKeys).toEqual(["2026-03", "2026-04"]);
  });

  it("allows first month on Apr 1 while week is current (March ended in UTC)", () => {
    const now = new Date("2026-04-01T12:00:00.000Z");
    const asOf = getAsOfDate(now);
    expect(isFutureWeek(splitWeekStart, asOf)).toBe(true);
    expect(isCurrentWeek(splitWeekStart, now)).toBe(true);
    expect(isPastLastUtcDayOfMonthInWeek(splitWeekStart, monthKeys[0]!, now)).toBe(true);
    expect(editableFirstSplitActual(splitWeekStart, asOf, now, monthKeys)).toBe(true);
  });

  it("does not allow first month on Mar 31 (still on last UTC day of March in week)", () => {
    const now = new Date("2026-03-31T23:00:00.000Z");
    const asOf = getAsOfDate(now);
    expect(isPastLastUtcDayOfMonthInWeek(splitWeekStart, monthKeys[0]!, now)).toBe(false);
    expect(editableFirstSplitActual(splitWeekStart, asOf, now, monthKeys)).toBe(false);
  });

  it("does not allow first month for a strictly future split week (not current)", () => {
    const now = new Date("2026-04-01T12:00:00.000Z");
    const asOf = getAsOfDate(now);
    // Mon Apr 27 – Sun May 3, 2026 (April / May); starts after current week Mar 30.
    const futureSplitWeekStart = new Date("2026-04-27T00:00:00.000Z");
    const futureKeys = getMonthKeysForWeek(futureSplitWeekStart) as [string, string];
    expect(futureKeys).toEqual(["2026-04", "2026-05"]);
    expect(isFutureWeek(futureSplitWeekStart, asOf)).toBe(true);
    expect(isCurrentWeek(futureSplitWeekStart, now)).toBe(false);
    expect(editableFirstSplitActual(futureSplitWeekStart, asOf, now, futureKeys)).toBe(false);
  });
});
