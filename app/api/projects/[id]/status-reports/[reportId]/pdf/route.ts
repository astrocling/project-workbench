import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getProjectId } from "@/lib/slug";
import { buildStatusReportPdfData } from "@/lib/statusReportPdfData";
import { registerStatusReportFonts } from "@/lib/statusReportFonts";
import { getCachedPdf, setCachedPdf } from "@/lib/statusReportPdfCache";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StatusReportDocument } from "@/components/pdf/StatusReportDocument";

/** Sanitize a string for use in a filename: remove/replace unsafe characters. */
function sanitizeForFilename(value: string): string {
  return value
    .replace(/[\s\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Project";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug, reportId } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let buffer: Uint8Array;
  let pdfData: Awaited<ReturnType<typeof buildStatusReportPdfData>> = null;
  const cached = await getCachedPdf(reportId);
  if (cached) {
    buffer = cached;
  } else {
    pdfData = await buildStatusReportPdfData(projectId, reportId);
    if (!pdfData) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const serverFontPath = path.join(
      process.cwd(),
      "node_modules/@fontsource/raleway/files"
    );
    registerStatusReportFonts(serverFontPath);

    const element = React.createElement(StatusReportDocument, { data: pdfData });
    // renderToBuffer is typed for Document root; our component renders Document internally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rendered = await renderToBuffer(element as any);
    buffer = new Uint8Array(rendered);
    await setCachedPdf(reportId, buffer);
  }

  const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  let filename = "status-report.pdf";
  if (disposition === "attachment") {
    const meta = pdfData ?? (await buildStatusReportPdfData(projectId, reportId));
    if (meta) {
      const reportDate = meta.report.reportDate;
      const safeProjectName = sanitizeForFilename(meta.project.name);
      filename = `Status Report - ${safeProjectName} - ${reportDate}.pdf`;
    }
  }
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, '\\"')}"`,
    },
  });
}
