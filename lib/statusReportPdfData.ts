import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeBudgetRollups } from "@/lib/budgetCalculations";
import { buildCdaRowsForProject } from "@/lib/cdaMtdFromResourcing";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";
import { normalizeModularPanels, modularNeedsPlanLists } from "@/lib/reportPanels";
import { resolveShowBudget, shouldAttachBudgetToPdfData, shouldUseLockedPlanLists } from "@/lib/statusReportFlags";
import { getPlanForProject } from "@/lib/plan/api";
import { serializePlan } from "@/lib/plan/serialize";
import { isPlanTabEnabled } from "@/lib/plan/feature";
import {
  buildPlanReportLists,
  EMPTY_PLAN_REPORT_LISTS,
  type PlanMeetingsSnapshot,
  type PlanReportListSlice,
  type PlanReportLists,
} from "@/lib/plan/reportLists";
import {
  applyPlanPhaseColors,
  compactLanePolicyForVariation,
  timelineLayoutMaxRow,
  type PlanReportDensity,
} from "@/lib/plan/reportSchedule";
import {
  applyTimelineLayout,
  type TimelineLayoutOverlay,
} from "@/lib/statusReportTimelineLayout";
import {
  buildLegacyTimeline,
  buildPlanTimelineCandidate,
  earliestScheduleWorkYmd,
  PLAN_REPORT_LOOKAHEAD_DEFAULT,
  resolveReportTimelineAxis,
  shouldBuildTimelineFromLegacy,
  shouldBuildTimelineFromPlan,
  shouldClipLockedTimelineToPreviousMonths,
  shouldUseLockedTimeline,
} from "@/lib/statusReportScheduleBuild";

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
export type ScheduleSource = "timeline" | "plan";
export type { PlanReportDensity } from "@/lib/plan/reportSchedule";

export type StatusReportSnapshot = {
  period: string;
  today: string;
  budget?: StatusReportPDFData["budget"];
  cda?: StatusReportPDFData["cda"];
  timeline?: StatusReportPDFData["timeline"];
  /** Number of months before report date to show on timeline (1–4). */
  timelinePreviousMonths?: number;
  /** Plan-source: months after report date on the compact strip (1–4). Default 2. */
  timelineLookaheadMonths?: number;
  /** Optional extra PDF page with the full Plan Gantt. */
  includeDetailedPlan?: boolean;
  /** Locked at report creation: hide CDA budget dollars on Overall table. */
  cdaReportHoursOnly?: boolean;
  /** When false, Standard report omits bottom budget table and burn chart. Default true. */
  showBudget?: boolean;
  /** Schedule source for timeline: project Timeline tab or compact Plan. Default timeline when absent. */
  scheduleSource?: ScheduleSource;
  /** Plan report density when scheduleSource is plan. */
  planDensity?: PlanReportDensity;
  /** Per-report visual overlay on the locked compact schedule. */
  timelineLayout?: TimelineLayoutOverlay;
  planMeetings?: PlanMeetingsSnapshot;
  planActivitiesCompleted?: PlanReportListSlice;
  planActivitiesUpcoming?: PlanReportListSlice;
};

export {
  resolveShowBudget,
  shouldAttachBudgetToPdfData,
  shouldShowRefreshBudget,
  shouldShowRefreshTimeline,
  shouldShowRefreshPlanLists,
  shouldUseLockedPlanLists,
} from "@/lib/statusReportFlags";

export function isStatusReportSnapshot(obj: unknown): obj is StatusReportSnapshot {
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
  /** Plan-source months after report date (1–4). */
  timelineLookaheadMonths?: number;
  includeDetailedPlan?: boolean;
  /** When true, ignore snapshot.timeline and rebuild timeline from current project bars/markers or Plan. */
  rebuildTimelineFromProject?: boolean;
  /** When true, ignore snapshot.cda.milestones and rebuild from current project CDA milestones. */
  rebuildCdaMilestonesFromProject?: boolean;
  /** When true, ignore snapshot.budget and recompute from current project budget lines + actuals. On CDA, also rebuilds locked monthly hours / totalMtdActuals (milestones preserved). */
  rebuildBudgetFromProject?: boolean;
  /** When true, ignore locked plan list snapshot keys and rebuild from current Plan. */
  rebuildPlanListsFromProject?: boolean;
  /** Schedule source for timeline when building a new timeline (create or refresh). */
  scheduleSource?: ScheduleSource;
  /** Plan report density when scheduleSource is plan. */
  planDensity?: PlanReportDensity;
  /**
   * When false, return the compact/raw snapshot timeline without applying
   * `timelineLayout` (used when persisting a refresh so overlays can be re-applied later).
   */
  applyTimelineLayoutOverlay?: boolean;
};

