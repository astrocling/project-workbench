import { describe, expect, it } from "vitest";
import {
  GANTT_COL_WIDTH_DAY_WEEK,
  GANTT_COL_WIDTH_MONTH,
  fitGanttColWidth,
  formatCompactYmd,
  readableGanttColWidth,
} from "@/lib/plan/ganttColWidth";

describe("readableGanttColWidth", () => {
  it("uses 40px for day and week so M/DD labels fit", () => {
    expect(readableGanttColWidth("day")).toBe(GANTT_COL_WIDTH_DAY_WEEK);
    expect(readableGanttColWidth("week")).toBe(GANTT_COL_WIDTH_DAY_WEEK);
    expect(GANTT_COL_WIDTH_DAY_WEEK).toBe(40);
  });

  it("uses 64px for month so MM/YYYY labels fit", () => {
    expect(readableGanttColWidth("month")).toBe(GANTT_COL_WIDTH_MONTH);
    expect(GANTT_COL_WIDTH_MONTH).toBe(64);
  });
});

describe("fitGanttColWidth", () => {
  it("never goes below the readable min even when the pane is narrow", () => {
    expect(fitGanttColWidth(200, 56, "day")).toBe(GANTT_COL_WIDTH_DAY_WEEK);
    expect(fitGanttColWidth(100, 12, "month")).toBe(GANTT_COL_WIDTH_MONTH);
  });

  it("expands to fill the pane when that is wider than the readable min", () => {
    expect(fitGanttColWidth(800, 10, "day")).toBe(80);
    expect(fitGanttColWidth(1280, 10, "month")).toBe(128);
  });

  it("uses the readable min when pane width is unknown", () => {
    expect(fitGanttColWidth(0, 20, "day")).toBe(GANTT_COL_WIDTH_DAY_WEEK);
  });
});

describe("formatCompactYmd", () => {
  it("formats ISO dates as M/DD", () => {
    expect(formatCompactYmd("2026-09-08")).toBe("9/08");
    expect(formatCompactYmd("2026-12-01")).toBe("12/01");
  });
});
