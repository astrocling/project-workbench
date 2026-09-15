import { describe, expect, it } from "vitest";
import {
  PLAN_EXPAND_COL,
  PLAN_FULL_GRID_INNER_WIDTH,
  PLAN_PRESENT_GRID_WIDTH,
  PLAN_VIEW_GRID_WIDTH,
  effectivePlanGridMode,
  leftPaneWidth,
  showGanttLabels,
  showLeftPaneCollapseControl,
} from "@/lib/plan/planGridLayout";

describe("effectivePlanGridMode", () => {
  it("treats edit as view while presenting", () => {
    expect(effectivePlanGridMode("edit", true)).toBe("view");
  });

  it("leaves chart and view unchanged while presenting", () => {
    expect(effectivePlanGridMode("chart", true)).toBe("chart");
    expect(effectivePlanGridMode("view", true)).toBe("view");
  });
});

describe("leftPaneWidth", () => {
  it("uses the compact view width in work view", () => {
    expect(leftPaneWidth({ gridMode: "view", presenting: false, collapsed: false })).toBe(
      PLAN_VIEW_GRID_WIDTH
    );
  });

  it("uses the full edit width in work edit", () => {
    expect(leftPaneWidth({ gridMode: "edit", presenting: false, collapsed: false })).toBe(
      PLAN_FULL_GRID_INNER_WIDTH
    );
  });

  it("includes dates in the expanded present view pane", () => {
    expect(leftPaneWidth({ gridMode: "view", presenting: true, collapsed: false })).toBe(
      PLAN_PRESENT_GRID_WIDTH
    );
    expect(PLAN_PRESENT_GRID_WIDTH).toBeGreaterThan(PLAN_VIEW_GRID_WIDTH - 120);
  });

  it("collapses to the expand rail in present view", () => {
    expect(leftPaneWidth({ gridMode: "view", presenting: true, collapsed: true })).toBe(
      PLAN_EXPAND_COL
    );
  });

  it("uses the expand rail in chart, including while presenting", () => {
    expect(leftPaneWidth({ gridMode: "chart", presenting: false, collapsed: false })).toBe(
      PLAN_EXPAND_COL
    );
    expect(leftPaneWidth({ gridMode: "chart", presenting: true, collapsed: false })).toBe(
      PLAN_EXPAND_COL
    );
  });

  it("ignores collapse outside present view", () => {
    expect(leftPaneWidth({ gridMode: "view", presenting: false, collapsed: true })).toBe(
      PLAN_VIEW_GRID_WIDTH
    );
  });
});

describe("showGanttLabels", () => {
  it("shows labels in present and chart", () => {
    expect(showGanttLabels({ gridMode: "view", presenting: true })).toBe(true);
    expect(showGanttLabels({ gridMode: "chart", presenting: false })).toBe(true);
    expect(showGanttLabels({ gridMode: "edit", presenting: true })).toBe(true);
  });

  it("hides labels in work view and edit", () => {
    expect(showGanttLabels({ gridMode: "view", presenting: false })).toBe(false);
    expect(showGanttLabels({ gridMode: "edit", presenting: false })).toBe(false);
  });
});

describe("showLeftPaneCollapseControl", () => {
  it("shows only for present view, not chart", () => {
    expect(showLeftPaneCollapseControl({ gridMode: "view", presenting: true })).toBe(true);
    expect(showLeftPaneCollapseControl({ gridMode: "edit", presenting: true })).toBe(true);
    expect(showLeftPaneCollapseControl({ gridMode: "chart", presenting: true })).toBe(false);
    expect(showLeftPaneCollapseControl({ gridMode: "view", presenting: false })).toBe(false);
  });
});