export function resolveScheduleSource(
  snapshot: StatusReportSnapshot | null,
  options?: Pick<BuildStatusReportPdfDataOptions, "scheduleSource">
): ScheduleSource {
  if (options?.scheduleSource === "plan" || options?.scheduleSource === "timeline") {
    return options.scheduleSource;
  }
  if (snapshot?.scheduleSource === "plan") return "plan";
  return "timeline";
}

export function resolvePlanDensity(
  snapshot: StatusReportSnapshot | null,
  options?: Pick<BuildStatusReportPdfDataOptions, "planDensity">
): PlanReportDensity {
  if (options?.planDensity === "phases" || options?.planDensity === "phases_and_key_dates") {
    return options.planDensity;
  }
  if (snapshot?.planDensity === "phases") return "phases";
  return "phases_and_key_dates";
}

/**
 * Whether to keep the budget block locked on the report snapshot.
 * Refresh-budget sets rebuildBudgetFromProject so stale $0 locks (e.g. report created before budget lines existed) can be replaced.
 */
export function shouldUseLockedSnapshotBudget(
  snapshot: StatusReportSnapshot | null,
  options?: Pick<BuildStatusReportPdfDataOptions, "rebuildBudgetFromProject">
): boolean {
  return snapshot?.budget !== undefined && !options?.rebuildBudgetFromProject;
}

/**
 * Refresh-budget on a CDA report must also rebuild locked CDA monthly hours /
 * totalMtdActuals (not only snapshot.budget and overallBudget dollars).
 */
export function shouldRebuildCdaBudgetFromProject(
  variation: string,
  options?: Pick<BuildStatusReportPdfDataOptions, "rebuildBudgetFromProject">
): boolean {
  return variation === "CDA" && Boolean(options?.rebuildBudgetFromProject);
}

type CdaSnapshot = NonNullable<StatusReportPDFData["cda"]>;
type CdaBudgetFields = Omit<CdaSnapshot, "milestones">;

/**
 * Replace CDA budget/actuals fields from a live rebuild while keeping milestones
 * from the existing snapshot (use Refresh milestones for those).
 */
export function applyCdaBudgetRefresh(
  existing: CdaSnapshot | undefined,
  refreshed: CdaBudgetFields
): CdaSnapshot {
  return {
    ...refreshed,
    milestones: existing?.milestones,
  };
}

type CdaMilestoneSnapshot = NonNullable<
  NonNullable<StatusReportPDFData["cda"]>["milestones"]
>[number];

type CdaMilestoneRecord = {
  id: string;
  phase: string;
  devStartDate: Date | null;
  devEndDate: Date | null;
  uatStartDate: Date | null;
  uatEndDate: Date | null;
  deployDate: Date | null;
  completed: boolean;
};

