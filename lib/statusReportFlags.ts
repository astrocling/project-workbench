import type { PlanReportDensity, ScheduleSource } from "@/lib/statusReportPdfData";

export type { ScheduleSource } from "@/lib/statusReportPdfData";

export type StatusReportVariationLike = string;

export const PREVIOUS_MONTHS_ON_SCHEDULE_LABEL = "Previous months on schedule";
export const PLAN_LOOKAHEAD_MONTHS_LABEL = "Months after report date";
export const INCLUDE_DETAILED_PLAN_LABEL = "Include detailed plan page";

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
  variation: StatusReportVariationLike
): boolean {
  return (
    variation === "Standard" ||
    variation === "Milestones" ||
    variation === "CDA"
  );
}

/**
 * Edit-form **Refresh budget** is offered for every variation that locks budget
 * into the snapshot. The API refreshes Standard, Milestones, and CDA
 * (`snapshot.budget`; on CDA also monthly hours / totalMtdActuals / overallBudget).
 * Modular has no budget snapshot.
 */
export function shouldShowRefreshBudget(
  variation: StatusReportVariationLike
): boolean {
  return shouldAttachBudgetToPdfData(variation);
}

export function isScheduleEligibleVariation(
  variation: StatusReportVariationLike
): boolean {
  return variation === "Standard" || variation === "Milestones";
}

/** Schedule source / plan density fields on the status report form. */
export function shouldShowScheduleSourceFields(
  planEnabled: boolean,
  editingScheduleSource: ScheduleSource
): boolean {
  return planEnabled || editingScheduleSource === "plan";
}

/**
 * Reapply project schedule defaults only when entering Standard/Milestones from
 * CDA/Modular (or on open-new initialization). Standard ↔ Milestones preserves
 * the user's current scheduleSource/planDensity.
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
