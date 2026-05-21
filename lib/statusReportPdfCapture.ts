/**
 * Client-side capture of StatusReportView DOM to PDF.
 * Use from "use client" components only. Ensures the downloaded PDF
 * matches exactly what is shown in the preview (same DOM).
 * Uses html2canvas-pro (supports oklch/Tailwind v4) and dynamic import for jsPDF.
 */

const SLIDE_WIDTH_PT = 720;
const SLIDE_HEIGHT_PT = 405; // 16:9
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

export type CaptureStatusReportToPdfOptions = {
  slideElement: HTMLElement;
  meetingNotesElement?: HTMLElement | null;
  filename: string;
  /** Increase exported PDF "physical" size for easier presenting (100% zoom). */
  exportScale?: number;
};

/**
 * Captures the status report slide (and optional meeting notes) to a PDF
 * and triggers download. Uses the same DOM as the preview for pixel-perfect match.
 */
export async function captureStatusReportToPdf(
  options: CaptureStatusReportToPdfOptions
): Promise<void> {
  const { slideElement, meetingNotesElement, filename } = options;
  const exportScale =
    typeof options.exportScale === "number" && Number.isFinite(options.exportScale) && options.exportScale > 0
      ? options.exportScale
      : DEFAULT_EXPORT_SCALE;

  // Capture the full slide container so absolutely-positioned elements
  // (like the footer) are included. We temporarily disable transforms to
  // avoid html2canvas transform bugs.
  const slideTarget: HTMLElement = slideElement;

  // Ensure explicit dimensions for capture (inner div may not have them in some layouts)
  const origWidth = slideTarget.style.width;
  const origHeight = slideTarget.style.height;
  const origMinHeight = slideTarget.style.minHeight;
  const origTransform = slideTarget.style.transform;
  const origTransformOrigin = slideTarget.style.transformOrigin;
  const origOverflow = slideTarget.style.overflow;
  // Keep the DOM at its native layout size for capture so fonts/spacing match preview.
  // We scale the exported PDF page and image placement instead.
  slideTarget.style.width = `${SLIDE_WIDTH_PT}px`;
  slideTarget.style.height = `${SLIDE_HEIGHT_PT}px`;
  slideTarget.style.minHeight = `${SLIDE_HEIGHT_PT}px`;
  slideTarget.style.transform = "none";
  slideTarget.style.transformOrigin = "top left";
  slideTarget.style.overflow = "hidden";

  // Optionally hide dashed border during capture for a cleaner PDF
  const slideHadCaptureAttr = slideElement.hasAttribute("data-capturing");
  slideElement.setAttribute("data-capturing", "true");

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

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: [SLIDE_WIDTH_PT * exportScale, SLIDE_HEIGHT_PT * exportScale],
    });

    const slideImgData = slideCanvas.toDataURL("image/png");
    pdf.addImage(
      slideImgData,
      "PNG",
      0,
      0,
      SLIDE_WIDTH_PT * exportScale,
      SLIDE_HEIGHT_PT * exportScale
    );

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

    pdf.save(filename);
  } finally {
    slideTarget.style.width = origWidth;
    slideTarget.style.height = origHeight;
    slideTarget.style.minHeight = origMinHeight;
    slideTarget.style.transform = origTransform;
    slideTarget.style.transformOrigin = origTransformOrigin;
    slideTarget.style.overflow = origOverflow;
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
