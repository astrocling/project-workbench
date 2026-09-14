export const PLAN_ITEM_TYPES = [
  "task",
  "milestone",
  "sign_off",
  "hard_deadline",
  "waiting_on_client",
  "meeting",
] as const;

export type PlanItemType = (typeof PLAN_ITEM_TYPES)[number];

export const POINT_ITEM_TYPES = ["milestone", "sign_off", "hard_deadline"] as const;

export type PointItemType = (typeof POINT_ITEM_TYPES)[number];

export const PLAN_MEETING_STATUSES = ["unscheduled", "scheduled"] as const;

export type PlanMeetingStatus = (typeof PLAN_MEETING_STATUSES)[number];

export const PLAN_MEETING_UI_STATUSES = ["unscheduled", "scheduled", "complete"] as const;

export type PlanMeetingUiStatus = (typeof PLAN_MEETING_UI_STATUSES)[number];

export const PLAN_ITEM_STATUSES = ["not_started", "in_progress", "complete"] as const;

export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];

export const MAX_ITEM_DEPTH = 3;

export function isPointType(
  type: PlanItemType,
  meetingStatus?: PlanMeetingStatus | null
): boolean {
  if ((POINT_ITEM_TYPES as readonly string[]).includes(type)) return true;
  return type === "meeting" && meetingStatus === "scheduled";
}

export function isRangeType(
  type: PlanItemType,
  meetingStatus?: PlanMeetingStatus | null
): boolean {
  if (type === "task" || type === "waiting_on_client") return true;
  return type === "meeting" && meetingStatus === "unscheduled";
}

export function meetingUiStatus(item: {
  meetingStatus?: PlanMeetingStatus | null;
  status?: PlanItemStatus | null;
}): PlanMeetingUiStatus {
  if (item.meetingStatus === "scheduled") {
    return item.status === "complete" ? "complete" : "scheduled";
  }
  return "unscheduled";
}

export function patchFromMeetingUiStatus(
  item: { startDate: string },
  next: PlanMeetingUiStatus
): {
  meetingStatus: PlanMeetingStatus;
  status: PlanItemStatus;
  endDate?: string;
} {
  if (next === "unscheduled") {
    return {
      meetingStatus: "unscheduled",
      status: "not_started",
    };
  }
  if (next === "scheduled") {
    return {
      meetingStatus: "scheduled",
      status: "not_started",
      endDate: item.startDate,
    };
  }
  return {
    meetingStatus: "scheduled",
    status: "complete",
    endDate: item.startDate,
  };
}

export const PHASE_SUGGESTIONS = [
  { name: "Discovery", color: "#475569" },
  { name: "Design", color: "#6d28d9" },
  { name: "Development", color: "#1941FA" },
  { name: "QA / Testing", color: "#0f766e" },
  { name: "UAT", color: "#b45309" },
  { name: "Deployment", color: "#15803d" },
] as const;
