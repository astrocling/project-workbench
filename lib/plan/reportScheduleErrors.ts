import type { PlanReportDensity } from "@/lib/plan/reportSchedule";
import type { ScheduleSource } from "@/lib/statusReportPdfData";
import { isPlanTabEnabled } from "@/lib/plan/feature";

export type PlanScheduleReportVariation = "Standard" | "Milestones";

export const PLAN_NOT_ENABLED_ERROR = "Plan is not enabled for this project.";

export const PLAN_SCHEDULE_EMPTY_ERROR =
  "Add phases and dated items on the Plan tab (or choose Project timeline).";

export const PLAN_SCHEDULE_PHASES_ONLY_POINT_DATES_ERROR =
  'Switch to "Phases + key dates" or add phases with date ranges on the Plan tab (or choose Project timeline).';

export const PROJECT_END_DATE_REQUIRED_ERROR =
  "Set a project end date before creating or refreshing the schedule on a status report.";

export const TIMELINE_SCHEDULE_EMPTY_ERROR =
  "This project has no timeline to show on a report (set a project end date and timeline bars on the Timeline tab).";

/**
 * Error when a rebuild produces no usable schedule (missing end date vs empty content). Used by
 * `POST .../status-reports/[reportId]/refresh-timeline` for both schedule sources.
 */
export function resolveScheduleRebuildError(
  scheduleSource: ScheduleSource,
  opts: { hasProjectEndDate: boolean; planDensity?: PlanReportDensity }
): string {
  if (!opts.hasProjectEndDate) {
    return PROJECT_END_DATE_REQUIRED_ERROR;
  }
  if (scheduleSource === "plan") {
    return resolvePlanScheduleEmptyError(opts.planDensity);
  }
  return TIMELINE_SCHEDULE_EMPTY_ERROR;
}

export function resolvePlanScheduleEmptyError(planDensity?: PlanReportDensity): string {
  if (planDensity === "phases") {
    return PLAN_SCHEDULE_PHASES_ONLY_POINT_DATES_ERROR;
  }
  return PLAN_SCHEDULE_EMPTY_ERROR;
}

export function isPlanScheduleCreateRequest(
  variation: PlanScheduleReportVariation | "CDA" | "Modular",
  scheduleSource?: ScheduleSource
): variation is PlanScheduleReportVariation {
  return (
    (variation === "Standard" || variation === "Milestones") && scheduleSource === "plan"
  );
}

export function validatePlanScheduleCreateEligibility(opts: {
  planEnabled: boolean | null | undefined;
  hasEndDate: boolean;
}): string | null {
  if (!isPlanTabEnabled(opts.planEnabled)) {
    return PLAN_NOT_ENABLED_ERROR;
  }
  if (!opts.hasEndDate) {
    return PROJECT_END_DATE_REQUIRED_ERROR;
  }
  return null;
}
