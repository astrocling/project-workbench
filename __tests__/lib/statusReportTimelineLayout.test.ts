import { describe, expect, it } from "vitest";
import { MODULAR_BODY_TYPE_PX } from "@/lib/reportPanels";
import {
  applyTimelineLayout,
  getStatusReportTimelineMetrics,
  scaleStatusReportTimelineMetrics,
  formatPlanKeyDatesLine,
  isReadableTimelineWindow,
  pickSpacedTimelineMarkers,
  pruneTimelineLayout,
  setTimelineLayoutLabel,
  setTimelineLayoutRow,
  setTimelineLayoutWindow,
  statusReportMonthHeaderLabel,
  timelineMarkerHangsLeft,
  timelineMarkerStackTop,
  timelinePhaseRowLayout,
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

  it("doubles overlay metrics for the 1440 Modular canvas", () => {
    const base = getStatusReportTimelineMetrics("timeline");
    const scaled = scaleStatusReportTimelineMetrics(base, 2);
    expect(scaled.rowHeightPx).toBe(base.rowHeightPx * 2);
    expect(scaled.barFontPx).toBe(base.barFontPx * 2);
    expect(scaled.markerIconPx).toBe(base.markerIconPx * 2);
    expect(scaleStatusReportTimelineMetrics(base, 1)).toEqual(base);
  });

  it("uses Modular body type in a filled slot instead of Standard strip type", () => {
    const compact = getStatusReportTimelineMetrics("plan");
    const filled = getStatusReportTimelineMetrics("plan", { fillAvailableHeight: true });
    expect(compact.mode).toBe("lanes");
    expect(filled.mode).toBe("bands");
    expect(compact.barFontPx).toBeLessThan(12);
    expect(filled.barFontPx).toBe(MODULAR_BODY_TYPE_PX);
    expect(filled.monthFontPx).toBe(MODULAR_BODY_TYPE_PX);
    expect(filled.markerFontPx).toBe(MODULAR_BODY_TYPE_PX);
    expect(filled.barHeightPx).toBeGreaterThanOrEqual(16);
  });

  it("keeps compact overlay type on Standard while filled Modular uses module body type", () => {
    const compact = getStatusReportTimelineMetrics("timeline");
    const filled = getStatusReportTimelineMetrics("timeline", { fillAvailableHeight: true });
    expect(compact.barFontPx).toBe(5);
    expect(filled.barFontPx).toBe(MODULAR_BODY_TYPE_PX);
    expect(filled.mode).toBe("bands");
  });

  it("stacks markers vertically when the slot has leftover height", () => {
    expect(timelineMarkerStackTop(16, 0, 18, true)).toBe(16);
    expect(timelineMarkerStackTop(16, 2, 18, true)).toBe(52);
    expect(timelineMarkerStackTop(16, 2, 18, false)).toBe(16);
  });

  it("stretches phase rows when the Modular cell has leftover height", () => {
    expect(timelinePhaseRowLayout({ fillAvailableHeight: true, rowHeightPx: 28, lockHeight: true })).toEqual({
      minHeight: 28,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
    });
    expect(timelinePhaseRowLayout({ fillAvailableHeight: false, rowHeightPx: 14, lockHeight: false })).toEqual({
      minHeight: 14,
    });
    expect(timelinePhaseRowLayout({ fillAvailableHeight: false, rowHeightPx: 18, lockHeight: true })).toEqual({
      minHeight: 18,
      height: 18,
    });
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

  it("accepts row 5 when maxRow is 16", () => {
    expect(setTimelineLayoutRow(undefined, "p1", 1, 5, 16)).toEqual({ p1: 5 });
    expect(setTimelineLayoutRow(undefined, "p1", 1, 17, 16)).toBeUndefined();
  });

  it("applies row 5 overlay when maxRow is 16", () => {
    const next = applyTimelineLayout(
      timeline,
      { rows: { p1: 5 } },
      16
    );
    expect(next.bars.find((bar) => bar.phaseId === "p1")?.rowIndex).toBe(5);
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
