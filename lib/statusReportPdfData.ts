import { prisma } from "@/lib/prisma";
import { computeBudgetRollups } from "@/lib/budgetCalculations";
import { getMonthsInRange, getMonthKeysForWeek } from "@/lib/monthUtils";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";

/** Snapshot of period, budget, CDA, and timeline at report creation so they stay locked when project is edited. */
export type StatusReportSnapshot = {
  period: string;
  today: string;
  budget?: StatusReportPDFData["budget"];
  cda?: StatusReportPDFData["cda"];
  timeline?: StatusReportPDFData["timeline"];
};

function isStatusReportSnapshot(obj: unknown): obj is StatusReportSnapshot {
  return (
    typeof obj === "object" &&
    obj != null &&
    "period" in obj &&
    typeof (obj as StatusReportSnapshot).period === "string" &&
    "today" in obj &&
    typeof (obj as StatusReportSnapshot).today === "string"
  );
}

export async function buildStatusReportPdfData(
  projectId: string,
  reportId: string
): Promise<StatusReportPDFData | null> {
  const report = await prisma.statusReport.findFirst({
    where: { id: reportId, projectId },
  });
  if (!report) return null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      budgetLines: true,
      assignments: { include: { role: true, person: true } },
      plannedHours: true,
      actualHours: true,
      actualHoursMonthSplits: true,
      projectKeyRoles: { include: { person: true } },
      cdaMonths: true,
      cdaMilestones: true,
      timelineBars: true,
      timelineMarkers: true,
    },
  });
  if (!project) return null;

  const snapshot = isStatusReportSnapshot(report.snapshot) ? report.snapshot : null;

  let period: string;
  let today: string;
  if (snapshot) {
    period = snapshot.period;
    today = snapshot.today;
  } else {
    const reportDate = new Date(report.reportDate);
    reportDate.setHours(0, 0, 0, 0);
    today = reportDate.toLocaleDateString("en-US", { dateStyle: "medium" });
    const dayOfWeek = reportDate.getDay();
    const daysToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(reportDate);
    thisMonday.setDate(reportDate.getDate() - daysToThisMonday);
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);
    const prevFriday = new Date(prevMonday);
    prevFriday.setDate(prevMonday.getDate() + 4);
    period = `${prevMonday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${prevFriday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  let budget: StatusReportPDFData["budget"] | undefined;
  let cda: StatusReportPDFData["cda"] | undefined;
  let timeline: StatusReportPDFData["timeline"] | undefined;

  if (snapshot?.budget !== undefined) {
    budget = snapshot.budget;
  }
  if (snapshot?.cda !== undefined) {
    cda = snapshot.cda;
  }
  if (snapshot?.timeline !== undefined) {
    timeline = snapshot.timeline;
  }

  if (budget === undefined || (report.variation === "CDA" && cda === undefined)) {
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
    if (budget === undefined) {
      budget = {
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
    }

    if (report.variation === "CDA" && cda === undefined) {
      const months = getMonthsInRange(project.startDate, end);
      const byKey = new Map(
        (project.cdaMonths ?? []).map((m) => [
          m.monthKey,
          { planned: Number(m.planned), mtdActuals: Number(m.mtdActuals) },
        ])
      );
      const resourcingByMonth = new Map<string, number>();
      const splits = project.actualHoursMonthSplits ?? [];
      for (const s of splits) {
        const monthKey = s.monthKey;
        resourcingByMonth.set(monthKey, (resourcingByMonth.get(monthKey) ?? 0) + Number(s.hours));
      }
      const weekHasSplits = new Set(splits.map((s) => `${s.personId}:${(s.weekStartDate as Date).toISOString().slice(0, 10)}`));
      for (const ah of project.actualHours ?? []) {
        if (ah.hours == null) continue;
        const weekKey = (ah.weekStartDate as Date).toISOString().slice(0, 10);
        if (weekHasSplits.has(`${ah.personId}:${weekKey}`)) continue;
        const monthKeys = getMonthKeysForWeek(ah.weekStartDate as Date);
        if (monthKeys.length === 1) {
          const monthKey = monthKeys[0]!;
          resourcingByMonth.set(monthKey, (resourcingByMonth.get(monthKey) ?? 0) + Number(ah.hours));
        }
      }
      const rows = months.map(({ monthKey, label }) => {
        const data = byKey.get(monthKey);
        const fromResourcing = resourcingByMonth.get(monthKey) ?? 0;
        return {
          monthKey,
          monthLabel: label,
          planned: data != null ? Number(data.planned) : 0,
          mtdActuals: data != null ? Number(data.mtdActuals) : fromResourcing,
        };
      });
      const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
      const totalMtdActuals = rows.reduce((s, r) => s + r.mtdActuals, 0);
      const toIso = (d: Date | null) =>
        d ? d.toISOString().slice(0, 10) : "";
      const milestones = (project.cdaMilestones ?? [])
        .sort((a, b) => {
          const ta = a.devStartDate
            ? new Date(a.devStartDate).getTime()
            : Number.MAX_SAFE_INTEGER;
          const tb = b.devStartDate
            ? new Date(b.devStartDate).getTime()
            : Number.MAX_SAFE_INTEGER;
          return ta - tb;
        })
        .map((m) => ({
          id: m.id,
          phase: m.phase,
          devStartDate: toIso(m.devStartDate),
          devEndDate: toIso(m.devEndDate),
          uatStartDate: toIso(m.uatStartDate),
          uatEndDate: toIso(m.uatEndDate),
          deployDate: toIso(m.deployDate),
          completed: m.completed,
        }));
      cda = {
        rows,
        overallBudget: { totalDollars: estBudgetHigh, actualDollars: rollups.actualDollarsToDate },
        totalPlanned,
        totalMtdActuals,
        totalRemaining: totalPlanned - totalMtdActuals,
        milestones,
      };
    }
  }

  if (timeline === undefined && project.endDate != null) {
    const startStr = project.startDate.toISOString().slice(0, 10);
    const endStr = project.endDate.toISOString().slice(0, 10);
    const bars = (project.timelineBars ?? [])
      .sort((a, b) => a.rowIndex - b.rowIndex || a.startDate.getTime() - b.startDate.getTime())
      .map((b) => ({
        rowIndex: b.rowIndex,
        label: b.label,
        startDate: b.startDate.toISOString().slice(0, 10),
        endDate: b.endDate.toISOString().slice(0, 10),
      }));
    const markers = (project.timelineMarkers ?? [])
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((m) => ({
        label: m.label,
        date: m.date.toISOString().slice(0, 10),
        shape: m.shape,
        rowIndex: m.rowIndex,
      }));
    timeline = { startDate: startStr, endDate: endStr, bars, markers };
  }

  return {
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
    timeline,
  };
}
