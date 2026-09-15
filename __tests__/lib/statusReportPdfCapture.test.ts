import { describe, expect, it } from "vitest";
import {
  computeNotesPageSize,
  resolveSlideCaptureBox,
  SLIDE_PDF_HEIGHT_PT,
  SLIDE_PDF_PAGE_WIDTH_PT,
} from "@/lib/statusReportPdfCapture";

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

function attrEl(attrs: Record<string, string | null>) {
  return {
    getAttribute(name: string): string | null {
      return name in attrs ? attrs[name] : null;
    },
  };
}

describe("resolveSlideCaptureBox", () => {
  it("falls back to 720×405 when attrs are missing", () => {
    expect(resolveSlideCaptureBox(attrEl({}))).toEqual({ width: 720, height: 405 });
  });

  it("pins 1440×810 from data-slide-width / data-slide-height", () => {
    expect(
      resolveSlideCaptureBox(
        attrEl({ "data-slide-width": "1440", "data-slide-height": "810" })
      )
    ).toEqual({ width: 1440, height: 810 });
  });
});

describe("slide PDF page constants", () => {
  it("keep the 16:9 present size at 720×405", () => {
    expect(SLIDE_PDF_PAGE_WIDTH_PT).toBe(720);
    expect(SLIDE_PDF_HEIGHT_PT).toBe(405);
  });
});
