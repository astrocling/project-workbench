import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth.config";
import { getProjectId } from "@/lib/slug";
import { buildStatusReportPdfData } from "@/lib/statusReportPdfData";
import { StatusReportView } from "@/components/StatusReportView";

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
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-3">
        <Link
          href={`/projects/${slug}?tab=status-reports`}
          className="text-body-sm font-medium text-jblue-600 hover:text-jblue-700 dark:text-jblue-400"
        >
          ← Back to project
        </Link>
        <a
          href={`/api/projects/${slug}/status-reports/${reportId}/pdf?download=1`}
          download
          className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white text-body-sm font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
        >
          Download PDF
        </a>
      </div>
      <div className="py-6">
        <StatusReportView data={pdfData} />
      </div>
    </div>
  );
}
