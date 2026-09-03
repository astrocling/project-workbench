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

export const PLAN_MEETING_STATUSES = ["assumed", "scheduled"] as const;

export type PlanMeetingStatus = (typeof PLAN_MEETING_STATUSES)[number];

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
  return type === "meeting" && meetingStatus === "assumed";
}

export const PHASE_SUGGESTIONS = [
  { name: "Discovery", color: "#475569" },
  { name: "Design", color: "#6d28d9" },
  { name: "Development", color: "#1941FA" },
  { name: "QA / Testing", color: "#0f766e" },
  { name: "UAT", color: "#b45309" },
  { name: "Deployment", color: "#15803d" },
] as const;
