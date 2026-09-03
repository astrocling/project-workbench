export const PLAN_ITEM_TYPES = [
  "task",
  "milestone",
  "sign_off",
  "hard_deadline",
  "waiting_on_client",
] as const;

export type PlanItemType = (typeof PLAN_ITEM_TYPES)[number];

export const PLAN_MEETING_STATUSES = ["assumed", "scheduled"] as const;

export type PlanMeetingStatus = (typeof PLAN_MEETING_STATUSES)[number];

export const PHASE_SUGGESTIONS = [
  { name: "Discovery", color: "#475569" },
  { name: "Design", color: "#6d28d9" },
  { name: "Development", color: "#1941FA" },
  { name: "QA / Testing", color: "#0f766e" },
  { name: "UAT", color: "#b45309" },
  { name: "Deployment", color: "#15803d" },
] as const;
