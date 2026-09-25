import { describe, expect, it } from "vitest";
import { MODULAR_BODY_TYPE_PX } from "@/lib/reportPanels";
import {
  applyTimelineLayout,
  getStatusReportTimelineMetrics,
  scaleStatusReportTimelineMetrics,
  isReadableTimelineWindow,
  pickSpacedTimelineMarkers,
  groupArrangeSchedule,
  moveArrangePhase,
  persistTimelineLayoutOnSnapshot,
  pruneTimelineLayout,
  timelineLayoutFromPreviousSnapshot,
  setTimelineLayoutLabel,
  setTimelineLayoutRow,
  setTimelineLayoutWindow,
  timelineDragInsertRow,
  timelineLineFromPointerY,
  timelineLineFromRowHit,
  selectTimelineChartRows,
  statusReportMonthHeaderLabel,
  timelineMarkerHangsLeft,
  timelineMarkerStackTop,
  timelinePhaseRowLayout,
  timelinePhaseWash,
  statusReportTimelineSlotHeightPx,
  usesPromotedTimeline,
  toggleTimelineHiddenId,
  moveArrangeKeyDate,
  defaultPinnedLabelLayout,
  movePinnedLabelBox,
  pinnedLabelBlockHeightPx,
  pinnedLabelCxPctBounds,
  pinnedLabelStackStepPx,
  resolvePinnedLabelLayout,
  setTimelineLayoutMarkerLabel,
  SR_TIMELINE_MARKER_ICON_PX,
  SR_TIMELINE_MARKER_TOP_PX,
  timelinePinnedContentHeightPx,
  timelinePinnedEmptyLaneHeightPx,
  timelinePinnedFillRowLayout,
  timelinePinnedPinBottomY,
  timelinePinnedRowHeightPx,
  timelinePublishedPinnedRowHeightPx,
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
    const plan = getStatusReportTimelineMetrics("plan", { planDensity: "phases" });
    expect(plan.mode).toBe("lanes");
    expect(plan.labelColPx).toBe(0);
    expect(plan.topBandPx).toBe(0);
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
    const compact = getStatusReportTimelineMetrics("plan", { planDensity: "phases" });
    const filled = getStatusReportTimelineMetrics("plan", {
      fillAvailableHeight: true,
      planDensity: "phases",
    });
    expect(compact.mode).toBe("lanes");
    expect(filled.mode).toBe("bands");
    expect(compact.barFontPx).toBeLessThan(12);
    expect(filled.barFontPx).toBe(MODULAR_BODY_TYPE_PX);
    expect(filled.monthFontPx).toBe(MODULAR_BODY_TYPE_PX);
    expect(filled.markerFontPx).toBe(MODULAR_BODY_TYPE_PX);
    expect(filled.barHeightPx).toBeGreaterThanOrEqual(16);
    expect(filled.labelColPx).toBe(112);
  });

  it("keeps compact overlay type on Standard while filled Modular uses module body type", () => {
    const compact = getStatusReportTimelineMetrics("timeline");
    const filled = getStatusReportTimelineMetrics("timeline", { fillAvailableHeight: true });
    expect(compact.barFontPx).toBe(5);
    expect(filled.barFontPx).toBe(MODULAR_BODY_TYPE_PX);
    expect(filled.mode).toBe("bands");
  });

  it("uses pinned mode for Plan Advanced with no rails and content-sized slot height", () => {
    const compact = getStatusReportTimelineMetrics("plan", {
      planDensity: "phases_and_key_dates",
    });
    const omitted = getStatusReportTimelineMetrics("plan");
    const filled = getStatusReportTimelineMetrics("plan", {
      fillAvailableHeight: true,
      planDensity: "phases_and_key_dates",
    });
    const timeline = getStatusReportTimelineMetrics("timeline", {
      planDensity: "phases_and_key_dates",
    });
    expect(compact.mode).toBe("pinned");
    expect(omitted).toEqual(compact);
    expect(compact.topBandPx).toBe(0);
    expect(compact.bottomRailPx).toBe(0);
    expect(filled.mode).toBe("pinned");
    expect(filled.topBandPx).toBe(0);
    expect(filled.bottomRailPx).toBe(0);
    expect(filled.labelColPx).toBe(0);
    expect(filled.rowHeightPx).toBe(40);
    expect(timeline.mode).toBe("overlay");
    expect(statusReportTimelineSlotHeightPx({ scheduleSource: "plan", planDensity: "phases" })).toBe(
      70
    );
    expect(
      statusReportTimelineSlotHeightPx({
        scheduleSource: "plan",
        planDensity: "phases_and_key_dates",
        contentHeightPx: 140,
      })
    ).toBe(140);
    expect(statusReportTimelineSlotHeightPx({ scheduleSource: "timeline" })).toBe(70);
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
      flexShrink: 0,
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
    { itemId: "m2", label: "Beta", date: "2026-05-01", shape: "BadgeAlert", rowIndex: 2 },
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
  it("prunes markerLabelLayout to ids still on the compact schedule", () => {
    const stale = {
      markerLabelLayout: {
        m1: { cxPct: 40, topPx: 20 },
        gone: { cxPct: 10, topPx: 8 },
      },
    };
    expect(pruneTimelineLayout(stale, timeline)).toEqual({
      markerLabelLayout: { m1: { cxPct: 40, topPx: 20 } },
    });
  });

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

  it("places a phase on an explicit line 1-4", () => {
    expect(setTimelineLayoutRow({ p1: 1 }, "p1", 1, 2, 4)).toEqual({ p1: 2 });
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

describe("groupArrangeSchedule", () => {
  it("nests key dates under the phase that shares their row and keeps hidden items in the list", () => {
    const groups = groupArrangeSchedule(timeline, { hiddenBarIds: ["p1"], hiddenMarkerIds: ["m2"] });
    expect(groups).toHaveLength(2);
    expect(groups[0]?.bar).toMatchObject({ id: "p1", hidden: true, label: "Discovery" });
    expect(groups[1]?.bar).toMatchObject({ id: "p2", hidden: false, label: "Build" });
    expect(groups[1]?.markers.map((marker) => marker.id)).toEqual(["m1", "m2"]);
    expect(groups[1]?.markers.find((marker) => marker.id === "m1")?.shape).toBe("Pin");
    expect(groups[1]?.markers.find((marker) => marker.id === "m2")).toMatchObject({
      hidden: true,
      shape: "BadgeAlert",
    });
  });
});

describe("moveArrangePhase", () => {
  it("swaps a phase with its neighbor and takes key dates on those rows along", () => {
    const next = moveArrangePhase({}, timeline, "p1", 1);
    expect(next.rows).toEqual({ p1: 2, p2: 1, m1: 1, m2: 1 });
    expect(moveArrangePhase({}, timeline, "p1", -1)).toEqual({});
  });
});

describe("moveArrangeKeyDate", () => {
  it("moves a key date onto the neighboring phase row", () => {
    const next = moveArrangeKeyDate({}, timeline, "m1", -1);
    expect(next.rows).toEqual({ m1: 1 });
    expect(moveArrangeKeyDate({}, timeline, "m1", 1)).toEqual({});
  });
});

describe("timelineLayoutFromPreviousSnapshot", () => {
  it("returns Plan arrange overlay from the previous report and ignores timeline-source reports", () => {
    expect(
      timelineLayoutFromPreviousSnapshot({
        scheduleSource: "plan",
        timelineLayout: { hiddenBarIds: ["p1"] },
      })
    ).toEqual({ hiddenBarIds: ["p1"] });
    expect(
      timelineLayoutFromPreviousSnapshot({
        scheduleSource: "timeline",
        timelineLayout: { hiddenBarIds: ["p1"] },
      })
    ).toBeUndefined();
    expect(timelineLayoutFromPreviousSnapshot({ scheduleSource: "plan", timelineLayout: {} })).toBeUndefined();
  });

  it("prunes inherited layout onto a new snapshot timeline and keeps unknown ids only when no timeline exists yet", () => {
    expect(
      persistTimelineLayoutOnSnapshot(
        { timeline: { bars: [{ phaseId: "p1" }], markers: [] } },
        { hiddenBarIds: ["p1", "gone"], labels: { p1: "Kickoff" } }
      )
    ).toEqual({
      timeline: { bars: [{ phaseId: "p1" }], markers: [] },
      timelineLayout: { hiddenBarIds: ["p1"], labels: { p1: "Kickoff" } },
    });
    expect(
      persistTimelineLayoutOnSnapshot({}, { hiddenBarIds: ["p1"] })
    ).toEqual({ timelineLayout: { hiddenBarIds: ["p1"] } });
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

describe("pinned key-date labels", () => {
  it("washes a phase hex at 10% opacity", () => {
    expect(timelinePhaseWash("#1941FA")).toBe("rgba(25,65,250,0.1)");
    expect(timelinePhaseWash("not-a-color")).toBeUndefined();
  });

  it("gates Advanced Plan density via usesPromotedTimeline", () => {
    expect(usesPromotedTimeline("plan", "phases")).toBe(false);
    expect(usesPromotedTimeline("plan", "phases_and_key_dates")).toBe(true);
    expect(usesPromotedTimeline("timeline", "phases_and_key_dates")).toBe(false);
  });

  it("places advanced compact pins below the phase bar", () => {
    const metrics = getStatusReportTimelineMetrics("plan", { planDensity: "phases_and_key_dates" });
    expect(metrics.markerTopPx).toBe(SR_TIMELINE_MARKER_TOP_PX);
  });

  it("attaches pinned leaders at the pin icon bottom", () => {
    expect(timelinePinnedPinBottomY({ markerTopPx: 16, markerIconPx: 8 })).toBe(24);
  });

  it("sizes published Advanced rows to the bar+pin band", () => {
    const compact = getStatusReportTimelineMetrics("plan", { planDensity: "phases_and_key_dates" });
    const published = timelinePublishedPinnedRowHeightPx(compact);
    expect(published).toBeGreaterThanOrEqual(timelinePinnedPinBottomY(compact));
    expect(published).toBe(timelinePinnedPinBottomY(compact) + 2);
    expect(published).toBeGreaterThan(compact.rowHeightPx);
  });

  const markerFontPx = 6;
  const opts = {
    markerTopPx: SR_TIMELINE_MARKER_TOP_PX,
    markerIconPx: SR_TIMELINE_MARKER_ICON_PX,
    stackStepPx: pinnedLabelStackStepPx(markerFontPx),
  };
  const baseTopPx = SR_TIMELINE_MARKER_TOP_PX + SR_TIMELINE_MARKER_ICON_PX + 2;

  it("stacks a same-row cluster downward and leaves a distant date on the first band", () => {
    const layout = defaultPinnedLabelLayout(
      [
        { itemId: "a", date: "2026-09-02" },
        { itemId: "b", date: "2026-09-03" },
        { itemId: "c", date: "2026-11-15" },
      ],
      "2026-07-01",
      "2026-12-31",
      opts
    );
    expect(layout.a?.topPx).toBe(baseTopPx);
    expect(layout.b?.topPx).toBe(baseTopPx + pinnedLabelStackStepPx(markerFontPx));
    expect(layout.c?.topPx).toBe(baseTopPx);
  });

  it("lets a saved box win over the automatic stack", () => {
    const resolved = resolvePinnedLabelLayout(
      [
        { itemId: "a", date: "2026-09-02" },
        { itemId: "b", date: "2026-09-03" },
      ],
      { markerLabelLayout: { b: { cxPct: 55, topPx: 48 } } },
      "2026-07-01",
      "2026-12-31",
      opts
    );
    expect(resolved.b).toEqual({ cxPct: 55, topPx: 48 });
  });

  it("grows row height to the lowest label", () => {
    const labelHeightPx = pinnedLabelBlockHeightPx(markerFontPx);
    expect(
      timelinePinnedRowHeightPx(
        40,
        ["a", "b"],
        { a: { cxPct: 10, topPx: 20 }, b: { cxPct: 12, topPx: 48 } },
        labelHeightPx,
        4
      )
    ).toBe(72);
  });

  it("keeps an empty Modular Advanced lane at the phase-bar floor", () => {
    const metrics = getStatusReportTimelineMetrics("plan", {
      fillAvailableHeight: true,
      planDensity: "phases_and_key_dates",
    });
    const floor = timelinePinnedEmptyLaneHeightPx(metrics);
    expect(floor).toBe(metrics.barTopPx + (metrics.barHeightPx ?? 0) + 8);
    expect(floor).toBeLessThan(metrics.rowHeightPx);
    expect(
      timelinePinnedFillRowLayout({ contentHeightPx: floor, floorPx: floor, hasLabels: false })
    ).toEqual({
      minHeight: floor,
      height: floor,
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: floor,
    });
  });

  it("gives stacked milestone labels a taller lane than a single label", () => {
    const metrics = getStatusReportTimelineMetrics("plan", {
      fillAvailableHeight: true,
      planDensity: "phases_and_key_dates",
    });
    const floor = timelinePinnedEmptyLaneHeightPx(metrics);
    const labelHeightPx = pinnedLabelBlockHeightPx(metrics.markerFontPx);
    const baseTopPx = metrics.markerTopPx + metrics.markerIconPx + 2;
    const one = timelinePinnedRowHeightPx(
      metrics.rowHeightPx,
      ["a"],
      { a: { cxPct: 10, topPx: baseTopPx } },
      labelHeightPx,
      4
    );
    const stacked = timelinePinnedRowHeightPx(
      metrics.rowHeightPx,
      ["a", "b"],
      {
        a: { cxPct: 10, topPx: baseTopPx },
        b: { cxPct: 12, topPx: baseTopPx + pinnedLabelStackStepPx(metrics.markerFontPx) },
      },
      labelHeightPx,
      4
    );
    const oneLayout = timelinePinnedFillRowLayout({
      contentHeightPx: one,
      floorPx: floor,
      hasLabels: true,
    });
    const stackedLayout = timelinePinnedFillRowLayout({
      contentHeightPx: stacked,
      floorPx: floor,
      hasLabels: true,
    });
    expect(one).toBeGreaterThan(floor);
    expect(stacked).toBeGreaterThan(one);
    expect(oneLayout).toEqual({
      minHeight: floor,
      flexGrow: one,
      flexShrink: 1,
      flexBasis: one,
    });
    expect(stackedLayout.flexBasis).toBe(stacked);
    expect(stackedLayout.flexGrow).toBe(stacked);
    expect(stackedLayout.minHeight).toBe(floor);
  });
});

describe("timelinePinnedContentHeightPx", () => {
  const pinnedTimeline = {
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
      { itemId: "m2", label: "Beta", date: "2026-04-06", shape: "BadgeAlert", rowIndex: 2 },
    ],
  };

  it("returns null for condensed plan and project timeline", () => {
    expect(
      timelinePinnedContentHeightPx({
        timeline: pinnedTimeline,
        scheduleSource: "plan",
        planDensity: "phases",
      })
    ).toBeNull();
    expect(
      timelinePinnedContentHeightPx({
        timeline: pinnedTimeline,
        scheduleSource: "timeline",
        planDensity: "phases_and_key_dates",
      })
    ).toBeNull();
  });

  it("sizes published Standard Advanced slot from bar+pin row height, ignoring parked labels", () => {
    const compact = getStatusReportTimelineMetrics("plan", { planDensity: "phases_and_key_dates" });
    const publishedRowHeightPx = timelinePublishedPinnedRowHeightPx(compact);
    const parked = {
      ...pinnedTimeline,
      markers: [
        { itemId: "m1", label: "Alpha", date: "2026-04-05", shape: "Pin", rowIndex: 2 },
        { itemId: "m2", label: "Beta", date: "2026-04-06", shape: "BadgeAlert", rowIndex: 2 },
      ],
    };
    const height = timelinePinnedContentHeightPx({
      timeline: parked,
      scheduleSource: "plan",
      planDensity: "phases_and_key_dates",
      labelOverlay: {
        markerLabelLayout: {
          m2: { cxPct: 40, topPx: 120 },
        },
      },
    });
    const expected = publishedRowHeightPx * 2 + 12;
    expect(height).toBe(expected);
    expect(publishedRowHeightPx).toBeGreaterThanOrEqual(timelinePinnedPinBottomY(compact));
    expect(
      statusReportTimelineSlotHeightPx({
        scheduleSource: "plan",
        planDensity: "phases_and_key_dates",
        contentHeightPx: height ?? undefined,
      })
    ).toBe(Math.max(70, expected));
  });
});

describe("setTimelineLayoutMarkerLabel", () => {
  it("stores and clears saved label boxes", () => {
    const box = { cxPct: 40, topPx: 22 };
    expect(setTimelineLayoutMarkerLabel(undefined, "m1", box)).toEqual({ m1: box });
    expect(setTimelineLayoutMarkerLabel({ m1: box }, "m1", null)).toBeUndefined();
  });
});

describe("pinnedLabelCxPctBounds", () => {
  it("pads cxPct bounds so half-width labels stay inside the chart", () => {
    const { minCxPct, maxCxPct } = pinnedLabelCxPctBounds(76, 400);
    expect(minCxPct).toBeCloseTo(9.5);
    expect(maxCxPct).toBeCloseTo(90.5);
  });
});

describe("timelineLineFromPointerY", () => {
  it("maps pointer Y to lines 1-4", () => {
    expect(timelineLineFromPointerY(0, 100, 4)).toBe(1);
    expect(timelineLineFromPointerY(26, 100, 4)).toBe(2);
    expect(timelineLineFromPointerY(99, 100, 4)).toBe(4);
    expect(timelineLineFromPointerY(-10, 100, 4)).toBe(1);
  });
});

describe("timelineDragInsertRow", () => {
  it("offers the fourth line when only three lanes are occupied", () => {
    expect(timelineDragInsertRow([1, 2, 3], 4)).toBe(4);
  });

  it("offers a gap before a later occupied line", () => {
    expect(timelineDragInsertRow([1, 2, 4], 4)).toBe(3);
  });

  it("offers nothing when all four lines are occupied", () => {
    expect(timelineDragInsertRow([1, 2, 3, 4], 4)).toBeNull();
  });
});

describe("timelineLineFromRowHit", () => {
  const occupiedTwo = [
    { row: 1, top: 0, height: 40 },
    { row: 2, top: 40, height: 40 },
  ];

  it("maps pointer Y onto occupied data-timeline-row-chart boxes", () => {
    expect(timelineLineFromRowHit(10, occupiedTwo, 4)).toBe(1);
    expect(timelineLineFromRowHit(55, occupiedTwo, 4)).toBe(2);
  });

  it("assigns the next empty line 1-4 when dropping below the last occupied row", () => {
    expect(timelineLineFromRowHit(90, occupiedTwo, 4)).toBe(3);
    expect(
      timelineLineFromRowHit(
        130,
        [
          { row: 1, top: 0, height: 40 },
          { row: 2, top: 40, height: 40 },
          { row: 3, top: 80, height: 40 },
        ],
        4
      )
    ).toBe(4);
  });

  it("stays on the last occupied line when all four lines are filled", () => {
    const four = [
      { row: 1, top: 0, height: 20 },
      { row: 2, top: 20, height: 20 },
      { row: 3, top: 40, height: 20 },
      { row: 4, top: 60, height: 20 },
    ];
    expect(timelineLineFromRowHit(90, four, 4)).toBe(4);
  });
});

const wrap4Timeline = {
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  bars: [
    { label: "Discovery", startDate: "2026-01-01", endDate: "2026-03-01", rowIndex: 1, phaseId: "p1", color: null as string | null },
    { label: "Design", startDate: "2026-03-01", endDate: "2026-05-01", rowIndex: 2, phaseId: "p2", color: null },
    { label: "Build", startDate: "2026-05-01", endDate: "2026-08-01", rowIndex: 3, phaseId: "p3", color: null },
    { label: "UAT", startDate: "2026-08-01", endDate: "2026-10-01", rowIndex: 4, phaseId: "p4", color: null },
    { label: "Launch", startDate: "2026-10-01", endDate: "2026-12-01", rowIndex: 1, phaseId: "p5", color: null },
  ],
  markers: [
    { label: "Kickoff", date: "2026-01-15", rowIndex: 1, shape: "Pin" },
    { label: "Go live", date: "2026-10-15", rowIndex: 1, shape: "Pin" },
  ],
};

describe("selectTimelineChartRows", () => {
  it("keeps wrap4 Advanced fill at four active rows instead of expanding Launch to row 5", () => {
    const selected = selectTimelineChartRows({
      timeline: wrap4Timeline,
      fillAvailableHeight: true,
      scheduleSource: "plan",
      planDensity: "phases_and_key_dates",
    });
    expect(selected.activeRows).toEqual([1, 2, 3, 4]);
    expect(selected.rowCap).toBe(4);
    expect(selected.chart.bars.map((bar) => [bar.label, bar.rowIndex])).toEqual([
      ["Discovery", 1],
      ["Design", 2],
      ["Build", 3],
      ["UAT", 4],
      ["Launch", 1],
    ]);
  });

  it("caps locked unique rows 1-5 so Advanced fill does not draw row 5", () => {
    const unique = {
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      bars: [
        { label: "A", startDate: "2026-01-01", endDate: "2026-02-01", rowIndex: 1, color: null as string | null },
        { label: "B", startDate: "2026-02-01", endDate: "2026-03-01", rowIndex: 2, color: null },
        { label: "C", startDate: "2026-03-01", endDate: "2026-04-01", rowIndex: 3, color: null },
        { label: "D", startDate: "2026-04-01", endDate: "2026-05-01", rowIndex: 4, color: null },
        { label: "E", startDate: "2026-05-01", endDate: "2026-06-01", rowIndex: 5, color: null },
      ],
      markers: [] as { date: string; rowIndex?: number; label?: string; shape?: string }[],
    };
    const selected = selectTimelineChartRows({
      timeline: unique,
      fillAvailableHeight: true,
      scheduleSource: "plan",
      planDensity: "phases_and_key_dates",
    });
    expect(selected.activeRows).toEqual([1, 2, 3, 4]);
    expect(selected.chart.bars.find((bar) => bar.label === "E")?.rowIndex).toBe(5);
  });

  it("still expands wrapped Condensed Modular fill onto unique rows including 5", () => {
    const selected = selectTimelineChartRows({
      timeline: wrap4Timeline,
      fillAvailableHeight: true,
      scheduleSource: "plan",
      planDensity: "phases",
    });
    expect(selected.activeRows).toEqual([1, 2, 3, 4, 5]);
    expect(selected.rowCap).toBe(16);
    expect(selected.chart.bars.map((bar) => [bar.label, bar.rowIndex])).toEqual([
      ["Discovery", 1],
      ["Design", 2],
      ["Build", 3],
      ["UAT", 4],
      ["Launch", 5],
    ]);
  });

  it("still expands wrapped Project-timeline fill onto unique rows including 5", () => {
    const selected = selectTimelineChartRows({
      timeline: wrap4Timeline,
      fillAvailableHeight: true,
      scheduleSource: "timeline",
    });
    expect(selected.activeRows).toEqual([1, 2, 3, 4, 5]);
    expect(selected.rowCap).toBe(16);
  });
});

describe("movePinnedLabelBox", () => {
  const start = { cxPct: 40, topPx: 22 };
  const bounds = { minTopPx: 15, minCxPct: 5, maxCxPct: 95 };

  it("increases topPx when dragged down", () => {
    expect(movePinnedLabelBox(start, 0, 10, bounds)).toEqual({ cxPct: 40, topPx: 32 });
  });

  it("stops topPx at minTopPx when dragged up past the bar", () => {
    expect(movePinnedLabelBox(start, 0, -20, bounds)).toEqual({ cxPct: 40, topPx: 15 });
  });

  it("stops topPx at maxTopPx when dragged down past the row", () => {
    expect(movePinnedLabelBox(start, 0, 100, { ...bounds, maxTopPx: 50 })).toEqual({
      cxPct: 40,
      topPx: 50,
    });
  });

  it("clamps cxPct to the chart edges", () => {
    expect(movePinnedLabelBox(start, -50, 0, bounds)).toEqual({ cxPct: 5, topPx: 22 });
    expect(movePinnedLabelBox(start, 60, 0, bounds)).toEqual({ cxPct: 95, topPx: 22 });
  });
});
