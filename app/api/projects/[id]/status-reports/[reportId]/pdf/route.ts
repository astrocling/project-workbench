import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getProjectId } from "@/lib/slug";
import { buildStatusReportPdfData } from "@/lib/statusReportPdfData";
import { registerStatusReportFonts } from "@/lib/statusReportFonts";
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

  const pdfData = await buildStatusReportPdfData(projectId, reportId);
  if (!pdfData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const serverFontPath = path.join(
    process.cwd(),
    "node_modules/@fontsource/raleway/files"
  );
  registerStatusReportFonts(serverFontPath);

  const element = React.createElement(StatusReportDocument, { data: pdfData });
  // renderToBuffer is typed for Document root; our component renders Document internally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const reportDate = pdfData.report.reportDate;
  const safeProjectName = sanitizeForFilename(pdfData.project.name);
  const filename = `Status Report - ${safeProjectName} - ${reportDate}.pdf`;
  const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, '\\"')}"`,
    },
  });
}
