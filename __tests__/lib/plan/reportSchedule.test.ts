import { describe, expect, it } from "vitest";
import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";
import {
  compactPlanToSchedule,
  applyPlanPhaseColors,
  compactLanePolicyForVariation,
  reportKeyDateKind,
  getActiveTimelineRows,
  getCompactPlanTimelineRows,
  getVisibleBarSegment,
  getVisibleBarSegmentsForRow,
  getVisibleMarkersForRow,
  isMarkerInAxis,
  isRenderableTimelineRow,
  expandScheduleEntriesToOwnRows,
  TIMELINE_FILL_ROW_MAX,
  timelineHasVisibleSchedule,
  timelineLayoutMaxRow,
} from "@/lib/plan/reportSchedule";

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
        phaseId: "p1",
        rowIndex: 1,
        label: "Discovery",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        color: "#1941FA",
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

  it("maps phase order 4 to row 5 when lanePolicy is onePhasePerRow", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p2",
          name: "Deployment",
          order: 4,
          items: [item({ id: "i2", phaseId: "p2", label: "Task" })],
        }),
      ],
      "phases",
      { lanePolicy: "onePhasePerRow" }
    );
    expect(result?.bars[0]?.rowIndex).toBe(5);
  });

  it("still wraps order 4 onto row 1 by default", () => {
    const result = compactPlanToSchedule(
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
    expect(result?.bars[0]?.rowIndex).toBe(1);
  });

  it("maps compact marker shapes to Plan date-type labels", () => {
    expect(reportKeyDateKind("Pin")).toEqual({ shape: "Pin", label: "Milestone" });
    expect(reportKeyDateKind("ThumbsUp")).toEqual({ shape: "ThumbsUp", label: "Sign-off" });
    expect(reportKeyDateKind("BadgeAlert")).toEqual({ shape: "BadgeAlert", label: "Hard deadline" });
    expect(reportKeyDateKind("Flag")).toEqual({ shape: "Flag", label: "Hard deadline" });
    expect(reportKeyDateKind("Rocket")).toEqual({ shape: "Rocket", label: "Meeting" });
    expect(reportKeyDateKind("Calendar")).toEqual({ shape: "Calendar", label: "Meeting" });
    expect(reportKeyDateKind("PencilRuler").label).toBe("Key date");
  });

  it("picks onePhasePerRow only for Modular", () => {
    expect(compactLanePolicyForVariation("Modular")).toBe("onePhasePerRow");
    expect(compactLanePolicyForVariation("Standard")).toBe("wrap4");
    expect(timelineLayoutMaxRow("Modular")).toBe(16);
    expect(timelineLayoutMaxRow("Standard")).toBe(4);
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
          phaseId: "p1",
          rowIndex: 1,
          label: "Build",
          startDate: "2026-03-01",
          endDate: "2026-03-12",
          color: "#1941FA",
        },
      ],
      markers: [],
    });
  });

  it("copies the Plan phase color onto the compact bar", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Design",
          color: "#6d28d9",
          order: 0,
          items: [item({ id: "i1", phaseId: "p1", label: "Wireframes" })],
        }),
      ],
      "phases"
    );
    expect(result?.bars[0]?.color).toBe("#6d28d9");
  });

  it("fills missing snapshot bar colors from live Plan phases", () => {
    const painted = applyPlanPhaseColors(
      {
        bars: [
          {
            phaseId: "p1",
            rowIndex: 1,
            label: "Design",
            startDate: "2026-08-01",
            endDate: "2026-09-01",
            color: null,
          },
          {
            phaseId: "p2",
            rowIndex: 2,
            label: "Build",
            startDate: "2026-09-01",
            endDate: "2026-10-01",
            color: "#111111",
          },
        ],
        markers: [
          {
            itemId: "m1",
            phaseId: "p1",
            label: "Alpha",
            date: "2026-08-15",
            shape: "Pin",
            rowIndex: 1,
            color: null,
          },
        ],
      },
      [
        { id: "p1", color: "#6d28d9" },
        { id: "p2", color: "#1941FA" },
      ]
    );
    expect(painted.bars[0]?.color).toBe("#6d28d9");
    expect(painted.bars[1]?.color).toBe("#111111");
    expect(painted.markers[0]?.color).toBe("#6d28d9");
  });

  it("paints markers from the phase bar on the same row when phaseId is missing", () => {
    const painted = applyPlanPhaseColors(
      {
        bars: [
          {
            phaseId: "p1",
            rowIndex: 2,
            label: "Design",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            color: "#6d28d9",
          },
        ],
        markers: [
          {
            itemId: "m1",
            label: "Sign-off",
            date: "2026-04-10",
            shape: "ThumbsUp",
            rowIndex: 2,
            color: null,
          },
        ],
      },
      [{ id: "p1", color: "#6d28d9" }]
    );
    expect(painted.markers[0]?.color).toBe("#6d28d9");
  });

  it("includes key-date markers and omits tasks, unscheduled meetings, and waiting_on_client", () => {
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
              id: "unscheduled",
              phaseId: "p1",
              label: "Weekly sync",
              type: "meeting",
              meetingStatus: "unscheduled",
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
        phaseId: "p1",
        rowIndex: 2,
        label: "Delivery",
        startDate: "2026-04-01",
        endDate: "2026-04-15",
        color: "#1941FA",
      },
    ]);
    expect(result?.markers).toEqual([
      {
        itemId: "milestone",
        phaseId: "p1",
        label: "Alpha",
        date: "2026-04-05",
        shape: "Pin",
        rowIndex: 2,
        color: "#1941FA",
      },
      {
        itemId: "signoff",
        phaseId: "p1",
        label: "Client sign-off",
        date: "2026-04-08",
        shape: "ThumbsUp",
        rowIndex: 2,
        color: "#1941FA",
      },
      {
        itemId: "deadline",
        phaseId: "p1",
        label: "Launch deadline",
        date: "2026-04-15",
        shape: "Flag",
        rowIndex: 2,
        color: "#1941FA",
      },
      {
        itemId: "meeting",
        phaseId: "p1",
        label: "Kickoff call",
        date: "2026-04-02",
        shape: "Calendar",
        rowIndex: 2,
        color: "#1941FA",
      },
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
        phaseId: "p1",
        rowIndex: 3,
        label: "Development",
        startDate: "2026-05-01",
        endDate: "2026-05-20",
        color: "#1941FA",
      },
    ]);
    expect(result?.markers).toEqual([
      {
        itemId: "milestone",
        phaseId: "p1",
        label: "Code complete",
        date: "2026-05-15",
        shape: "Pin",
        rowIndex: 3,
        color: "#1941FA",
      },
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
      {
        itemId: "m1",
        phaseId: "p1",
        label: "Go live",
        date: "2026-06-01",
        shape: "Pin",
        rowIndex: 1,
        color: "#1941FA",
      },
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

  it("skips phases with showOnReports false and uses Plan names on the schedule", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "hidden",
          name: "Internal only",
          order: 0,
          showOnReports: false,
          items: [item({ id: "t1", phaseId: "hidden", label: "Task" })],
        }),
        phase({
          id: "shown",
          name: "Very Long Discovery Phase Name",
          reportLabel: "Discovery",
          order: 1,
          items: [
            item({
              id: "m1",
              phaseId: "shown",
              label: "Kickoff workshop with stakeholders",
              reportLabel: "Kickoff",
              type: "milestone",
              startDate: "2026-03-03",
              endDate: "2026-03-03",
            }),
            item({ id: "t1", phaseId: "shown", label: "Work", startDate: "2026-03-01", endDate: "2026-03-10" }),
          ],
        }),
      ],
      "phases_and_key_dates"
    );

    expect(result?.bars).toEqual([
      {
        phaseId: "shown",
        rowIndex: 2,
        label: "Very Long Discovery Phase Name",
        startDate: "2026-03-01",
        endDate: "2026-03-10",
        color: "#1941FA",
      },
    ]);
    expect(result?.markers).toEqual([
      {
        itemId: "m1",
        phaseId: "shown",
        label: "Kickoff workshop with stakeholders",
        date: "2026-03-03",
        shape: "Pin",
        rowIndex: 2,
        color: "#1941FA",
      },
    ]);
  });

  it("omits key dates with showOnReports false but still uses them for phase bar span", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Build",
          order: 0,
          items: [
            item({
              id: "m-hidden",
              phaseId: "p1",
              label: "Internal gate",
              type: "milestone",
              showOnReports: false,
              startDate: "2026-03-12",
              endDate: "2026-03-12",
            }),
            item({
              id: "m-shown",
              phaseId: "p1",
              label: "Alpha",
              type: "milestone",
              startDate: "2026-03-05",
              endDate: "2026-03-05",
            }),
            item({
              id: "t1",
              phaseId: "p1",
              label: "Work",
              startDate: "2026-03-01",
              endDate: "2026-03-10",
            }),
          ],
        }),
      ],
      "phases_and_key_dates"
    );

    expect(result?.bars[0]?.endDate).toBe("2026-03-12");
    expect(result?.markers).toEqual([
      {
        itemId: "m-shown",
        phaseId: "p1",
        label: "Alpha",
        date: "2026-03-05",
        shape: "Pin",
        rowIndex: 1,
        color: "#1941FA",
      },
    ]);
  });

  it("mutes completed key dates and fully completed phase bars", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Done phase",
          order: 0,
          items: [
            item({
              id: "t1",
              phaseId: "p1",
              label: "Work",
              status: "complete",
              startDate: "2026-03-01",
              endDate: "2026-03-10",
            }),
            item({
              id: "m1",
              phaseId: "p1",
              label: "Ship",
              type: "milestone",
              status: "complete",
              startDate: "2026-03-10",
              endDate: "2026-03-10",
            }),
          ],
        }),
      ],
      "phases_and_key_dates"
    );

    expect(result?.bars[0]?.muted).toBe(true);
    expect(result?.markers).toEqual([
      {
        itemId: "m1",
        phaseId: "p1",
        label: "Ship",
        date: "2026-03-10",
        shape: "Pin",
        rowIndex: 1,
        color: "#1941FA",
        muted: true,
      },
    ]);
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

  it("returns true for marker-only schedules on the axis (legacy snapshots included)", () => {
    expect(
      timelineHasVisibleSchedule({
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        bars: [],
        markers: [{ date: "2026-04-01", rowIndex: 2 }],
      })
    ).toBe(true);
  });

  it("ignores bars and markers outside rows 1-4", () => {
    expect(isRenderableTimelineRow(1)).toBe(true);
    expect(isRenderableTimelineRow(4)).toBe(true);
    expect(isRenderableTimelineRow(5)).toBe(false);
    expect(
      timelineHasVisibleSchedule({
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        bars: [{ startDate: "2026-04-01", endDate: "2026-04-10", rowIndex: 5 }],
        markers: [{ date: "2026-04-15", rowIndex: 0 }],
      })
    ).toBe(false);
    expect(
      timelineHasVisibleSchedule({
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        bars: [{ startDate: "2026-04-01", endDate: "2026-04-10", rowIndex: 3 }],
        markers: [],
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

/**
 * The row helpers below are what both `TimelineBlock` renderers use, so the render gate
 * (`timelineHasVisibleSchedule`) and what each row actually draws cannot disagree.
 */
describe("timeline row content", () => {
  const axis = { startDate: "2026-03-01", endDate: "2026-06-30" };

  it("keeps only in-axis markers on a row, so none is clamped to an axis edge", () => {
    const markers = [
      { label: "Kickoff", date: "2026-01-15", rowIndex: 1 },
      { label: "Cutover", date: "2026-04-01", rowIndex: 1 },
      { label: "Handover", date: "2026-09-01", rowIndex: 1 },
      { label: "Other row", date: "2026-04-02", rowIndex: 2 },
    ];
    expect(getVisibleMarkersForRow(markers, 1, axis.startDate, axis.endDate)).toEqual([
      { label: "Cutover", date: "2026-04-01", rowIndex: 1 },
    ]);
  });

  it("treats a marker without a row as row 1 and ignores rows outside 1-4", () => {
    const markers = [{ label: "Default row", date: "2026-04-01" }];
    expect(getVisibleMarkersForRow(markers, 1, axis.startDate, axis.endDate)).toEqual(markers);
    expect(getVisibleMarkersForRow(markers, 2, axis.startDate, axis.endDate)).toEqual([]);
    expect(
      getVisibleMarkersForRow(
        [{ label: "Off-grid", date: "2026-04-01", rowIndex: 5 }],
        5,
        axis.startDate,
        axis.endDate
      )
    ).toEqual([]);
  });

  it("clips bars on a row to the axis and drops the ones with nothing visible", () => {
    const bars = [
      { label: "Discovery", startDate: "2026-01-01", endDate: "2026-04-15", rowIndex: 1 },
      { label: "Point", startDate: "2026-05-01", endDate: "2026-05-01", rowIndex: 1 },
      { label: "Later", startDate: "2026-08-01", endDate: "2026-09-01", rowIndex: 1 },
    ];
    expect(getVisibleBarSegmentsForRow(bars, 1, axis.startDate, axis.endDate)).toEqual([
      { bar: bars[0], visibleStart: "2026-03-01", visibleEnd: "2026-04-15" },
    ]);
    expect(getVisibleBarSegmentsForRow(bars, 3, axis.startDate, axis.endDate)).toEqual([]);
  });

  it("activates only rows that draw something, for legacy timelines", () => {
    expect(
      getActiveTimelineRows({
        ...axis,
        bars: [{ startDate: "2026-03-10", endDate: "2026-04-10", rowIndex: 1 }],
        markers: [
          // Out of axis: must not open row 3 with a marker pinned to the axis edge.
          { date: "2026-12-01", rowIndex: 3 },
          { date: "2026-05-01", rowIndex: 4 },
        ],
      })
    ).toEqual([1, 4]);
  });

  it("activates the marker row of a marker-only Plan schedule", () => {
    const schedule = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Launch",
          order: 1,
          items: [
            item({
              id: "m1",
              phaseId: "p1",
              label: "Go live",
              type: "milestone",
              startDate: "2026-04-01",
              endDate: "2026-04-01",
            }),
          ],
        }),
      ],
      "phases_and_key_dates"
    );
    const timeline = { ...axis, bars: schedule!.bars, markers: schedule!.markers };
    expect(getActiveTimelineRows(timeline)).toEqual([2]);
    expect(timelineHasVisibleSchedule(timeline)).toBe(true);
  });

  it("shows every Plan lane that intersects the window", () => {
    const timeline = {
      startDate: "2026-08-01",
      endDate: "2026-11-30",
      bars: [
        { startDate: "2026-03-01", endDate: "2026-08-15", rowIndex: 1 },
        { startDate: "2026-08-01", endDate: "2026-10-01", rowIndex: 2 },
        { startDate: "2026-09-01", endDate: "2026-11-01", rowIndex: 3 },
        { startDate: "2026-11-01", endDate: "2026-12-01", rowIndex: 4 },
      ],
      markers: [] as { date: string; rowIndex?: number }[],
    };
    expect(getCompactPlanTimelineRows(timeline, "2026-09-15")).toEqual([1, 2, 3, 4]);
  });

  it("splits wrapped Plan phases onto their own rows in a filled Modular slot", () => {
    const wrapped = {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      bars: [
        { label: "Discovery", startDate: "2026-01-01", endDate: "2026-03-01", rowIndex: 1, phaseId: "p1" },
        { label: "Design", startDate: "2026-03-01", endDate: "2026-05-01", rowIndex: 2, phaseId: "p2" },
        { label: "Build", startDate: "2026-05-01", endDate: "2026-08-01", rowIndex: 3, phaseId: "p3" },
        { label: "UAT", startDate: "2026-08-01", endDate: "2026-10-01", rowIndex: 4, phaseId: "p4" },
        { label: "Launch", startDate: "2026-10-01", endDate: "2026-12-01", rowIndex: 1, phaseId: "p5" },
      ],
      markers: [
        { label: "Kickoff", date: "2026-01-15", rowIndex: 1 },
        { label: "Go live", date: "2026-10-15", rowIndex: 1 },
      ],
    };
    const expanded = expandScheduleEntriesToOwnRows(wrapped);
    expect(expanded.bars.map((bar) => [bar.label, bar.rowIndex])).toEqual([
      ["Discovery", 1],
      ["Design", 2],
      ["Build", 3],
      ["UAT", 4],
      ["Launch", 5],
    ]);
    expect(expanded.markers.find((m) => m.label === "Kickoff")?.rowIndex).toBe(1);
    expect(expanded.markers.find((m) => m.label === "Go live")?.rowIndex).toBe(5);
    expect(getActiveTimelineRows(expanded, TIMELINE_FILL_ROW_MAX)).toEqual([1, 2, 3, 4, 5]);
    expect(getActiveTimelineRows(wrapped)).toEqual([1, 2, 3, 4]);
  });

  it("keeps unique rowIndexes so Arrange onePhasePerRow survives fill render", () => {
    const unique = {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      bars: [
        { label: "Discovery", startDate: "2026-03-01", endDate: "2026-04-01", rowIndex: 1, phaseId: "p1" },
        { label: "Launch", startDate: "2026-01-01", endDate: "2026-02-01", rowIndex: 5, phaseId: "p5" },
      ],
      markers: [
        { label: "Kickoff", date: "2026-03-15", rowIndex: 1 },
        { label: "Go live", date: "2026-01-15", rowIndex: 5 },
      ],
    };
    const expanded = expandScheduleEntriesToOwnRows(unique);
    expect(expanded.bars.map((bar) => [bar.label, bar.rowIndex])).toEqual([
      ["Discovery", 1],
      ["Launch", 5],
    ]);
    expect(expanded.markers.find((m) => m.label === "Kickoff")?.rowIndex).toBe(1);
    expect(expanded.markers.find((m) => m.label === "Go live")?.rowIndex).toBe(5);
  });

  it("agrees with the render gate: no active rows means no visible schedule", () => {
    const timeline = {
      ...axis,
      bars: [{ startDate: "2026-08-01", endDate: "2026-09-01", rowIndex: 1 }],
      markers: [{ date: "2026-12-01", rowIndex: 2 }],
    };
    expect(getActiveTimelineRows(timeline)).toEqual([]);
    expect(timelineHasVisibleSchedule(timeline)).toBe(false);
  });
});
