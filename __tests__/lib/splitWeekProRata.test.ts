import { describe, it, expect } from "vitest";
import {
  allocateProRataHoursForSplitWeek,
  allocateQuartersLargestRemainder,
  getUtcDayCountsForWeek,
  isQuarterHour,
} from "@/lib/splitWeekProRata";

describe("getUtcDayCountsForWeek", () => {
  it("counts seven days in one month for a fully in-month week", () => {
    const monday = new Date("2025-02-17T00:00:00Z");
    expect(getUtcDayCountsForWeek(monday)).toEqual([{ monthKey: "2025-02", days: 7 }]);
  });

  it("counts 2 + 5 days for Dec 30 – Jan 5 week (UTC)", () => {
    const monday = new Date("2024-12-30T00:00:00Z");
    expect(getUtcDayCountsForWeek(monday)).toEqual([
      { monthKey: "2024-12", days: 2 },
      { monthKey: "2025-01", days: 5 },
    ]);
  });
});

describe("allocateQuartersLargestRemainder", () => {
  it("splits 40h into 2:5 day ratio as 11.5 + 28.5 quarters", () => {
    const totalQ = 160;
    const [q1, q2] = allocateQuartersLargestRemainder(totalQ, 2, 5);
    expect(q1 / 4 + q2 / 4).toBe(40);
    expect(q1 / 4).toBe(11.5);
    expect(q2 / 4).toBe(28.5);
  });

  it("preserves small totals", () => {
    const [q1, q2] = allocateQuartersLargestRemainder(1, 2, 5);
    expect(q1 + q2).toBe(1);
    expect(q1 / 4 + q2 / 4).toBe(0.25);
  });
});

describe("allocateProRataHoursForSplitWeek", () => {
  it("returns null for single-month week", () => {
    const monday = new Date("2025-01-06T00:00:00Z");
    expect(allocateProRataHoursForSplitWeek(40, monday)).toBeNull();
  });

  it("allocates 40h across Dec/Jan boundary week", () => {
    const monday = new Date("2024-12-30T00:00:00Z");
    const parts = allocateProRataHoursForSplitWeek(40, monday);
    expect(parts).not.toBeNull();
    expect(parts).toHaveLength(2);
    const sum = parts!.reduce((s, p) => s + p.hours, 0);
    expect(sum).toBe(40);
    expect(parts![0]!.monthKey).toBe("2024-12");
    expect(parts![1]!.monthKey).toBe("2025-01");
    expect(isQuarterHour(parts![0]!.hours)).toBe(true);
    expect(isQuarterHour(parts![1]!.hours)).toBe(true);
  });

  it("handles zero hours", () => {
    const monday = new Date("2024-12-30T00:00:00Z");
    const parts = allocateProRataHoursForSplitWeek(0, monday);
    expect(parts).toEqual([
      { monthKey: "2024-12", hours: 0 },
      { monthKey: "2025-01", hours: 0 },
    ]);
  });
});
