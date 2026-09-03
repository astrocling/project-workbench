import type { ScheduleSource } from "@/lib/statusReportPdfData";

export const PLAN_NOT_ENABLED_ERROR = "Plan is not enabled for this project.";

export const PLAN_SCHEDULE_EMPTY_ERROR =
  "Add phases and dated items on the Plan tab (or choose Project timeline).";

export const PROJECT_END_DATE_REQUIRED_ERROR =
  "Set a project end date before creating or refreshing the schedule on a status report.";

export const TIMELINE_SCHEDULE_EMPTY_ERROR =
  "This project has no timeline to show on a report (add timeline bars on the Timeline tab).";

/** Error when rebuild produces no usable schedule (missing end date vs empty content). */
export function resolveScheduleRebuildError(
  scheduleSource: ScheduleSource,
  opts: { hasProjectEndDate: boolean }
): string {
  if (!opts.hasProjectEndDate) {
    return PROJECT_END_DATE_REQUIRED_ERROR;
  }
  if (scheduleSource === "plan") {
    return PLAN_SCHEDULE_EMPTY_ERROR;
  }
  return TIMELINE_SCHEDULE_EMPTY_ERROR;
}

export function isPlanScheduleCreateRequest(
  variation: string,
  scheduleSource?: ScheduleSource
): boolean {
  return (
    (variation === "Standard" || variation === "Milestones") && scheduleSource === "plan"
  );
}
