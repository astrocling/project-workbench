/**
 * Client-side capture of StatusReportView DOM to PDF.
 * Use from "use client" components only. Ensures the downloaded PDF
 * matches exactly what is shown in the preview (same DOM).
 * Uses html2canvas-pro (supports oklch/Tailwind v4) and dynamic import for jsPDF.
 */

import { PLAN_PDF_PAGE_H_PT, PLAN_PDF_PAGE_W_PT } from "@/lib/planPdfCapture";

/** 16:9 present page (pt). Capture may pin a larger canvas, then scale onto this page. */
export const SLIDE_PDF_PAGE_WIDTH_PT = 720;
export const SLIDE_PDF_HEIGHT_PT = 405;

const DEFAULT_SLIDE_CAPTURE_WIDTH = 720;
const DEFAULT_SLIDE_CAPTURE_HEIGHT = 405;

export function resolveSlideCaptureBox(el: {
  getAttribute(name: string): string | null;
}): { width: number; height: number } {
  const width = Number(el.getAttribute("data-slide-width"));
  const height = Number(el.getAttribute("data-slide-height"));
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height };
  }
  return { width: DEFAULT_SLIDE_CAPTURE_WIDTH, height: DEFAULT_SLIDE_CAPTURE_HEIGHT };
}
const NOTES_PAGE_WIDTH_PT = 720;
const MAX_NOTES_PAGE_HEIGHT_PT = 900;

const DEFAULT_EXPORT_SCALE = 1.5;

/** PDF page size (pt) for meeting-notes page from captured canvas pixels and export scale. */
export function computeNotesPageSize(
  canvasWidth: number,
  canvasHeight: number,
  exportScale: number
): { pageW: number; pageH: number } {
  const pageW = NOTES_PAGE_WIDTH_PT * exportScale;
  const scaledMaxNotesHeight = MAX_NOTES_PAGE_HEIGHT_PT * exportScale;
  const pageH = Math.min((canvasHeight / canvasWidth) * pageW, scaledMaxNotesHeight);
  return { pageW, pageH };
}

const CAPTURE_OPTS = {
  scale: 2,
  useCORS: true,
  logging: false,
  backgroundColor: "#ffffff",
  allowTaint: false,
};

export type SlideLayoutProbe = {
  offsetParent: Element | null;
  offsetWidth: number;
  offsetHeight: number;
};

/** Skip page 2 capture when the element is missing or has no layout. */
export function shouldCaptureSlidePage2(
  el: SlideLayoutProbe | null | undefined
): boolean {
  if (!el) return false;
  if (el.offsetParent !== null) return true;
  return el.offsetWidth > 0 && el.offsetHeight > 0;
}

export type CaptureStatusReportToPdfOptions = {
  slideElement: HTMLElement;
  slidePage2Element?: HTMLElement | null;
  meetingNotesElement?: HTMLElement | null;
  planDetailElement?: HTMLElement | null;
  filename: string;
  /** Increase exported PDF "physical" size for easier presenting (100% zoom). */
  exportScale?: number;
};

/**
 * Captures the status report slide (and optional meeting notes) to a PDF
 * and triggers download. Uses the same DOM as the preview for pixel-perfect match.
 */
type PinnedSlideStyles = {
  width: string;
  height: string;
  minHeight: string;
  transform: string;
  transformOrigin: string;
  overflow: string;
};

function pinSlideForCapture(el: HTMLElement): PinnedSlideStyles {
  const orig: PinnedSlideStyles = {
    width: el.style.width,
    height: el.style.height,
    minHeight: el.style.minHeight,
    transform: el.style.transform,
    transformOrigin: el.style.transformOrigin,
    overflow: el.style.overflow,
  };
  const captureBox = resolveSlideCaptureBox(el);
  el.style.width = `${captureBox.width}px`;
  el.style.height = `${captureBox.height}px`;
  el.style.minHeight = `${captureBox.height}px`;
  el.style.transform = "none";
  el.style.transformOrigin = "top left";
  el.style.overflow = "hidden";
  return orig;
}

function restorePinnedSlide(el: HTMLElement, orig: PinnedSlideStyles) {
  el.style.width = orig.width;
  el.style.height = orig.height;
  el.style.minHeight = orig.minHeight;
  el.style.transform = orig.transform;
  el.style.transformOrigin = orig.transformOrigin;
  el.style.overflow = orig.overflow;
}

