import { describe, expect, it } from "vitest";
import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";
import { compactPlanToSchedule, getVisibleBarSegment, isMarkerInAxis, timelineHasVisibleSchedule } from "@/lib/plan/reportSchedule";

function item(
  partial: Partial<PlanItemJson> & Pick<PlanItemJson, "id" | "phaseId" | "label">
): PlanItemJson {
  return {
    type: "task",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    order: 0,
    parentItemId: null,
    meetingStatus: null,
    scheduledTime: null,
    ...partial,
  };
}

function phase(
  partial: Partial<PlanPhaseJson> & Pick<PlanPhaseJson, "id" | "name" | "items">
): PlanPhaseJson {
  return {
    planId: "plan-1",
    color: "#1941FA",
    order: 0,
    ...partial,
  };
}

describe("compactPlanToSchedule", () => {
  it("returns null for empty phases", () => {
    expect(compactPlanToSchedule([], "phases")).toBeNull();
    expect(compactPlanToSchedule([], "phases_and_key_dates")).toBeNull();
  });

  it("omits phases with no items and returns null when all are empty", () => {
    expect(
      compactPlanToSchedule(
        [
          phase({ id: "p1", name: "Empty", order: 0, items: [] }),
          phase({ id: "p2", name: "Also empty", order: 1, items: [] }),
        ],
        "phases"
      )
    ).toBeNull();
  });

  it("maps phase order to rowIndex with wrap at 4", () => {
    const order0 = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Discovery",
          order: 0,
          items: [item({ id: "i1", phaseId: "p1", label: "Task" })],
        }),
      ],
      "phases"
    );
    expect(order0?.bars).toEqual([
      {
        rowIndex: 1,
        label: "Discovery",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        color: null,
      },
    ]);

    const order4 = compactPlanToSchedule(
      [
        phase({
          id: "p2",
          name: "Deployment",
          order: 4,
          items: [item({ id: "i2", phaseId: "p2", label: "Task" })],
        }),
      ],
      "phases"
    );
    expect(order4?.bars[0]?.rowIndex).toBe(1);
  });

  it("builds phase bars from min/max item dates with no markers in phases density", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Build",
          order: 0,
          items: [
            item({
              id: "i1",
              phaseId: "p1",
              label: "Early",
              startDate: "2026-03-01",
              endDate: "2026-03-05",
            }),
            item({
              id: "i2",
              phaseId: "p1",
              label: "Late",
              startDate: "2026-03-10",
              endDate: "2026-03-12",
            }),
          ],
        }),
      ],
      "phases"
    );

    expect(result).toEqual({
      bars: [
        {
          rowIndex: 1,
          label: "Build",
          startDate: "2026-03-01",
          endDate: "2026-03-12",
          color: null,
        },
      ],
      markers: [],
    });
  });

  it("includes key-date markers and omits tasks, assumed meetings, and waiting_on_client", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Delivery",
          order: 1,
          items: [
            item({
              id: "task",
              phaseId: "p1",
              label: "Implement",
              type: "task",
              startDate: "2026-04-01",
              endDate: "2026-04-10",
            }),
            item({
              id: "milestone",
              phaseId: "p1",
              label: "Alpha",
              type: "milestone",
              startDate: "2026-04-05",
              endDate: "2026-04-05",
            }),
            item({
              id: "signoff",
              phaseId: "p1",
              label: "Client sign-off",
              type: "sign_off",
              startDate: "2026-04-08",
              endDate: "2026-04-08",
            }),
            item({
              id: "deadline",
              phaseId: "p1",
              label: "Launch deadline",
              type: "hard_deadline",
              startDate: "2026-04-15",
              endDate: "2026-04-15",
            }),
            item({
              id: "meeting",
              phaseId: "p1",
              label: "Kickoff call",
              type: "meeting",
              meetingStatus: "scheduled",
              startDate: "2026-04-02",
              endDate: "2026-04-02",
            }),
            item({
              id: "assumed",
              phaseId: "p1",
              label: "Weekly sync",
              type: "meeting",
              meetingStatus: "assumed",
              startDate: "2026-04-03",
              endDate: "2026-04-03",
            }),
            item({
              id: "waiting",
              phaseId: "p1",
              label: "Waiting on client",
              type: "waiting_on_client",
              startDate: "2026-04-06",
              endDate: "2026-04-07",
            }),
          ],
        }),
      ],
      "phases_and_key_dates"
    );

    expect(result?.bars).toEqual([
      {
        rowIndex: 2,
        label: "Delivery",
        startDate: "2026-04-01",
        endDate: "2026-04-15",
        color: null,
      },
    ]);
    expect(result?.markers).toEqual([
      { label: "Alpha", date: "2026-04-05", shape: "Pin", rowIndex: 2 },
      { label: "Client sign-off", date: "2026-04-08", shape: "ThumbsUp", rowIndex: 2 },
      { label: "Launch deadline", date: "2026-04-15", shape: "BadgeAlert", rowIndex: 2 },
      { label: "Kickoff call", date: "2026-04-02", shape: "Rocket", rowIndex: 2 },
    ]);
  });

  it("uses nested tasks for phase bar dates but not as markers", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Development",
          order: 2,
          items: [
            item({
              id: "parent",
              phaseId: "p1",
              label: "Parent task",
              type: "task",
              startDate: "2026-05-01",
              endDate: "2026-05-05",
              order: 0,
            }),
            item({
              id: "child",
              phaseId: "p1",
              label: "Nested task",
              type: "task",
              startDate: "2026-05-10",
              endDate: "2026-05-20",
              order: 1,
              parentItemId: "parent",
            }),
            item({
              id: "milestone",
              phaseId: "p1",
              label: "Code complete",
              type: "milestone",
              startDate: "2026-05-15",
              endDate: "2026-05-15",
              order: 2,
            }),
          ],
        }),
      ],
      "phases_and_key_dates"
    );

    expect(result?.bars).toEqual([
      {
        rowIndex: 3,
        label: "Development",
        startDate: "2026-05-01",
        endDate: "2026-05-20",
        color: null,
      },
    ]);
    expect(result?.markers).toEqual([
      { label: "Code complete", date: "2026-05-15", shape: "Pin", rowIndex: 3 },
    ]);
  });

  it("omits point-only phase bars and returns null for phases-only density", () => {
    const pointOnlyPhase = phase({
      id: "p1",
      name: "Launch",
      order: 0,
      items: [
        item({
          id: "m1",
          phaseId: "p1",
          label: "Go live",
          type: "milestone",
          startDate: "2026-06-01",
          endDate: "2026-06-01",
        }),
      ],
    });

    expect(compactPlanToSchedule([pointOnlyPhase], "phases")).toBeNull();
  });

  it("passes point-only phases via markers in key-dates density", () => {
    const pointOnlyPhase = phase({
      id: "p1",
      name: "Launch",
      order: 0,
      items: [
        item({
          id: "m1",
          phaseId: "p1",
          label: "Go live",
          type: "milestone",
          startDate: "2026-06-01",
          endDate: "2026-06-01",
        }),
      ],
    });

    const result = compactPlanToSchedule([pointOnlyPhase], "phases_and_key_dates");
    expect(result?.bars).toEqual([]);
    expect(result?.markers).toEqual([
      { label: "Go live", date: "2026-06-01", shape: "Pin", rowIndex: 1 },
    ]);
    expect(
      timelineHasVisibleSchedule({
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        bars: result!.bars,
        markers: result!.markers,
      })
    ).toBe(true);
  });

  it("phases-only point-only phase fails visible schedule validation", () => {
    const pointOnlyPhase = phase({
      id: "p1",
      name: "Launch",
      order: 0,
      items: [
        item({
          id: "m1",
          phaseId: "p1",
          label: "Go live",
          type: "milestone",
          startDate: "2026-06-01",
          endDate: "2026-06-01",
        }),
      ],
    });
    expect(compactPlanToSchedule([pointOnlyPhase], "phases")).toBeNull();
  });
});

