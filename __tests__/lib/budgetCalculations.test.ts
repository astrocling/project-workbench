import { describe, it, expect } from "vitest";
import {
  computeBudgetRollups,
  weeklyUtilization,
  hasPlanningMismatch,
  hasMissingActuals,
} from "@/lib/budgetCalculations";

describe("computeBudgetRollups", () => {
  it("sums planned and actual hours over completed weeks only", () => {
    const projectStart = new Date("2025-02-03");
    const projectEnd = new Date("2025-03-31");
    const asOf = new Date("2025-02-16T23:59:59Z"); // completed: 02-03, 02-10

    const weeklyRows = [
      { weekStartDate: new Date("2025-02-03"), plannedHours: 40, actualHours: 38, rate: 150 },
      { weekStartDate: new Date("2025-02-10"), plannedHours: 40, actualHours: 42, rate: 150 },
      { weekStartDate: new Date("2025-02-17"), plannedHours: 40, actualHours: null, rate: 150 },
    ];

    const budgetLines = [
      { lowHours: 160, highHours: 200, lowDollars: 24000, highDollars: 30000 },
    ];

    const result = computeBudgetRollups(
      projectStart,
      projectEnd,
      weeklyRows,
      budgetLines,
      asOf
    );

    expect(result.plannedHoursToDate).toBe(80);
    expect(result.actualHoursToDate).toBe(80);
    expect(result.actualDollarsToDate).toBe(80 * 150);
    expect(result.forecastHours).toBe(80 + 40); // actuals + planned future
    expect(result.forecastDollars).toBe(80 * 150 + 40 * 150);
    // Current week is 2025-02-17 (one row), no future weeks
    expect(result.projectedCurrentWeekHours).toBe(40);
    expect(result.projectedCurrentWeekDollars).toBe(40 * 150);
    expect(result.projectedFutureWeeksHours).toBe(0);
    expect(result.projectedFutureWeeksDollars).toBe(0);
    expect(result.forecastHours).toBe(
      result.actualHoursToDate + result.projectedCurrentWeekHours + result.projectedFutureWeeksHours
    );
    expect(result.forecastDollars).toBe(
      result.actualDollarsToDate +
        result.projectedCurrentWeekDollars +
        result.projectedFutureWeeksDollars
    );
  });

  it("splits projected into current week and future weeks", () => {
    const projectStart = new Date("2025-02-03");
    const projectEnd = new Date("2025-03-31");
    const asOf = new Date("2025-02-16T23:59:59Z"); // completed: 02-03, 02-10. Current: 02-17, future: 02-24, 03-03, ...

    const weeklyRows = [
      { weekStartDate: new Date("2025-02-03"), plannedHours: 40, actualHours: 40, rate: 100 },
      { weekStartDate: new Date("2025-02-10"), plannedHours: 40, actualHours: 40, rate: 100 },
      { weekStartDate: new Date("2025-02-17"), plannedHours: 30, actualHours: null, rate: 100 },
      { weekStartDate: new Date("2025-02-24"), plannedHours: 40, actualHours: null, rate: 100 },
      { weekStartDate: new Date("2025-03-03"), plannedHours: 40, actualHours: null, rate: 100 },
    ];

    const result = computeBudgetRollups(
      projectStart,
      projectEnd,
      weeklyRows,
      [{ lowHours: 500, highHours: 500, lowDollars: 50000, highDollars: 50000 }],
      asOf
    );

    expect(result.actualHoursToDate).toBe(80);
    expect(result.projectedCurrentWeekHours).toBe(30);
    expect(result.projectedFutureWeeksHours).toBe(80);
    expect(result.forecastHours).toBe(80 + 30 + 80);
    expect(result.forecastHours).toBe(
      result.actualHoursToDate + result.projectedCurrentWeekHours + result.projectedFutureWeeksHours
    );
    expect(result.forecastDollars).toBe(
      result.actualDollarsToDate +
        result.projectedCurrentWeekDollars +
        result.projectedFutureWeeksDollars
    );
  });

  it("marks missingActuals when completed week has planned>0 and null actuals", () => {
    const projectStart = new Date("2025-02-03");
    const asOf = new Date("2025-02-16T23:59:59Z");

    const weeklyRows = [
      { weekStartDate: new Date("2025-02-03"), plannedHours: 40, actualHours: null, rate: 150 },
    ];

    const result = computeBudgetRollups(
      projectStart,
      null,
      weeklyRows,
      [{ lowHours: 100, highHours: 100, lowDollars: 15000, highDollars: 15000 }],
      asOf
    );

    expect(result.missingActuals).toBe(true);
    expect(result.forecastIncomplete).toBe(true);
  });
});

describe("weeklyUtilization", () => {
  it("returns actual/planned when both present", () => {
    expect(weeklyUtilization(40, 38)).toBe(38 / 40);
  });

  it("returns null when planned=0", () => {
    expect(weeklyUtilization(0, 10)).toBeNull();
  });

  it("returns null when actual is null", () => {
    expect(weeklyUtilization(40, null)).toBeNull();
  });
});

describe("hasPlanningMismatch", () => {
  const asOf = new Date("2025-02-16T23:59:59Z");

  it("returns true for future week when planned !== float", () => {
    const futureWeek = new Date("2025-02-17");
    expect(hasPlanningMismatch(futureWeek, 40, 35, asOf)).toBe(true);
  });

  it("returns false for future week when planned === float", () => {
    const futureWeek = new Date("2025-02-17");
    expect(hasPlanningMismatch(futureWeek, 40, 40, asOf)).toBe(false);
  });

  it("returns false for completed week even when planned !== float", () => {
    const completedWeek = new Date("2025-02-10");
    expect(hasPlanningMismatch(completedWeek, 40, 35, asOf)).toBe(false);
  });
});

describe("hasMissingActuals", () => {
  const asOf = new Date("2025-02-16T23:59:59Z");
  const now = new Date("2025-02-20T12:00:00Z"); // Wednesday, current week 02-17

  it("returns true for completed week with planned>0 and null actuals", () => {
    const completedWeek = new Date("2025-02-10");
    expect(hasMissingActuals(completedWeek, 40, null, asOf, now)).toBe(true);
  });

  it("returns false for future week", () => {
    const futureWeek = new Date("2025-02-24");
    expect(hasMissingActuals(futureWeek, 40, null, asOf, now)).toBe(false);
  });

  it("returns false when actuals present", () => {
    const completedWeek = new Date("2025-02-10");
    expect(hasMissingActuals(completedWeek, 40, 38, asOf, now)).toBe(false);
  });

  it("returns false when planned=0", () => {
    const completedWeek = new Date("2025-02-10");
    expect(hasMissingActuals(completedWeek, 0, null, asOf, now)).toBe(false);
  });
});
