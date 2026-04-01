import { describe, it, expect } from "vitest";
import { computeCdaProjections, roundToQuarter } from "@/lib/cdaCalculations";

describe("roundToQuarter (cdaCalculations)", () => {
  it("rounds to nearest quarter hour", () => {
    expect(roundToQuarter(1.13)).toBe(1.25);
    expect(roundToQuarter(10)).toBe(10);
  });
});

describe("computeCdaProjections", () => {
  it("computes mid-contract surplus and avg per future month", () => {
    const rows = [
      { monthKey: "2025-01", monthLabel: "", planned: 200, mtdActuals: 200 },
      { monthKey: "2025-02", monthLabel: "", planned: 200, mtdActuals: 200 },
      { monthKey: "2025-03", monthLabel: "", planned: 100, mtdActuals: 40 },
      { monthKey: "2025-04", monthLabel: "", planned: 200, mtdActuals: 0 },
      { monthKey: "2025-05", monthLabel: "", planned: 200, mtdActuals: 0 },
    ];
    const p = computeCdaProjections({
      contractHoursHigh: 1000,
      rows,
      currentMonthKey: "2025-03",
    });
    expect(p.burnedPrior).toBe(400);
    expect(p.plannedCurrent).toBe(100);
    expect(p.plannedFuture).toBe(400);
    expect(p.projectedTotalBurn).toBe(900);
    expect(p.expectedSurplusEnd).toBe(100);
    expect(p.remainingAfterPrior).toBe(600);
    expect(p.poolForFutureMonths).toBe(500);
    expect(p.futureMonthCount).toBe(2);
    expect(p.hoursPerFutureMonth).toBe(250);
  });

  it("returns null hours per future month on last contract month", () => {
    const rows = [
      { monthKey: "2025-01", monthLabel: "", planned: 100, mtdActuals: 100 },
      { monthKey: "2025-02", monthLabel: "", planned: 80, mtdActuals: 80 },
    ];
    const p = computeCdaProjections({
      contractHoursHigh: 200,
      rows,
      currentMonthKey: "2025-02",
    });
    expect(p.futureMonthCount).toBe(0);
    expect(p.hoursPerFutureMonth).toBeNull();
    expect(p.plannedFuture).toBe(0);
    expect(p.expectedSurplusEnd).toBe(20);
  });

  it("treats missing current month row as zero planned current", () => {
    const rows = [
      { monthKey: "2025-01", monthLabel: "", planned: 100, mtdActuals: 100 },
      { monthKey: "2025-02", monthLabel: "", planned: 100, mtdActuals: 100 },
    ];
    const p = computeCdaProjections({
      contractHoursHigh: 500,
      rows,
      currentMonthKey: "2025-03",
    });
    expect(p.plannedCurrent).toBe(0);
    expect(p.burnedPrior).toBe(200);
    expect(p.plannedFuture).toBe(0);
    expect(p.expectedSurplusEnd).toBe(300);
  });

  it("projects deficit when burn exceeds budget", () => {
    const rows = [
      { monthKey: "2025-01", monthLabel: "", planned: 200, mtdActuals: 200 },
      { monthKey: "2025-02", monthLabel: "", planned: 200, mtdActuals: 200 },
      { monthKey: "2025-03", monthLabel: "", planned: 500, mtdActuals: 0 },
    ];
    const p = computeCdaProjections({
      contractHoursHigh: 800,
      rows,
      currentMonthKey: "2025-03",
    });
    expect(p.projectedTotalBurn).toBe(900);
    expect(p.expectedSurplusEnd).toBe(-100);
  });

  it("ignores current month MTD for projected total burn", () => {
    const rows = [
      { monthKey: "2025-03", monthLabel: "", planned: 100, mtdActuals: 999 },
    ];
    const p = computeCdaProjections({
      contractHoursHigh: 500,
      rows,
      currentMonthKey: "2025-03",
    });
    expect(p.projectedTotalBurn).toBe(100);
    expect(p.expectedSurplusEnd).toBe(400);
  });

  it("handles empty rows", () => {
    const p = computeCdaProjections({
      contractHoursHigh: 100,
      rows: [],
      currentMonthKey: "2025-06",
    });
    expect(p.expectedSurplusEnd).toBe(100);
    expect(p.hoursPerFutureMonth).toBeNull();
    expect(p.futureMonthCount).toBe(0);
  });
});
