import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { deleteCachedPdf } from "@/lib/statusReportPdfCache";
import {
  buildStatusReportPdfData,
  isStatusReportSnapshot,
  resolveScheduleSource,
  type StatusReportSnapshot,
} from "@/lib/statusReportPdfData";
import { isPlanTabEnabled } from "@/lib/plan/feature";
import {
  PLAN_NOT_ENABLED_ERROR,
  resolveScheduleRebuildError,
} from "@/lib/plan/reportScheduleErrors";
import { timelineHasVisibleSchedule } from "@/lib/plan/reportSchedule";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, reportId } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = await prisma.statusReport.findFirst({
    where: { id: reportId, projectId },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isStatusReportSnapshot(report.snapshot)) {
    return NextResponse.json(
      { error: "This report has no stored snapshot. Timeline cannot be refreshed." },
      { status: 400 }
    );
  }

  const existingSnapshot: StatusReportSnapshot = report.snapshot;
  const scheduleSource = resolveScheduleSource(existingSnapshot);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { planEnabled: true, endDate: true },
  });
  if (scheduleSource === "plan" && !isPlanTabEnabled(project?.planEnabled)) {
    return NextResponse.json({ error: PLAN_NOT_ENABLED_ERROR }, { status: 400 });
  }

  const pdfData = await buildStatusReportPdfData(projectId, reportId, {
    rebuildTimelineFromProject: true,
  });
  if (!pdfData) {
    return NextResponse.json({ error: "Failed to build report data" }, { status: 500 });
  }

  const hasProjectEndDate = project?.endDate != null;
  const hasVisibleTimeline =
    pdfData.timeline != null && timelineHasVisibleSchedule(pdfData.timeline);

  if (!hasVisibleTimeline) {
    const errorMessage = resolveScheduleRebuildError(scheduleSource, {
      hasProjectEndDate,
    });
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  const nextSnapshot: StatusReportSnapshot = {
    ...existingSnapshot,
    timeline: pdfData.timeline,
  };

  await prisma.statusReport.update({
    where: { id: reportId },
    data: { snapshot: nextSnapshot as Prisma.InputJsonValue },
  });
  await deleteCachedPdf(reportId);
  revalidateTag(`status-report-${reportId}`, "default");

  return NextResponse.json({ ok: true });
}
