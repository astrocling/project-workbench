import { describe, expect, it } from "vitest";
import {
  applyTimelineLayout,
  getStatusReportTimelineMetrics,
  formatPlanKeyDatesLine,
  isReadableTimelineWindow,
  pickSpacedTimelineMarkers,
  pruneTimelineLayout,
  setTimelineLayoutLabel,
  setTimelineLayoutRow,
  setTimelineLayoutWindow,
  statusReportMonthHeaderLabel,
  timelineMarkerHangsLeft,
  toggleTimelineHiddenId,
  type TimelineLayoutOverlay,
} from "@/lib/statusReportTimelineLayout";

describe("statusReportTimelineLayout", () => {
  it("uses compact overlay rows for the project timeline so 4 rows fit the slide slot", () => {
    const timeline = getStatusReportTimelineMetrics("timeline");
    const omitted = getStatusReportTimelineMetrics(undefined);
    expect(timeline.mode).toBe("overlay");
    expect(timeline.rowHeightPx).toBe(14);
    expect(timeline.labelColPx).toBe(0);
    expect(timeline.rowHeightPx * 4).toBeLessThanOrEqual(56);
    expect(omitted).toEqual(timeline);
  });

  it("uses Plan lanes without a left name column so labels sit in the bars", () => {
    const plan = getStatusReportTimelineMetrics("plan");
    expect(plan.mode).toBe("lanes");
    expect(plan.labelColPx).toBe(0);
    expect(plan.rowHeightPx * 4).toBeLessThanOrEqual(80);
  });

  it("alternates clustered marker columns left and right of the date", () => {
    expect(timelineMarkerHangsLeft(0)).toBe(true);
    expect(timelineMarkerHangsLeft(1)).toBe(false);
    expect(timelineMarkerHangsLeft(2)).toBe(true);
  });
});

const timeline = {
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  bars: [
    {
      phaseId: "p1",
      rowIndex: 1,
      label: "Discovery",
      startDate: "2026-03-01",
      endDate: "2026-04-01",
      color: null as string | null,
    },
    {
      phaseId: "p2",
      rowIndex: 2,
      label: "Build",
      startDate: "2026-04-01",
      endDate: "2026-06-01",
      color: null as string | null,
    },
  ],
  markers: [
    { itemId: "m1", label: "Alpha", date: "2026-04-05", shape: "Pin", rowIndex: 2 },
    { itemId: "m2", label: "Beta", date: "2026-05-01", shape: "Pin", rowIndex: 2 },
  ],
};

describe("applyTimelineLayout", () => {
  it("hides, renames, and re-rows by source id without mutating dates", () => {
    const layout: TimelineLayoutOverlay = {
      hiddenBarIds: ["p1"],
      hiddenMarkerIds: ["m2"],
      labels: { p2: "Build v1", m1: "α" },
      rows: { p2: 4, m1: 3 },
    };
    const next = applyTimelineLayout(timeline, layout);
    expect(next.bars).toEqual([
      {
        phaseId: "p2",
        rowIndex: 4,
        label: "Build v1",
        startDate: "2026-04-01",
        endDate: "2026-06-01",
        color: null,
      },
    ]);
    expect(next.markers).toEqual([
      { itemId: "m1", label: "α", date: "2026-04-05", shape: "Pin", rowIndex: 3 },
    ]);
    expect(timeline.bars).toHaveLength(2);
  });

  it("leaves legacy entries without ids unchanged", () => {
    const legacy = {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      bars: [{ rowIndex: 1, label: "Bar", startDate: "2026-03-01", endDate: "2026-04-01", color: null }],
      markers: [{ label: "Pin", date: "2026-03-15", shape: "Pin", rowIndex: 1 }],
    };
    expect(applyTimelineLayout(legacy, { hiddenBarIds: ["x"], labels: { x: "Nope" } })).toEqual(legacy);
  });
});