function toIsoDateOnly(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function buildCdaMilestonesFromProject(
  milestones: CdaMilestoneRecord[]
): CdaMilestoneSnapshot[] {
  return [...milestones]
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
      devStartDate: toIsoDateOnly(m.devStartDate),
      devEndDate: toIsoDateOnly(m.devEndDate),
      uatStartDate: toIsoDateOnly(m.uatStartDate),
      uatEndDate: toIsoDateOnly(m.uatEndDate),
      deployDate: toIsoDateOnly(m.deployDate),
      completed: m.completed,
    }));
}

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

  if (shouldUseLockedSnapshotBudget(snapshot, options)) {
    budget = snapshot!.budget;
  }
  const rebuildCdaBudget = shouldRebuildCdaBudgetFromProject(report.variation, options);
  if (snapshot?.cda !== undefined && !rebuildCdaBudget) {
    cda = snapshot.cda;
    if (options?.rebuildCdaMilestonesFromProject && cda) {
      cda = {
        ...cda,
        milestones: buildCdaMilestonesFromProject(project.cdaMilestones ?? []),
      };
    }
  }
  if (snapshot?.timeline !== undefined && !options?.rebuildTimelineFromProject) {
    timeline = snapshot.timeline;
    // Always apply "months before" from snapshot so the displayed range is correct
    const prevMonths =
      typeof snapshot.timelinePreviousMonths === "number" &&
      snapshot.timelinePreviousMonths >= 1 &&
      snapshot.timelinePreviousMonths <= 4
        ? snapshot.timelinePreviousMonths
        : null;
    if (
      prevMonths != null &&
      shouldClipLockedTimelineToPreviousMonths(resolveScheduleSource(snapshot))
    ) {
      const clipped = resolveReportTimelineAxis({
        scheduleSource: "timeline",
        projectStartYmd: project.startDate.toISOString().slice(0, 10),
        projectEndYmd: (timeline.endDate ?? "").slice(0, 10),
        reportDate: new Date(report.reportDate),
        previousMonths: prevMonths,
      });
      timeline = { ...timeline, startDate: clipped.startDate };
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

  const needCdaBudget =
    report.variation === "CDA" && (cda === undefined || rebuildCdaBudget);
  if (budget === undefined || needCdaBudget) {
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

    if (needCdaBudget) {
      const rows = buildCdaRowsForProject({
        startDate: project.startDate,
        endDate: project.endDate,
        cdaMonths: project.cdaMonths ?? [],
        actualHours: project.actualHours ?? [],
        actualHoursMonthSplits: project.actualHoursMonthSplits ?? [],
      });
      const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
      const totalMtdActuals = rows.reduce((s, r) => s + r.mtdActuals, 0);
      const refreshedCdaBudget: CdaBudgetFields = {
        rows,
        overallBudget: { totalDollars: estBudgetHigh, actualDollars: rollups.actualDollarsToDate },
        totalPlanned,
        totalMtdActuals,
        totalRemaining: totalPlanned - totalMtdActuals,
      };
      if (rebuildCdaBudget) {
        // Keep locked milestones; Refresh milestones is separate.
        const existingCda = isStatusReportSnapshot(snapshot) ? snapshot.cda : undefined;
        cda = applyCdaBudgetRefresh(existingCda, refreshedCdaBudget);
      } else {
        cda = {
          ...refreshedCdaBudget,
          milestones: buildCdaMilestonesFromProject(project.cdaMilestones ?? []),
        };
      }
    }
  }

  if (timeline === undefined && project.endDate != null) {
    const startStr = project.startDate.toISOString().slice(0, 10);
    const endStr = project.endDate.toISOString().slice(0, 10);
    const previousMonths = Math.min(
      4,
      Math.max(1, options?.timelinePreviousMonths ?? snapshot?.timelinePreviousMonths ?? 1)
    );
    const lookaheadMonths = Math.min(
      4,
      Math.max(
        1,
        options?.timelineLookaheadMonths ??
          snapshot?.timelineLookaheadMonths ??
          PLAN_REPORT_LOOKAHEAD_DEFAULT
      )
    );
    const timelineLocked = shouldUseLockedTimeline(snapshot, options?.rebuildTimelineFromProject);
    const scheduleSource = resolveScheduleSource(snapshot, options);
    const planRecord =
      scheduleSource === "plan" || snapshot?.includeDetailedPlan === true
        ? await getPlanForProject(projectId)
        : null;
    const planJson = planRecord ? serializePlan(planRecord) : null;
    const axis = resolveReportTimelineAxis({
      scheduleSource,
      projectStartYmd: startStr,
      projectEndYmd: endStr,
      reportDate: new Date(report.reportDate),
      previousMonths,
      lookaheadMonths,
      planKickoffYmd: planJson?.kickoffDate,
      planEndYmd: planJson?.endDate,
      windowStartYmd: snapshot?.timelineLayout?.windowStartYmd,
      windowEndYmd: snapshot?.timelineLayout?.windowEndYmd,
    });

    if (shouldBuildTimelineFromPlan(scheduleSource, timelineLocked)) {
      if (planJson) {
        const density = resolvePlanDensity(snapshot, options);
        timeline = buildPlanTimelineCandidate(planJson.phases, density, axis, {
          lanePolicy: compactLanePolicyForVariation(report.variation),
        });
      }
    } else if (shouldBuildTimelineFromLegacy(scheduleSource, timelineLocked)) {
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
      timeline = buildLegacyTimeline(bars, markers, axis);
    }
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

  const showBudget = resolveShowBudget(snapshot);

  if (timeline && options?.applyTimelineLayoutOverlay !== false) {
    timeline = applyTimelineLayout(
      timeline,
      snapshot?.timelineLayout,
      timelineLayoutMaxRow(report.variation)
    );
  }

  const resolvedSource = snapshot != null ? resolveScheduleSource(snapshot) : "timeline";
  const includeDetailedPlan =
    options?.includeDetailedPlan === true || snapshot?.includeDetailedPlan === true;
  let detailedPlan: StatusReportPDFData["detailedPlan"];
  let planAxis: StatusReportPDFData["planAxis"];
  let planPhases: Array<{ id: string; color: string }> | undefined;
  if (resolvedSource === "plan" || includeDetailedPlan) {
    const planRecord = await getPlanForProject(projectId);
    if (planRecord) {
      const planJson = serializePlan(planRecord);
      planAxis = { kickoffDate: planJson.kickoffDate, endDate: planJson.endDate };
      planPhases = planJson.phases.map((phase) => ({ id: phase.id, color: phase.color }));
      if (includeDetailedPlan) detailedPlan = planJson;
    }
  }

  if (timeline && resolvedSource === "plan") {
    const previousMonths = Math.min(
      4,
      Math.max(1, snapshot?.timelinePreviousMonths ?? options?.timelinePreviousMonths ?? 1)
    );
    const lookaheadMonths = Math.min(
      4,
      Math.max(
        1,
        snapshot?.timelineLookaheadMonths ??
          options?.timelineLookaheadMonths ??
          PLAN_REPORT_LOOKAHEAD_DEFAULT
      )
    );
    const projectEndYmd = project.endDate
      ? project.endDate.toISOString().slice(0, 10)
      : timeline.endDate.slice(0, 10);
    const axis = resolveReportTimelineAxis({
      scheduleSource: "plan",
      projectStartYmd: project.startDate.toISOString().slice(0, 10),
      projectEndYmd,
      reportDate: new Date(report.reportDate),
      previousMonths,
      lookaheadMonths,
      planKickoffYmd: planAxis?.kickoffDate,
      planEndYmd: planAxis?.endDate,
      planWorkStartYmd: earliestScheduleWorkYmd(timeline),
      windowStartYmd: snapshot?.timelineLayout?.windowStartYmd,
      windowEndYmd: snapshot?.timelineLayout?.windowEndYmd,
    });
    timeline = { ...timeline, startDate: axis.startDate, endDate: axis.endDate };
    if (planPhases) {
      timeline = applyPlanPhaseColors(timeline, planPhases);
    }
  }

  const needsPlanLists =
    report.variation === "Modular" &&
    modularNeedsPlanLists(normalizeModularPanels(report.panels));
  let planLists: PlanReportLists | undefined;
  let planListsAvailable = true;
  if (needsPlanLists) {
    if (shouldUseLockedPlanLists(snapshot, options)) {
      planLists = {
        planMeetings: snapshot!.planMeetings!,
        planActivitiesCompleted: snapshot!.planActivitiesCompleted!,
        planActivitiesUpcoming: snapshot!.planActivitiesUpcoming!,
      };
    } else if (!isPlanTabEnabled(project.planEnabled)) {
      planLists = EMPTY_PLAN_REPORT_LISTS;
      planListsAvailable = false;
    } else {
      const planRecordForLists = await getPlanForProject(projectId);
      if (!planRecordForLists) {
        planLists = EMPTY_PLAN_REPORT_LISTS;
        planListsAvailable = false;
      } else {
        planLists = buildPlanReportLists(
          serializePlan(planRecordForLists).phases,
          report.reportDate.toISOString().slice(0, 10)
        );
      }
    }
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
    budget: shouldAttachBudgetToPdfData(report.variation, report.panels) ? budget : undefined,
    cda,
    timeline,
    cdaReportHoursOnly,
    showBudget,
    panels:
      report.panels != null || report.variation === "Modular"
        ? normalizeModularPanels(report.panels)
        : undefined,
    scheduleSource: resolvedSource,
    includeDetailedPlan,
    detailedPlan,
    planAxis,
    planMeetings: planLists?.planMeetings,
    planActivitiesCompleted: planLists?.planActivitiesCompleted,
    planActivitiesUpcoming: planLists?.planActivitiesUpcoming,
    planListsAvailable,
  };
}
