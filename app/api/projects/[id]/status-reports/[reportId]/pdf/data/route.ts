import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getProjectId } from "@/lib/slug";
import { buildStatusReportPdfData } from "@/lib/statusReportPdfData";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug, reportId } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdfData = await unstable_cache(
    () => buildStatusReportPdfData(projectId, reportId),
    ["status-report-pdf-data", reportId],
    { revalidate: 60, tags: [`status-report-${reportId}`] }
  )();
  if (!pdfData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(pdfData);
}
