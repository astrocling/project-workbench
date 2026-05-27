import { describe, it, expect } from "vitest";
import {
  assignmentPairKey,
  filterPlannedRowsToVisibleAssignments,
  personWeekIsActualsStale,
} from "@/lib/missingActuals";

/** Mon 2025-02-10 – Sun 2025-02-16 (single month) */
const COMPLETED_WEEK = new Date("2025-02-10T00:00:00.000Z");
const AS_OF = new Date("2025-02-16T23:59:59.000Z");
const NOW = new Date("2025-02-20T12:00:00.000Z");

/** Mon 2026-03-30 – Sun 2026-04-05 (split month) */
const SPLIT_WEEK = new Date("2026-03-30T00:00:00.000Z");
const SPLIT_AS_OF = new Date("2026-04-12T23:59:59.000Z");
const SPLIT_NOW = new Date("2026-04-14T12:00:00.000Z");

describe("personWeekIsActualsStale", () => {
  it("returns false when planned=0 even if actuals are null", () => {
    expect(
      personWeekIsActualsStale(
        {
          weekStartDate: COMPLETED_WEEK,
          plannedHours: 0,
          actualHours: null,
          monthSplitByKey: new Map(),
        },
        AS_OF,
        NOW
      )
    ).toBe(false);
  });

  it("returns true when planned>0 and actuals are null (non-split week)", () => {
    expect(
      personWeekIsActualsStale(
        {
          weekStartDate: COMPLETED_WEEK,
          plannedHours: 40,
          actualHours: null,
          monthSplitByKey: new Map(),
        },
        AS_OF,
        NOW
      )
    ).toBe(true);
  });

  it("returns false when planned>0 and actuals are explicitly 0 (non-split week)", () => {
    expect(
      personWeekIsActualsStale(
        {
          weekStartDate: COMPLETED_WEEK,
          plannedHours: 40,
          actualHours: 0,
          monthSplitByKey: new Map(),
        },
        AS_OF,
        NOW
      )
    ).toBe(false);
  });

  it("returns false when planned>0 and actuals are entered (non-split week)", () => {
    expect(
      personWeekIsActualsStale(
        {
          weekStartDate: COMPLETED_WEEK,
          plannedHours: 40,
          actualHours: 38,
          monthSplitByKey: new Map(),
        },
        AS_OF,
        NOW
      )
    ).toBe(false);
  });

  it("returns true for split week when second month-half is due and missing", () => {
    expect(
      personWeekIsActualsStale(
        {
          weekStartDate: SPLIT_WEEK,
          plannedHours: 40,
          actualHours: 20,
          monthSplitByKey: new Map([["2026-03", 20]]),
        },
        SPLIT_AS_OF,
        SPLIT_NOW
      )
    ).toBe(true);
  });

  it("returns false for split week when both month halves have rows (including 0 hours)", () => {
    expect(
      personWeekIsActualsStale(
        {
          weekStartDate: SPLIT_WEEK,
          plannedHours: 40,
          actualHours: 20,
          monthSplitByKey: new Map([
            ["2026-03", 20],
            ["2026-04", 0],
          ]),
        },
        SPLIT_AS_OF,
        SPLIT_NOW
      )
    ).toBe(false);
  });
});

describe("filterPlannedRowsToVisibleAssignments", () => {
  it("excludes planned rows without a visible assignment", () => {
    const rows = [
      { projectId: "p1", personId: "a", hours: 20 },
      { projectId: "p1", personId: "b", hours: 5 },
    ];
    const visible = new Set([assignmentPairKey("p1", "a")]);
    expect(filterPlannedRowsToVisibleAssignments(rows, visible)).toEqual([rows[0]]);
  });
});