describe("timelineHasVisibleSchedule", () => {
  it("detects visible bar segments within the axis", () => {
    expect(
      getVisibleBarSegment(
        { startDate: "2026-03-01", endDate: "2026-03-05" },
        "2026-02-01",
        "2026-04-01"
      )
    ).toEqual({ visibleStart: "2026-03-01", visibleEnd: "2026-03-05" });
    expect(
      getVisibleBarSegment(
        { startDate: "2026-05-01", endDate: "2026-05-01" },
        "2026-02-01",
        "2026-04-01"
      )
    ).toBeNull();
  });

  it("detects markers within the axis", () => {
    expect(isMarkerInAxis({ date: "2026-03-15" }, "2026-03-01", "2026-04-01")).toBe(true);
    expect(isMarkerInAxis({ date: "2026-05-01" }, "2026-03-01", "2026-04-01")).toBe(false);
  });

  it("returns true for marker-only schedules on the axis", () => {
    expect(
      timelineHasVisibleSchedule({
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        bars: [{ startDate: "2026-06-01", endDate: "2026-06-01" }],
        markers: [{ date: "2026-04-01" }],
      })
    ).toBe(true);
  });

  it("returns false for phases-only point-only bars with no in-axis markers", () => {
    expect(
      timelineHasVisibleSchedule({
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        bars: [{ startDate: "2026-06-01", endDate: "2026-06-01" }],
        markers: [],
      })
    ).toBe(false);
  });

  it("returns false when all bars are outside the axis and no markers", () => {
    expect(
      timelineHasVisibleSchedule({
        startDate: "2026-03-01",
        endDate: "2026-04-01",
        bars: [{ startDate: "2026-05-01", endDate: "2026-06-01" }],
        markers: [],
      })
    ).toBe(false);
  });
});
