import {
  modularNeedsBudget,
  modularNeedsPlanLists,
  modularNeedsTimeline,
  normalizeModularPanels,
} from "@/lib/reportPanels";
import { snapshotHasPlanLists } from "@/lib/plan/reportLists";
import type { PlanReportDensity, ScheduleSource } from "@/lib/statusReportPdfData";

export type { ScheduleSource } from "@/lib/statusReportPdfData";

export type StatusReportVariationLike = string;

export const PREVIOUS_MONTHS_ON_SCHEDULE_LABEL = "Previous months on schedule";
export const PLAN_LOOKAHEAD_MONTHS_LABEL = "Months after report date";
export const INCLUDE_DETAILED_PLAN_LABEL = "Include detailed plan page";
export const ADD_FULL_PROJECT_PLAN_LABEL = "Add full project plan to report";

/** Resolves whether Standard report budget block is visible (default true). */
export function resolveShowBudget(
  snapshot: { showBudget?: boolean } | null
): boolean {
  if (snapshot != null && typeof snapshot.showBudget === "boolean") {
    return snapshot.showBudget;
  }
  return true;
}

/**
 * Whether PDF/view data should include the budget block.
 * CDA needs budgetedHoursHigh for Overall Hours Planned (not the CDA monthly plan sum).
 */
export function shouldAttachBudgetToPdfData(
  variation: StatusReportVariationLike,
  panels?: unknown
): boolean {
  if (
    variation === "Standard" ||
    variation === "Milestones" ||
    variation === "CDA"
  ) {
    return true;
  }
  if (variation === "Modular") {
    return modularNeedsBudget(normalizeModularPanels(panels));
  }
  return false;
}

/**
 * Edit-form **Refresh budget** is offered for every variation that locks budget
 * into the snapshot. The API refreshes Standard, Milestones, and CDA
 * (`snapshot.budget`; on CDA also monthly hours / totalMtdActuals / overallBudget).
 * Modular shows it when the layout includes a budget module.
 */
export function shouldShowRefreshBudget(
  variation: StatusReportVariationLike,
  panels?: unknown
): boolean {
  return shouldAttachBudgetToPdfData(variation, panels);
}

/**
 * Edit-form **Refresh timeline** for Standard/Milestones. Modular only when a
 * ganttTimeline module is placed in the layout.
 */
export function shouldShowRefreshTimeline(
  variation: StatusReportVariationLike,
  panels?: unknown
): boolean {
  if (variation === "Standard" || variation === "Milestones") return true;
  if (variation === "Modular") {
    return modularNeedsTimeline(normalizeModularPanels(panels));
  }
  return false;
}

/** Edit-form **Refresh Plan lists** — Modular only, when a plan list module is placed. */
export function shouldShowRefreshPlanLists(
  variation: StatusReportVariationLike,
  panels?: unknown
): boolean {
  if (variation !== "Modular") return false;
  return modularNeedsPlanLists(normalizeModularPanels(panels));
}

export function shouldUseLockedPlanLists(
  snapshot: {
    planMeetings?: unknown;
    planActivitiesCompleted?: unknown;
    planActivitiesUpcoming?: unknown;
  } | null,
  options?: { rebuildPlanListsFromProject?: boolean }
): boolean {
  return snapshotHasPlanLists(snapshot) && !options?.rebuildPlanListsFromProject;
}

export function isScheduleEligibleVariation(
  variation: StatusReportVariationLike
): boolean {
  return (
    variation === "Standard" ||
    variation === "Milestones" ||
    variation === "Modular"
  );
}

export function detailedPlanCheckboxLabel(
  variation: StatusReportVariationLike
): string {
  return variation === "Modular"
    ? ADD_FULL_PROJECT_PLAN_LABEL
    : INCLUDE_DETAILED_PLAN_LABEL;
}

export function shouldLockModularTimelineOnCreate(
  needsTimelineModule: boolean,
  scheduleSource: ScheduleSource | undefined
): boolean {
  return needsTimelineModule || scheduleSource === "plan";
}

/** Schedule source / plan density fields on the status report form. */
export function shouldShowScheduleSourceFields(
  planEnabled: boolean,
  editingScheduleSource: ScheduleSource
): boolean {
  return planEnabled || editingScheduleSource === "plan";
}

/**
 * Reapply project schedule defaults when entering a schedule-eligible variation
 * from CDA (or on open-new initialization). Standard ↔ Milestones ↔ Modular
 * preserves the user's current scheduleSource/planDensity.
 */
export function shouldResetScheduleDefaultsOnVariationChange(
  previousVariation: StatusReportVariationLike,
  nextVariation: StatusReportVariationLike
): boolean {
  if (!isScheduleEligibleVariation(nextVariation)) return false;
  return !isScheduleEligibleVariation(previousVariation);
}

export function createScheduleFormDefaults(
  planReportDefault: "timeline" | "plan"
): {
  scheduleSource: ScheduleSource;
  planDensity: PlanReportDensity;
} {
  return {
    scheduleSource: planReportDefault,
    planDensity: "phases_and_key_dates",
  };
}

export function buildScheduleSourceCreatePayload(
  planEnabled: boolean,
  variation: StatusReportVariationLike,
  scheduleSource: ScheduleSource,
  planDensity: PlanReportDensity
): { scheduleSource?: ScheduleSource; planDensity?: PlanReportDensity } {
  if (!planEnabled || !isScheduleEligibleVariation(variation)) {
    return {};
  }
  return {
    scheduleSource,
    ...(scheduleSource === "plan" && { planDensity }),
  };
}

export function shouldShowPreviousMonthsOnSchedule(scheduleSource: ScheduleSource): boolean {
  return scheduleSource === "timeline" || scheduleSource === "plan";
}

export function shouldShowPlanLookaheadOnSchedule(scheduleSource: ScheduleSource): boolean {
  return scheduleSource === "plan";
}

export function scheduleSourceLabel(source: ScheduleSource): string {
  return source === "plan" ? "Project Plan" : "Project timeline";
}

export function planDensityLabel(density: PlanReportDensity): string {
  return density === "phases" ? "Phases only" : "Phases + key dates";
}
