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
};

/**
 * Captures the status report slide (and optional meeting notes) to a PDF
 * and triggers download. Uses the same DOM as the preview for pixel-perfect match.
 */
export async function captureStatusReportToPdf(
  options: CaptureStatusReportToPdfOptions
): Promise<void> {
  const { slideElement, meetingNotesElement, filename } = options;

  // Capture the inner content div (no transform) to avoid html2canvas transform bugs
  const slideTarget: HTMLElement =
    (slideElement.firstElementChild as HTMLElement) || slideElement;

  // Ensure explicit dimensions for capture (inner div may not have them in some layouts)
  const origWidth = slideTarget.style.width;
  const origHeight = slideTarget.style.height;
  const origMinHeight = slideTarget.style.minHeight;
  slideTarget.style.width = "720px";
  slideTarget.style.height = "405px";
  slideTarget.style.minHeight = "405px";

  // Optionally hide dashed border during capture for a cleaner PDF
  const slideHadCaptureAttr = slideElement.hasAttribute("data-capturing");
  slideElement.setAttribute("data-capturing", "true");

  try {
    // html2canvas-pro supports oklch (Tailwind v4); load on demand to avoid SSR issues
    const [html2canvas, { jsPDF }] = await Promise.all([
      import("html2canvas-pro").then((m) => m.default),
      import("jspdf"),
    ]);

    await document.fonts.ready;

    const slideCanvas = await html2canvas(slideTarget, CAPTURE_OPTS);

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: [SLIDE_WIDTH_PT, SLIDE_HEIGHT_PT],
    });

    const slideImgData = slideCanvas.toDataURL("image/png");
    pdf.addImage(slideImgData, "PNG", 0, 0, SLIDE_WIDTH_PT, SLIDE_HEIGHT_PT);

    if (meetingNotesElement && meetingNotesElement.offsetParent !== null) {
      meetingNotesElement.scrollIntoView({ behavior: "instant", block: "start" });
      await new Promise((r) => requestAnimationFrame(r));
      const notesCanvas = await html2canvas(meetingNotesElement, CAPTURE_OPTS);
      const notesHeight = Math.min(
        (notesCanvas.height / notesCanvas.width) * NOTES_PAGE_WIDTH_PT,
        MAX_NOTES_PAGE_HEIGHT_PT
      );
      pdf.addPage([NOTES_PAGE_WIDTH_PT, notesHeight], "portrait");
      pdf.addImage(
        notesCanvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        NOTES_PAGE_WIDTH_PT,
        notesHeight
      );
    }

    pdf.save(filename);
  } finally {
    slideTarget.style.width = origWidth;
    slideTarget.style.height = origHeight;
    slideTarget.style.minHeight = origMinHeight;
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
