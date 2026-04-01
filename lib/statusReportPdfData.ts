import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeBudgetRollups } from "@/lib/budgetCalculations";
import { buildCdaRowsForProject } from "@/lib/cdaMtdFromResourcing";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";

const CACHE_KEY = "status-report-pdf-data";
const CACHE_REVALIDATE = 60;

/**
 * Returns status report PDF/view data with Next.js cache (60s revalidate, tag per report).
 * Use for view page, share page, and pdf/data API so they share one cached build per report.
 * For report create (snapshot build) call buildStatusReportPdfData directly so cache is not used.
 */
export async function getCachedStatusReportPdfData(
  projectId: string,
  reportId: string
): Promise<StatusReportPDFData | null> {
  return unstable_cache(
    () => buildStatusReportPdfData(projectId, reportId),
    [CACHE_KEY, reportId],
    { revalidate: CACHE_REVALIDATE, tags: [`status-report-${reportId}`] }
  )();
}

/** Snapshot of period, budget, CDA, and timeline at report creation so they stay locked when project is edited. */
export type StatusReportSnapshot = {
  period: string;
  today: string;
  budget?: StatusReportPDFData["budget"];
  cda?: StatusReportPDFData["cda"];
  timeline?: StatusReportPDFData["timeline"];
  /** Number of months before report date to show on timeline (1–4). */
  timelinePreviousMonths?: number;
  /** Locked at report creation: hide CDA budget dollars on Overall table. */
  cdaReportHoursOnly?: boolean;
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

export type BuildStatusReportPdfDataOptions = {
  /** Number of months before report date to show on timeline (1–4). Used when creating a new report before snapshot exists. */
  timelinePreviousMonths?: number;
};

export async function buildStatusReportPdfData(
  projectId: string,
  reportId: string,
  options?: BuildStatusReportPdfDataOptions
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
    // Always apply "months before" from snapshot so the displayed range is correct
    const prevMonths =
      typeof snapshot.timelinePreviousMonths === "number" &&
      snapshot.timelinePreviousMonths >= 1 &&
      snapshot.timelinePreviousMonths <= 4
        ? snapshot.timelinePreviousMonths
        : null;
    if (prevMonths != null) {
      const reportDate = new Date(report.reportDate);
      const minStartDate = new Date(
        Date.UTC(
          reportDate.getUTCFullYear(),
          reportDate.getUTCMonth() - prevMonths,
          1
        )
      );
      const minStartStr = minStartDate.toISOString().slice(0, 10);
      const projectStartStr = project.startDate.toISOString().slice(0, 10);
      const effectiveStartStr =
        projectStartStr < minStartStr ? minStartStr : projectStartStr;
      timeline = { ...timeline, startDate: effectiveStartStr };
    }
    // Ensure bar colors are present (snapshots created before color existed may lack them)
    if (timeline && (project.timelineBars ?? []).length > 0) {
      const barKey = (b: { rowIndex: number; label: string; startDate: string; endDate: string }) =>
        `${b.rowIndex}|${b.label}|${b.startDate}|${b.endDate}`;
      const colorByKey = new Map(
        project.timelineBars!.map((b) => [
          barKey({
            rowIndex: b.rowIndex,
            label: b.label,
            startDate: b.startDate.toISOString().slice(0, 10),
            endDate: b.endDate.toISOString().slice(0, 10),
          }),
          b.color ?? null,
        ])
      );
      timeline = {
        ...timeline,
        bars: timeline.bars.map((bar) => ({
          ...bar,
          color: bar.color ?? colorByKey.get(barKey(bar)) ?? null,
        })),
      };
    }
  }

  if (budget === undefined || (report.variation === "CDA" && cda === undefined)) {
    const singleRate =
      project.useSingleRate && project.singleBillRate != null
        ? Number(project.singleBillRate)
        : null;
    const rateByRole = new Map<string, number>();
    const roleIdsNeedingRate = new Set<string>();
    for (const a of project.assignments) {
      const override = a.billRateOverride ? Number(a.billRateOverride) : null;
      if (override != null) {
        rateByRole.set(`${a.personId}-${a.roleId}`, override);
      } else if (singleRate != null) {
        rateByRole.set(`${a.personId}-${a.roleId}`, singleRate);
      } else {
        roleIdsNeedingRate.add(a.roleId);
      }
    }
    if (roleIdsNeedingRate.size > 0) {
      const rates = await prisma.projectRoleRate.findMany({
        where: { projectId, roleId: { in: [...roleIdsNeedingRate] } },
        select: { roleId: true, billRate: true },
      });
      const rateByRoleId = new Map(rates.map((r) => [r.roleId, Number(r.billRate)]));
      for (const a of project.assignments) {
        if (!rateByRole.has(`${a.personId}-${a.roleId}`)) {
          rateByRole.set(`${a.personId}-${a.roleId}`, rateByRoleId.get(a.roleId) ?? 0);
        }
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
      const rows = buildCdaRowsForProject({
        startDate: project.startDate,
        endDate: project.endDate,
        cdaMonths: project.cdaMonths ?? [],
        actualHours: project.actualHours ?? [],
        actualHoursMonthSplits: project.actualHoursMonthSplits ?? [],
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
    // On status report, limit how many months before the report date are shown (1–4)
    const previousMonths = Math.min(
      4,
      Math.max(1, options?.timelinePreviousMonths ?? snapshot?.timelinePreviousMonths ?? 1)
    );
    const reportDate = new Date(report.reportDate);
    const minStartDate = new Date(Date.UTC(reportDate.getUTCFullYear(), reportDate.getUTCMonth() - previousMonths, 1));
    const minStartStr = minStartDate.toISOString().slice(0, 10);
    const effectiveStartStr = startStr < minStartStr ? minStartStr : startStr;
    const bars = (project.timelineBars ?? [])
      .sort((a, b) => a.rowIndex - b.rowIndex || a.startDate.getTime() - b.startDate.getTime())
      .map((b) => ({
        rowIndex: b.rowIndex,
        label: b.label,
        startDate: b.startDate.toISOString().slice(0, 10),
        endDate: b.endDate.toISOString().slice(0, 10),
        color: b.color ?? null,
      }));
    const markers = (project.timelineMarkers ?? [])
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((m) => ({
        label: m.label,
        date: m.date.toISOString().slice(0, 10),
        shape: m.shape,
        rowIndex: m.rowIndex,
      }));
    timeline = { startDate: effectiveStartStr, endDate: endStr, bars, markers };
  }

  let cdaReportHoursOnly = false;
  if (snapshot != null) {
    cdaReportHoursOnly =
      typeof snapshot.cdaReportHoursOnly === "boolean"
        ? snapshot.cdaReportHoursOnly
        : false;
  } else {
    cdaReportHoursOnly = project.cdaReportHoursOnly ?? false;
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
    cdaReportHoursOnly,
  };
}
