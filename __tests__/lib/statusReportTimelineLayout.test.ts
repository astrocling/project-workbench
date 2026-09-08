import { describe, expect, it } from "vitest";
import {
  SR_TIMELINE_MARKER_TOP_PX,
  SR_TIMELINE_ROW_HEIGHT_PX,
  applyTimelineLayout,
  pruneTimelineLayout,
  setTimelineLayoutLabel,
  setTimelineLayoutRow,
  timelineMarkerHangsLeft,
  toggleTimelineHiddenId,
  type TimelineLayoutOverlay,
} from "@/lib/statusReportTimelineLayout";

describe("statusReportTimelineLayout", () => {
  it("keeps the marker band below the bar inside the row", () => {
    expect(SR_TIMELINE_MARKER_TOP_PX).toBeGreaterThan(15);
    expect(SR_TIMELINE_MARKER_TOP_PX).toBeLessThan(SR_TIMELINE_ROW_HEIGHT_PX);
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
