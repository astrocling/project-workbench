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
  type StatusReportSnapshot,
} from "@/lib/statusReportPdfData";
import { modularNeedsPlanLists, normalizeModularPanels } from "@/lib/reportPanels";
import { mergePlanListsIntoSnapshot } from "@/lib/plan/reportLists";

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

  if (report.variation !== "Modular") {
    return NextResponse.json(
      { error: "Plan lists can only be refreshed on Modular reports." },
      { status: 400 }
    );
  }

  if (!isStatusReportSnapshot(report.snapshot)) {
    return NextResponse.json(
      { error: "This report has no stored snapshot. Plan lists cannot be refreshed." },
      { status: 400 }
    );
  }

  if (!modularNeedsPlanLists(normalizeModularPanels(report.panels))) {
    return NextResponse.json(
      { error: "This Modular report has no Plan list module." },
      { status: 400 }
    );
  }

  const existingSnapshot: StatusReportSnapshot = report.snapshot;

  const pdfData = await buildStatusReportPdfData(projectId, reportId, {
    rebuildPlanListsFromProject: true,
  });
  if (!pdfData) {
    return NextResponse.json({ error: "Failed to build report data" }, { status: 500 });
  }

  const nextSnapshot = mergePlanListsIntoSnapshot(existingSnapshot, {
    planMeetings: pdfData.planMeetings ?? { needsScheduling: [], scheduled: [] },
    planActivitiesCompleted: pdfData.planActivitiesCompleted ?? {
      items: [],
      overflowCount: 0,
    },
    planActivitiesUpcoming: pdfData.planActivitiesUpcoming ?? {
      items: [],
      overflowCount: 0,
    },
  });

  await prisma.statusReport.update({
    where: { id: reportId },
    data: { snapshot: nextSnapshot as Prisma.InputJsonValue },
  });
  await deleteCachedPdf(reportId);
  revalidateTag(`status-report-${reportId}`, "default");

  return NextResponse.json({ ok: true });
}
