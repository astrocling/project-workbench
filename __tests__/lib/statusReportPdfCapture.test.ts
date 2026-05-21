import { describe, expect, it } from "vitest";
import { computeNotesPageSize } from "@/lib/statusReportPdfCapture";

describe("computeNotesPageSize", () => {
  const exportScale = 1.5;

  it("uses full slide width at export scale (not a narrow strip)", () => {
    const { pageW } = computeNotesPageSize(1440, 800, exportScale);
    expect(pageW).toBe(1080);
  });

  it("preserves canvas aspect ratio for page height", () => {
    // 720×200 layout at scale 2 → 1440×400 canvas
    const { pageW, pageH } = computeNotesPageSize(1440, 400, exportScale);
    expect(pageW).toBe(1080);
    expect(pageH).toBeCloseTo(300, 0);
    expect(pageW).toBeGreaterThan(pageH);
  });

  it("caps height at MAX_NOTES_PAGE_HEIGHT_PT × exportScale", () => {
    const { pageH } = computeNotesPageSize(1440, 4000, exportScale);
    expect(pageH).toBe(1350);
  });
});
