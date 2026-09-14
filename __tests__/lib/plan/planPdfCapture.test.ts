import { describe, expect, it } from "vitest";
import {
  PLAN_PDF_PAGE_H_PT,
  PLAN_PDF_PAGE_W_PT,
  canvasPageHeightPx,
  chartVerticalSlices,
  fitContain,
  planAssumptionsPageSize,
} from "@/lib/planPdfCapture";

describe("letter landscape page", () => {
  it("is US Letter landscape in points (not a scaled-up poster)", () => {
    expect(PLAN_PDF_PAGE_W_PT).toBe(792);
    expect(PLAN_PDF_PAGE_H_PT).toBe(612);
    expect(PLAN_PDF_PAGE_W_PT).toBeGreaterThan(PLAN_PDF_PAGE_H_PT);
  });
});

describe("fitContain", () => {
  it("scales a wide chart to page width without overflowing height", () => {
    const { w, h } = fitContain(1600, 400, 792, 612);
    expect(w).toBe(792);
    expect(h).toBe(198);
  });

  it("scales a tall slice to page height", () => {
    const { w, h } = fitContain(400, 800, 792, 612);
    expect(h).toBe(612);
    expect(w).toBe(306);
  });
});

describe("canvasPageHeightPx", () => {
  it("maps how many source pixels fit on one landscape page at full width", () => {
    expect(canvasPageHeightPx(1584, 792, 612)).toBe(1224);
  });
});

describe("chartVerticalSlices", () => {
  it("returns a single body slice when the chart fits one page", () => {
    expect(chartVerticalSlices(800, 44, 1224)).toEqual([
      { bodyY: 44, bodyHeight: 756 },
    ]);
  });

  it("paginates body rows and leaves room to repeat the header", () => {
    const slices = chartVerticalSlices(2000, 44, 500);
    expect(slices.length).toBeGreaterThan(1);
    expect(slices[0]).toEqual({ bodyY: 44, bodyHeight: 456 });
    const covered = slices.reduce((sum, s) => sum + s.bodyHeight, 0);
    expect(covered).toBe(2000 - 44);
    for (const slice of slices) {
      expect(slice.bodyHeight + 44).toBeLessThanOrEqual(500);
    }
  });
});

describe("planAssumptionsPageSize", () => {
  it("keeps landscape letter width", () => {
    const { pageW, pageH } = planAssumptionsPageSize(1584, 400, 1);
    expect(pageW).toBe(792);
    expect(pageH).toBeCloseTo(200, 0);
    expect(pageW).toBeGreaterThan(pageH);
  });

  it("caps height at letter landscape", () => {
    const { pageW, pageH } = planAssumptionsPageSize(1584, 4000, 1);
    expect(pageW).toBe(792);
    expect(pageH).toBe(612);
  });
});
