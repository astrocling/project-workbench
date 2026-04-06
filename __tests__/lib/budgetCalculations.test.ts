import { describe, it, expect } from "vitest";
import {
  computeBudgetRollups,
  weeklyUtilization,
  hasPlanningMismatch,
  hasMissingActuals,
  hasMissingActualsSplitWeek,
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
    expect(result.remainingAfterForecastHoursLow).toBe(500 - (80 + 30 + 80));
    expect(result.remainingAfterForecastDollarsLow).toBe(50000 - (8000 + 3000 + 8000));
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

  describe("actualsStatus", () => {
    const projectStart = new Date("2025-02-03");
    const asOf = new Date("2025-02-16T23:59:59Z"); // completed weeks: 02-03, 02-10. Last completed: 02-10.

    it("returns up-to-date when no missing actuals", () => {
      const weeklyRows = [
        { weekStartDate: new Date("2025-02-03"), plannedHours: 40, actualHours: 40, rate: 100 },
        { weekStartDate: new Date("2025-02-10"), plannedHours: 40, actualHours: 38, rate: 100 },
      ];
      const result = computeBudgetRollups(
        projectStart,
        null,
        weeklyRows,
        [{ lowHours: 200, highHours: 200, lowDollars: 20000, highDollars: 20000 }],
        asOf
      );
      expect(result.actualsStatus).toBe("up-to-date");
    });

    it("returns 1-week-behind when missing actuals only in last completed week", () => {
      const weeklyRows = [
        { weekStartDate: new Date("2025-02-03"), plannedHours: 40, actualHours: 40, rate: 100 },
        { weekStartDate: new Date("2025-02-10"), plannedHours: 40, actualHours: null, rate: 100 },
      ];
      const result = computeBudgetRollups(
        projectStart,
        null,
        weeklyRows,
        [{ lowHours: 200, highHours: 200, lowDollars: 20000, highDollars: 20000 }],
        asOf
      );
      expect(result.actualsStatus).toBe("1-week-behind");
    });

    it("returns more-than-1-week-behind when missing actuals in earlier completed week", () => {
      const weeklyRows = [
        { weekStartDate: new Date("2025-02-03"), plannedHours: 40, actualHours: null, rate: 100 },
        { weekStartDate: new Date("2025-02-10"), plannedHours: 40, actualHours: 40, rate: 100 },
      ];
      const result = computeBudgetRollups(
        projectStart,
        null,
        weeklyRows,
        [{ lowHours: 200, highHours: 200, lowDollars: 20000, highDollars: 20000 }],
        asOf
      );
      expect(result.actualsStatus).toBe("more-than-1-week-behind");
    });

    it("returns more-than-1-week-behind when multiple weeks missing actuals", () => {
      const weeklyRows = [
        { weekStartDate: new Date("2025-02-03"), plannedHours: 40, actualHours: null, rate: 100 },
        { weekStartDate: new Date("2025-02-10"), plannedHours: 40, actualHours: null, rate: 100 },
      ];
      const result = computeBudgetRollups(
        projectStart,
        null,
        weeklyRows,
        [{ lowHours: 200, highHours: 200, lowDollars: 20000, highDollars: 20000 }],
        asOf
      );
      expect(result.actualsStatus).toBe("more-than-1-week-behind");
    });
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

/** Mon 2026-03-30 – Sun 2026-04-05 (keys 2026-03 / 2026-04) */
const SPLIT_WEEK_2026 = new Date("2026-03-30T00:00:00.000Z");

describe("hasMissingActualsSplitWeek", () => {
  const asOfCompleted = new Date("2026-04-12T23:59:59.000Z");
  const nowAfterWeek = new Date("2026-04-14T12:00:00.000Z");

  it("returns true when first month filled but second month null after week completes", () => {
    expect(
      hasMissingActualsSplitWeek(
        SPLIT_WEEK_2026,
        40,
        20,
        null,
        "2026-03",
        "2026-04",
        asOfCompleted,
        nowAfterWeek
      )
    ).toBe(true);
  });

  it("returns false when both month halves have values", () => {
    expect(
      hasMissingActualsSplitWeek(
        SPLIT_WEEK_2026,
        40,
        20,
        20,
        "2026-03",
        "2026-04",
        asOfCompleted,
        nowAfterWeek
      )
    ).toBe(false);
  });

  it("returns true when both halves null and week is completed", () => {
    expect(
      hasMissingActualsSplitWeek(
        SPLIT_WEEK_2026,
        40,
        null,
        null,
        "2026-03",
        "2026-04",
        asOfCompleted,
        nowAfterWeek
      )
    ).toBe(true);
  });

  it("returns false during the current in-progress week even when halves are null", () => {
    const nowInSplitWeek = new Date("2026-04-02T12:00:00.000Z");
    expect(
      hasMissingActualsSplitWeek(
        SPLIT_WEEK_2026,
        40,
        null,
        null,
        "2026-03",
        "2026-04",
        asOfCompleted,
        nowInSplitWeek
      )
    ).toBe(false);
  });

  it("returns false for a future week", () => {
    const asOfBeforeWeek = new Date("2026-03-22T23:59:59.000Z");
    expect(
      hasMissingActualsSplitWeek(
        SPLIT_WEEK_2026,
        40,
        null,
        null,
        "2026-03",
        "2026-04",
        asOfBeforeWeek,
        nowAfterWeek
      )
    ).toBe(false);
  });

  it("returns false when planned hours are zero", () => {
    expect(
      hasMissingActualsSplitWeek(
        SPLIT_WEEK_2026,
        0,
        null,
        null,
        "2026-03",
        "2026-04",
        asOfCompleted,
        nowAfterWeek
      )
    ).toBe(false);
  });

  it("uses rowFlags: second half stale when no row for month 2 even if val2 is 0 (legacy coerce)", () => {
    expect(
      hasMissingActualsSplitWeek(
        SPLIT_WEEK_2026,
        40,
        20,
        0,
        "2026-03",
        "2026-04",
        asOfCompleted,
        nowAfterWeek,
        { hasRowFirst: true, hasRowSecond: false }
      )
    ).toBe(true);
  });

  it("uses rowFlags: not stale when both month rows exist including 0 in second month", () => {
    expect(
      hasMissingActualsSplitWeek(
        SPLIT_WEEK_2026,
        40,
        20,
        0,
        "2026-03",
        "2026-04",
        asOfCompleted,
        nowAfterWeek,
        { hasRowFirst: true, hasRowSecond: true }
      )
    ).toBe(false);
  });
});
