/**
 * Registers Raleway fonts for StatusReportDocument.
 * Call this before rendering the document. Use a file-system path on the server
 * (e.g. path.join(process.cwd(), "node_modules/@fontsource/raleway/files"))
 * and a URL base on the client (e.g. "/fonts" with fonts in public/fonts/).
 * Only registers once per baseUrl per process to avoid duplicate work.
 */
import { Font } from "@react-pdf/renderer";

let fontsRegisteredForBase: string | null = null;

export function registerStatusReportFonts(baseUrl: string): void {
  const base = baseUrl.replace(/\/$/, "");
  if (fontsRegisteredForBase === base) return;
  fontsRegisteredForBase = base;
  Font.register({
    family: "Raleway",
    fonts: [
      {
        src: `${base}/raleway-latin-400-normal.woff`,
        fontWeight: 400,
      },
      {
        src: `${base}/raleway-latin-700-normal.woff`,
        fontWeight: 700,
      },
      {
        src: `${base}/raleway-latin-400-italic.woff`,
        fontWeight: 400,
        fontStyle: "italic",
      },
    ],
  });
}
