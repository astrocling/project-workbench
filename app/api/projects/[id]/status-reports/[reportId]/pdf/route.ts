import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { computeBudgetRollups } from "@/lib/budgetCalculations";
import { getMonthsInRange } from "@/lib/monthUtils";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StatusReportDocument } from "@/components/pdf/StatusReportDocument";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug, reportId } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = await prisma.statusReport.findFirst({
    where: { id: reportId, projectId },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      budgetLines: true,
      assignments: { include: { role: true, person: true } },
      plannedHours: true,
      actualHours: true,
      projectKeyRoles: { include: { person: true } },
      cdaMonths: true,
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reportDate = new Date(report.reportDate);
  reportDate.setHours(0, 0, 0, 0);
  const today = reportDate.toLocaleDateString("en-US", { dateStyle: "medium" });

  // Period = Monday–Friday of the week before the report date
  const dayOfWeek = reportDate.getDay(); // 0 Sun .. 6 Sat
  const daysToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(reportDate);
  thisMonday.setDate(reportDate.getDate() - daysToThisMonday);
  const prevMonday = new Date(thisMonday);
  prevMonday.setDate(thisMonday.getDate() - 7);
  const prevFriday = new Date(prevMonday);
  prevFriday.setDate(prevMonday.getDate() + 4);
  const period = `${prevMonday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${prevFriday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const singleRate =
    project.useSingleRate && project.singleBillRate != null
      ? Number(project.singleBillRate)
      : null;
  const rateByRole = new Map<string, number>();
  for (const a of project.assignments) {
    const override = a.billRateOverride ? Number(a.billRateOverride) : null;
    if (override != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, override);
    } else if (singleRate != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, singleRate);
    } else {
      const prr = await prisma.projectRoleRate.findUnique({
        where: {
          projectId_roleId: { projectId, roleId: a.roleId },
        },
      });
      rateByRole.set(`${a.personId}-${a.roleId}`, prr ? Number(prr.billRate) : 0);
    }
  }

  const { getAllWeeks } = await import("@/lib/weekUtils");
  const end = project.endDate ?? new Date();
  const allWeeks = getAllWeeks(project.startDate, end);
  const weeklyRows: Array<{
    weekStartDate: Date;
    plannedHours: number;
    actualHours: number | null;
    rate: number;
  }> = [];

  for (const a of project.assignments) {
    const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
    for (const weekDate of allWeeks) {
      const wk = weekDate.toISOString().slice(0, 10);
      const planned = project.plannedHours.find(
        (ph) =>
          ph.personId === a.personId &&
          ph.weekStartDate.toISOString().slice(0, 10) === wk
      );
      const actual = project.actualHours.find(
        (ah) =>
          ah.personId === a.personId &&
          ah.weekStartDate.toISOString().slice(0, 10) === wk
      );
      weeklyRows.push({
        weekStartDate: new Date(weekDate),
        plannedHours: planned ? Number(planned.hours) : 0,
        actualHours: actual?.hours != null ? Number(actual.hours) : null,
        rate,
      });
    }
  }

  const budgetLines = project.budgetLines.map((bl) => ({
    lowHours: Number(bl.lowHours),
    highHours: Number(bl.highHours),
    lowDollars: Number(bl.lowDollars),
    highDollars: Number(bl.highDollars),
  }));

  const rollups = computeBudgetRollups(
    project.startDate,
    project.endDate,
    weeklyRows,
    budgetLines
  );

  const estBudgetHigh = project.budgetLines.reduce((s, bl) => s + Number(bl.highDollars), 0);
  const estBudgetLow = project.budgetLines.reduce((s, bl) => s + Number(bl.lowDollars), 0);
  const budgetedHoursHigh = project.budgetLines.reduce((s, bl) => s + Number(bl.highHours), 0);
  const budgetedHoursLow = project.budgetLines.reduce((s, bl) => s + Number(bl.lowHours), 0);
  const budget = {
    estBudgetHigh,
    estBudgetLow,
    spentDollars: rollups.actualDollarsToDate,
    remainingDollarsHigh: rollups.remainingDollarsHigh,
    remainingDollarsLow: rollups.remainingDollarsLow,
    budgetedHoursHigh,
    budgetedHoursLow,
    actualHours: rollups.actualHoursToDate,
    remainingHoursHigh: rollups.remainingHoursHigh,
    remainingHoursLow: rollups.remainingHoursLow,
    burnPercentHigh: rollups.burnPercentHighDollars,
  };

  let cda: StatusReportPDFData["cda"] | undefined;
  if (report.variation === "CDA" && project.cdaMonths) {
    const months = getMonthsInRange(project.startDate, end);
    const byKey = new Map(
      project.cdaMonths.map((m) => [
        m.monthKey,
        { planned: Number(m.planned), mtdActuals: Number(m.mtdActuals) },
      ])
    );
    const rows = months.map(({ monthKey, label }) => {
      const data = byKey.get(monthKey) ?? { planned: 0, mtdActuals: 0 };
      return {
        monthKey,
        monthLabel: label,
        planned: data.planned,
        mtdActuals: data.mtdActuals,
      };
    });
    const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
    const totalMtdActuals = rows.reduce((s, r) => s + r.mtdActuals, 0);
    cda = {
      rows,
      overallBudget: { totalDollars: estBudgetHigh, actualDollars: rollups.actualDollarsToDate },
      totalPlanned,
      totalMtdActuals,
      totalRemaining: totalPlanned - totalMtdActuals,
    };
  }

  const pdfData: StatusReportPDFData = {
    report: {
      reportDate: report.reportDate.toISOString().slice(0, 10),
      variation: report.variation,
      completedActivities: report.completedActivities,
      upcomingActivities: report.upcomingActivities,
      risksIssuesDecisions: report.risksIssuesDecisions,
      meetingNotes: report.meetingNotes,
      ragOverall: report.ragOverall,
      ragScope: report.ragScope,
      ragSchedule: report.ragSchedule,
      ragBudget: report.ragBudget,
      ragOverallExplanation: report.ragOverallExplanation,
      ragScopeExplanation: report.ragScopeExplanation,
      ragScheduleExplanation: report.ragScheduleExplanation,
      ragBudgetExplanation: report.ragBudgetExplanation,
    },
    project: {
      name: project.name,
      clientName: project.clientName,
      clientSponsor: project.clientSponsor,
      clientSponsor2: project.clientSponsor2,
      otherContact: project.otherContact,
      keyStaffName: project.keyStaffName,
      projectKeyRoles: project.projectKeyRoles.map((kr) => ({
        type: kr.type,
        person: { name: kr.person.name },
      })),
    },
    period,
    today,
    budget: report.variation === "Standard" || report.variation === "Milestones" ? budget : undefined,
    cda,
  };

  const element = React.createElement(StatusReportDocument, { data: pdfData });
  // renderToBuffer is typed for Document root; our component renders Document internally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="status-report-${report.reportDate.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
