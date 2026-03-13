import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getCachedStatusReportPdfData } from "@/lib/statusReportPdfData";
import { StatusReportPageContent } from "@/components/StatusReportPageContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const report = await prisma.statusReport.findUnique({
    where: { id: reportId },
    include: { project: { select: { name: true } } },
  });
  if (!report) return { title: "Status Report" };
  return {
    title: `Status Report — ${report.project.name}`,
  };
}

export default async function ReportPermalinkPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { reportId } = await params;

  const report = await prisma.statusReport.findUnique({
    where: { id: reportId },
    include: { project: { select: { slug: true } } },
  });
  if (!report) notFound();

  const pdfData = await getCachedStatusReportPdfData(report.projectId, reportId);
  if (!pdfData) notFound();

  return (
    <StatusReportPageContent
      pdfData={pdfData}
      slug={report.project.slug}
      reportId={reportId}
      shareView
    />
  );
}
