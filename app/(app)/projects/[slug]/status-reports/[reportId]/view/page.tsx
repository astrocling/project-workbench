import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth.config";
import { getProjectId } from "@/lib/slug";
import { buildStatusReportPdfData } from "@/lib/statusReportPdfData";
import { StatusReportPageContent } from "@/components/StatusReportPageContent";

export default async function StatusReportViewPage({
  params,
}: {
  params: Promise<{ slug: string; reportId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { slug, reportId } = await params;
  const projectId = await getProjectId(slug);
  if (!projectId) notFound();

  const pdfData = await buildStatusReportPdfData(projectId, reportId);
  if (!pdfData) notFound();

  return (
    <StatusReportPageContent
      pdfData={pdfData}
      slug={slug}
      reportId={reportId}
    />
  );
}