describe("pruneTimelineLayout", () => {
  it("drops overrides for ids that are no longer on the compact schedule", () => {
    const stale: TimelineLayoutOverlay = {
      hiddenBarIds: ["p1", "gone-phase"],
      hiddenMarkerIds: ["m1", "gone-marker"],
      labels: { p2: "Build v1", gone: "x" },
      rows: { m2: 4, gone: 2 },
    };
    expect(pruneTimelineLayout(stale, timeline)).toEqual({
      hiddenBarIds: ["p1"],
      hiddenMarkerIds: ["m1"],
      labels: { p2: "Build v1" },
      rows: { m2: 4 },
    });
  });
});

describe("timeline layout overlay edits", () => {
  it("toggles hidden ids and drops empty lists", () => {
    expect(toggleTimelineHiddenId(undefined, "p1", true)).toEqual(["p1"]);
    expect(toggleTimelineHiddenId(["p1"], "p1", false)).toBeUndefined();
  });

  it("stores a short label only when it differs from the original", () => {
    expect(setTimelineLayoutLabel(undefined, "p1", "Discovery", "Disc")).toEqual({ p1: "Disc" });
    expect(setTimelineLayoutLabel({ p1: "Disc" }, "p1", "Discovery", "Discovery")).toBeUndefined();
  });

  it("stores a row override only when it differs from the compact row", () => {
    expect(setTimelineLayoutRow(undefined, "p1", 1, 3)).toEqual({ p1: 3 });
    expect(setTimelineLayoutRow({ p1: 3 }, "p1", 1, 1)).toBeUndefined();
    expect(setTimelineLayoutRow(undefined, "p1", 1, 9)).toBeUndefined();
  });
});

describe("timeline window overlay", () => {
  it("rejects windows that would make month columns narrower than 50px on the slide", () => {
    expect(isReadableTimelineWindow("2026-01-01", "2027-06-30")).toBe(false);
    expect(isReadableTimelineWindow("2026-08-01", "2026-11-30")).toBe(true);
  });

  it("stores a readable window and drops it when it matches the auto axis", () => {
    expect(
      setTimelineLayoutWindow(undefined, "2026-08-01", "2026-11-30", "2026-08-01", "2026-11-30")
    ).toBeUndefined();
    expect(
      setTimelineLayoutWindow(undefined, "2026-08-01", "2026-12-31", "2026-08-01", "2026-11-30")
    ).toEqual({ windowStartYmd: "2026-08-01", windowEndYmd: "2026-12-31" });
  });

  it("applies a stored window to the rendered axis without changing bar dates", () => {
    const next = applyTimelineLayout(timeline, {
      windowStartYmd: "2026-03-01",
      windowEndYmd: "2026-06-30",
    });
    expect(next.startDate).toBe("2026-03-01");
    expect(next.endDate).toBe("2026-06-30");
    expect(next.bars[0]?.startDate).toBe("2026-03-01");
  });
});

describe("statusReportMonthHeaderLabel", () => {
  it("uses short names when more than four months are on the strip", () => {
    expect(statusReportMonthHeaderLabel("2026-09-01", 3)).toBe("SEPTEMBER");
    expect(statusReportMonthHeaderLabel("2026-09-01", 5)).toBe("SEP");
  });
});

describe("pickSpacedTimelineMarkers", () => {
  it("drops clustered key dates so icons do not pile on the same month", () => {
    const kept = pickSpacedTimelineMarkers(
      [
        { label: "A", date: "2026-09-02" },
        { label: "B", date: "2026-09-03" },
        { label: "C", date: "2026-09-04" },
        { label: "Go Live", date: "2026-11-15" },
      ],
      "2026-07-01",
      "2026-12-31"
    );
    expect(kept.map((m) => m.label)).toEqual(["A", "Go Live"]);
  });
});

describe("formatPlanKeyDatesLine", () => {
  it("lists in-window key dates so names stay readable off the bars", () => {
    expect(
      formatPlanKeyDatesLine([
        { label: "Go Live", date: "2026-11-15" },
        { label: "Kickoff", date: "2026-09-02" },
      ])
    ).toBe("9/2 Kickoff · 11/15 Go Live");
  });
});
