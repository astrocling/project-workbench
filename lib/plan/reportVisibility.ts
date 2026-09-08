import type { PlanItemType, PlanMeetingStatus } from "@/lib/plan/types";

/** Defaults used when creating an item (and when compacting snapshots that omit the flag). */
export function defaultShowOnReports(
  type: PlanItemType,
  meetingStatus?: PlanMeetingStatus | null
): boolean {
  if (type === "milestone" || type === "sign_off" || type === "hard_deadline") {
    return true;
  }
  return type === "meeting" && meetingStatus === "scheduled";
}

export function itemShowsOnReports(item: {
  type: PlanItemType;
  meetingStatus?: PlanMeetingStatus | null;
  showOnReports?: boolean;
}): boolean {
  if (typeof item.showOnReports === "boolean") return item.showOnReports;
  return defaultShowOnReports(item.type, item.meetingStatus);
}

export function phaseShowsOnReports(phase: { showOnReports?: boolean }): boolean {
  return phase.showOnReports !== false;
}
