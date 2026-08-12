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
      { error: "This report has no stored snapshot. Budget cannot be refreshed." },
      { status: 400 }
    );
  }

  if (report.variation === "Modular") {
    return NextResponse.json(
      { error: "Modular reports do not use the project budget snapshot." },
      { status: 400 }
    );
  }

  const existingSnapshot: StatusReportSnapshot = report.snapshot;

  const pdfData = await buildStatusReportPdfData(projectId, reportId, {
    rebuildBudgetFromProject: true,
  });
  if (!pdfData) {
    return NextResponse.json({ error: "Failed to build report data" }, { status: 500 });
  }
  if (!pdfData.budget) {
    return NextResponse.json(
      {
        error:
          "Could not compute budget for this report. Add budget lines on the Budget tab, then try again.",
      },
      { status: 400 }
    );
  }

  const nextSnapshot: StatusReportSnapshot = {
    ...existingSnapshot,
    budget: pdfData.budget,
  };

  // Keep CDA overall dollar row in sync when refreshing budget on a CDA report
  if (report.variation === "CDA" && existingSnapshot.cda) {
    nextSnapshot.cda = {
      ...existingSnapshot.cda,
      overallBudget: {
        totalDollars: pdfData.budget.estBudgetHigh,
        actualDollars: pdfData.budget.spentDollars,
      },
    };
  }

  await prisma.statusReport.update({
    where: { id: reportId },
    data: { snapshot: nextSnapshot as Prisma.InputJsonValue },
  });
  await deleteCachedPdf(reportId);
  revalidateTag(`status-report-${reportId}`, "default");

  return NextResponse.json({ ok: true });
}
