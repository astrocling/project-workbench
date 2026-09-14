/**
 * Client-side capture of the Plan print layout to a US Letter landscape PDF.
 * Pages are `[data-plan-print-page]` nodes sized to 792×612pt — not a screenshot
 * of the interactive Smartsheet (that produced a huge, unreadable file).
 */

export const PLAN_PDF_PAGE_W_PT = 792; // US Letter landscape
export const PLAN_PDF_PAGE_H_PT = 612;
export const PLAN_PDF_EXPORT_SCALE = 1;
const MAX_ASSUMPTIONS_PAGE_H_PT = PLAN_PDF_PAGE_H_PT;

const CAPTURE_OPTS = {
  scale: 2,
  useCORS: true,
  logging: false,
  backgroundColor: "#ffffff",
  allowTaint: false,
};

export function fitContain(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number
): { w: number; h: number } {
  if (srcW <= 0 || srcH <= 0) return { w: boxW, h: boxH };
  const scale = Math.min(boxW / srcW, boxH / srcH);
  return { w: srcW * scale, h: srcH * scale };
}

/** Source pixels of height that fill one landscape page when width is scaled to pageW. */
export function canvasPageHeightPx(
  canvasWidth: number,
  pageW: number,
  pageH: number
): number {
  if (canvasWidth <= 0 || pageW <= 0) return pageH;
  return (pageH / pageW) * canvasWidth;
}

export type ChartSlice = { bodyY: number; bodyHeight: number };

/** Split chart body so each page can redraw the date header. */
export function chartVerticalSlices(
  contentHeight: number,
  headerHeight: number,
  maxPageHeight: number
): ChartSlice[] {
  const header = Math.max(0, headerHeight);
  const bodyTotal = Math.max(0, contentHeight - header);
  const bodyBudget = Math.max(1, maxPageHeight - header);
  if (contentHeight <= maxPageHeight) {
    return [{ bodyY: header, bodyHeight: bodyTotal }];
  }
  const slices: ChartSlice[] = [];
  let y = header;
  while (y < contentHeight) {
    const h = Math.min(bodyBudget, contentHeight - y);
    slices.push({ bodyY: y, bodyHeight: h });
    y += h;
  }
  return slices;
}

/** Assumptions page size from captured canvas. Custom [w,h] only — never "portrait". */
export function planAssumptionsPageSize(
  canvasWidth: number,
  canvasHeight: number,
  exportScale: number
): { pageW: number; pageH: number } {
  const pageW = PLAN_PDF_PAGE_W_PT * exportScale;
  const maxH = MAX_ASSUMPTIONS_PAGE_H_PT * exportScale;
  if (canvasWidth <= 0) return { pageW, pageH: maxH };
  const pageH = Math.min((canvasHeight / canvasWidth) * pageW, maxH);
  return { pageW, pageH };
}

export type CapturePlanToPdfOptions = {
  chartElement: HTMLElement;
  assumptionsElement?: HTMLElement | null;
  filename: string;
  exportScale?: number;
};

export async function capturePlanToPdf(options: CapturePlanToPdfOptions): Promise<void> {
  const { chartElement, filename } = options;
  const exportScale =
    typeof options.exportScale === "number" && Number.isFinite(options.exportScale) && options.exportScale > 0
      ? options.exportScale
      : PLAN_PDF_EXPORT_SCALE;

  const pageW = PLAN_PDF_PAGE_W_PT * exportScale;
  const pageH = PLAN_PDF_PAGE_H_PT * exportScale;

  const printPages = Array.from(
    chartElement.querySelectorAll<HTMLElement>("[data-plan-print-page]")
  );
  if (printPages.length === 0) {
    throw new Error("Plan print layout was not ready");
  }

  const [html2canvas, { jsPDF }] = await Promise.all([
    import("html2canvas-pro").then((m) => m.default),
    import("jspdf"),
  ]);

  await document.fonts.ready;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [pageW, pageH],
  });

  const orig = printPages.map((el) => ({
    el,
    width: el.style.width,
    height: el.style.height,
    transform: el.style.transform,
  }));
  try {
    for (const [index, pageEl] of printPages.entries()) {
      pageEl.style.width = `${PLAN_PDF_PAGE_W_PT}px`;
      pageEl.style.height = `${PLAN_PDF_PAGE_H_PT}px`;
      pageEl.style.transform = "none";
      const canvas = await html2canvas(pageEl, {
        ...CAPTURE_OPTS,
        width: PLAN_PDF_PAGE_W_PT,
        height: PLAN_PDF_PAGE_H_PT,
        windowWidth: PLAN_PDF_PAGE_W_PT,
        windowHeight: PLAN_PDF_PAGE_H_PT,
      });
      const fitted = fitContain(canvas.width, canvas.height, pageW, pageH);
      if (index > 0) pdf.addPage([pageW, pageH]);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, fitted.w, fitted.h);
    }
    pdf.save(filename);
  } finally {
    for (const saved of orig) {
      saved.el.style.width = saved.width;
      saved.el.style.height = saved.height;
      saved.el.style.transform = saved.transform;
    }
  }
}