export async function captureStatusReportToPdf(
  options: CaptureStatusReportToPdfOptions
): Promise<void> {
  const {
    slideElement,
    slidePage2Element,
    meetingNotesElement,
    planDetailElement,
    filename,
  } = options;
  const exportScale =
    typeof options.exportScale === "number" && Number.isFinite(options.exportScale) && options.exportScale > 0
      ? options.exportScale
      : DEFAULT_EXPORT_SCALE;

  // Capture the full slide container so absolutely-positioned elements
  // (like the footer) are included. We temporarily disable transforms to
  // avoid html2canvas transform bugs.
  const slideTarget: HTMLElement = slideElement;
  const origSlide = pinSlideForCapture(slideTarget);

  // Optionally hide dashed border during capture for a cleaner PDF
  const slideHadCaptureAttr = slideElement.hasAttribute("data-capturing");
  slideElement.setAttribute("data-capturing", "true");

  const page2Target =
    slidePage2Element && shouldCaptureSlidePage2(slidePage2Element)
      ? slidePage2Element
      : null;
  const origPage2 = page2Target ? pinSlideForCapture(page2Target) : null;
  const page2HadCaptureAttr = page2Target?.hasAttribute("data-capturing") ?? false;
  page2Target?.setAttribute("data-capturing", "true");

  const notesTarget = meetingNotesElement ?? null;
  const origNotesWidth = notesTarget?.style.width ?? "";
  const origNotesMaxWidth = notesTarget?.style.maxWidth ?? "";
  const origNotesTransform = notesTarget?.style.transform ?? "";
  const origNotesTransformOrigin = notesTarget?.style.transformOrigin ?? "";
  const origNotesOverflow = notesTarget?.style.overflow ?? "";

  try {
    // html2canvas-pro supports oklch (Tailwind v4); load on demand to avoid SSR issues
    const [html2canvas, { jsPDF }] = await Promise.all([
      import("html2canvas-pro").then((m) => m.default),
      import("jspdf"),
    ]);

    // Ensure webfonts are actually loaded before capture.
    // `document.fonts.ready` alone can resolve before specific families are requested.
    await document.fonts.ready;
    try {
      await Promise.all([
        document.fonts.load('400 16px "Raleway"'),
        document.fonts.load('700 16px "Raleway"'),
        document.fonts.load('400 italic 16px "Raleway"'),
      ]);
    } catch {
      // Ignore; html2canvas will fall back to available fonts.
    }

    const slideCanvas = await html2canvas(slideTarget, CAPTURE_OPTS);

    const pageW = SLIDE_PDF_PAGE_WIDTH_PT * exportScale;
    const pageH = SLIDE_PDF_HEIGHT_PT * exportScale;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: [pageW, pageH],
    });

    const slideImgData = slideCanvas.toDataURL("image/png");
    pdf.addImage(slideImgData, "PNG", 0, 0, pageW, pageH);

    if (page2Target) {
      page2Target.scrollIntoView({ behavior: "instant", block: "start" });
      await new Promise((r) => requestAnimationFrame(r));
      const page2Canvas = await html2canvas(page2Target, CAPTURE_OPTS);
      pdf.addPage([pageW, pageH]);
      pdf.addImage(page2Canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
    }

    if (notesTarget && notesTarget.offsetParent !== null) {
      notesTarget.style.width = `${NOTES_PAGE_WIDTH_PT}px`;
      notesTarget.style.maxWidth = `${NOTES_PAGE_WIDTH_PT}px`;
      notesTarget.style.transform = "none";
      notesTarget.style.transformOrigin = "top left";
      notesTarget.style.overflow = "visible";

      notesTarget.scrollIntoView({ behavior: "instant", block: "start" });
      await new Promise((r) => requestAnimationFrame(r));

      const captureWidth = notesTarget.offsetWidth || NOTES_PAGE_WIDTH_PT;
      const captureHeight = notesTarget.scrollHeight || notesTarget.offsetHeight;
      const notesCanvas = await html2canvas(notesTarget, {
        ...CAPTURE_OPTS,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
      });

      const { pageW, pageH } = computeNotesPageSize(
        notesCanvas.width,
        notesCanvas.height,
        exportScale
      );

      // Custom [width, height] only — "portrait" swaps dimensions when width > height.
      pdf.addPage([pageW, pageH]);
      pdf.addImage(notesCanvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
    }

    const planPage = planDetailElement?.querySelector<HTMLElement>("[data-plan-print-page='chart']");
    if (planPage) {
      const planCanvas = await html2canvas(planPage, {
        ...CAPTURE_OPTS,
        width: planPage.offsetWidth || PLAN_PDF_PAGE_W_PT,
        height: planPage.offsetHeight || PLAN_PDF_PAGE_H_PT,
      });
      const planW = PLAN_PDF_PAGE_W_PT * exportScale;
      const planH = PLAN_PDF_PAGE_H_PT * exportScale;
      pdf.addPage([planW, planH]);
      pdf.addImage(planCanvas.toDataURL("image/png"), "PNG", 0, 0, planW, planH);
    }

    pdf.save(filename);
  } finally {
    restorePinnedSlide(slideTarget, origSlide);
    if (page2Target && origPage2) {
      restorePinnedSlide(page2Target, origPage2);
      if (!page2HadCaptureAttr) {
        page2Target.removeAttribute("data-capturing");
      }
    }
    if (notesTarget) {
      notesTarget.style.width = origNotesWidth;
      notesTarget.style.maxWidth = origNotesMaxWidth;
      notesTarget.style.transform = origNotesTransform;
      notesTarget.style.transformOrigin = origNotesTransformOrigin;
      notesTarget.style.overflow = origNotesOverflow;
    }
    if (!slideHadCaptureAttr) {
      slideElement.removeAttribute("data-capturing");
    }
  }
}

/** Sanitize a string for use in a filename (matches server PDF route convention). */
export function sanitizeForFilename(value: string): string {
  return value
    .replace(/[\s\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Project";
}
