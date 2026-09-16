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
  resolvePlanDensity,
  resolveScheduleSource,
  type StatusReportSnapshot,
} from "@/lib/statusReportPdfData";
import { isPlanTabEnabled } from "@/lib/plan/feature";
import {
  PLAN_NOT_ENABLED_ERROR,
  resolveScheduleRebuildError,
} from "@/lib/plan/reportScheduleErrors";
import { timelineLayoutMaxRow } from "@/lib/plan/reportSchedule";
import { isValidPlanTimeline } from "@/lib/statusReportScheduleBuild";
import { pruneTimelineLayout } from "@/lib/statusReportTimelineLayout";
import { modularNeedsTimeline, normalizeModularPanels } from "@/lib/reportPanels";

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

  if (
    report.variation === "Modular" &&
    !modularNeedsTimeline(normalizeModularPanels(report.panels))
  ) {
    return NextResponse.json(
      { error: "This Modular report has no timeline module." },
      { status: 400 }
    );
  }

  const existingSnapshot: StatusReportSnapshot = report.snapshot;
  const scheduleSource = resolveScheduleSource(existingSnapshot);
  const planDensity = resolvePlanDensity(existingSnapshot);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { planEnabled: true, endDate: true },
  });
  if (scheduleSource === "plan" && !isPlanTabEnabled(project?.planEnabled)) {
    return NextResponse.json({ error: PLAN_NOT_ENABLED_ERROR }, { status: 400 });
  }

  const pdfData = await buildStatusReportPdfData(projectId, reportId, {
    rebuildTimelineFromProject: true,
    applyTimelineLayoutOverlay: false,
  });
  if (!pdfData) {
    return NextResponse.json({ error: "Failed to build report data" }, { status: 500 });
  }

  const hasProjectEndDate = project?.endDate != null;
  // Plan needs a renderable schedule; legacy timeline refresh retains prior semantics
  // (a timeline is built whenever the project has an end date, with no visible-schedule gate).
  const rebuiltSchedule =
    scheduleSource === "plan"
      ? isValidPlanTimeline(pdfData.timeline, timelineLayoutMaxRow(report.variation))
      : pdfData.timeline != null;

  if (!rebuiltSchedule) {
    return NextResponse.json(
      { error: resolveScheduleRebuildError(scheduleSource, { hasProjectEndDate, planDensity }) },
      { status: 400 }
    );
  }

  if (!pdfData.timeline) {
    return NextResponse.json(
      { error: resolveScheduleRebuildError(scheduleSource, { hasProjectEndDate, planDensity }) },
      { status: 400 }
    );
  }

  const nextSnapshot: StatusReportSnapshot = {
    ...existingSnapshot,
    timeline: pdfData.timeline,
    timelineLayout: pruneTimelineLayout(existingSnapshot.timelineLayout, {
      bars: pdfData.timeline.bars,
      markers: pdfData.timeline.markers,
    }),
  };

  await prisma.statusReport.update({
    where: { id: reportId },
    data: { snapshot: nextSnapshot as Prisma.InputJsonValue },
  });
  await deleteCachedPdf(reportId);
  revalidateTag(`status-report-${reportId}`, "default");

  return NextResponse.json({ ok: true });
}
