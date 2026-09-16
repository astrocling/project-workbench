import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";

export const PLAN_REPORT_LIST_LIMIT = 10;

export type PlanReportListItem = {
  id: string;
  label: string;
  date: string | null;
  extra: string | null;
};

export type PlanReportListSlice = {
  items: PlanReportListItem[];
  overflowCount: number;
};

export type PlanMeetingsSnapshot = {
  needsScheduling: PlanReportListItem[];
  scheduled: PlanReportListItem[];
};

export type PlanReportLists = {
  planMeetings: PlanMeetingsSnapshot;
  planActivitiesCompleted: PlanReportListSlice;
  planActivitiesUpcoming: PlanReportListSlice;
};

function toYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const ymd = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function itemLabel(item: PlanItemJson): string {
  return item.reportLabel || item.label;
}

function flattenItems(phases: PlanPhaseJson[] | undefined | null): Array<{
  phaseOrder: number;
  item: PlanItemJson;
}> {
  if (!phases) return [];
  return [...phases]
    .sort((a, b) => a.order - b.order)
    .flatMap((phase) =>
      [...phase.items].map((item) => ({ phaseOrder: phase.order, item }))
    );
}

function sliceWithOverflow(items: PlanReportListItem[]): PlanReportListSlice {
  return {
    items: items.slice(0, PLAN_REPORT_LIST_LIMIT),
    overflowCount: Math.max(0, items.length - PLAN_REPORT_LIST_LIMIT),
  };
}

function buildMeetings(
  rows: Array<{ phaseOrder: number; item: PlanItemJson }>
): PlanMeetingsSnapshot {
  const needsScheduling = rows
    .filter(({ item }) => item.type === "meeting" && item.meetingStatus === "unscheduled")
    .sort((a, b) => a.phaseOrder - b.phaseOrder || a.item.order - b.item.order)
    .map(({ item }) => ({
      id: item.id,
      label: itemLabel(item),
      date: null,
      extra: item.scheduledTime ?? null,
    }));

  const scheduled = rows
    .filter(
      ({ item }) =>
        item.type === "meeting" &&
        item.meetingStatus === "scheduled" &&
        item.status !== "complete"
    )
    .sort((a, b) => (a.item.startDate || "").localeCompare(b.item.startDate || ""))
    .map(({ item }) => ({
      id: item.id,
      label: itemLabel(item),
      date: toYmd(item.startDate),
      extra: item.scheduledTime ?? null,
    }));

  return { needsScheduling, scheduled };
}

function buildCompleted(
  rows: Array<{ item: PlanItemJson }>,
  reportDate: string
): PlanReportListSlice {
  const completed = rows
    .filter(({ item }) => item.type !== "meeting" && item.status === "complete")
    .filter(({ item }) => {
      const completedYmd = toYmd(item.completedAt);
      if (completedYmd == null) return true;
      return completedYmd <= reportDate;
    })
    .sort((a, b) => {
      const da = toYmd(a.item.completedAt) ?? a.item.startDate ?? "";
      const db = toYmd(b.item.completedAt) ?? b.item.startDate ?? "";
      return db.localeCompare(da);
    })
    .map(({ item }) => ({
      id: item.id,
      label: itemLabel(item),
      date: toYmd(item.completedAt) ?? toYmd(item.startDate),
      extra: null,
    }));

  return sliceWithOverflow(completed);
}

function buildUpcoming(
  rows: Array<{ item: PlanItemJson }>,
  reportDate: string
): PlanReportListSlice {
  const upcoming = rows
    .filter(
      ({ item }) =>
        item.type !== "meeting" &&
        item.status !== "complete" &&
        (item.endDate || "") >= reportDate
    )
    .sort((a, b) => (a.item.startDate || "").localeCompare(b.item.startDate || ""))
    .map(({ item }) => ({
      id: item.id,
      label: itemLabel(item),
      date: toYmd(item.startDate),
      extra: null,
    }));

  return sliceWithOverflow(upcoming);
}

export function buildPlanReportLists(
  phases: PlanPhaseJson[] | undefined | null,
  reportDate: string
): PlanReportLists {
  const rows = flattenItems(phases);
  return {
    planMeetings: buildMeetings(rows),
    planActivitiesCompleted: buildCompleted(rows, reportDate),
    planActivitiesUpcoming: buildUpcoming(rows, reportDate),
  };
}

export function capMeetingsForDisplay(
  meetings: PlanMeetingsSnapshot,
  limit = PLAN_REPORT_LIST_LIMIT
): PlanMeetingsSnapshot & { overflowCount: number } {
  const combined = [...meetings.needsScheduling, ...meetings.scheduled];
  const overflowCount = Math.max(0, combined.length - limit);
  const kept = combined.slice(0, limit);
  const needCount = Math.min(meetings.needsScheduling.length, kept.length);
  return {
    needsScheduling: kept.slice(0, needCount),
    scheduled: kept.slice(needCount),
    overflowCount,
  };
}

export const EMPTY_PLAN_REPORT_LISTS: PlanReportLists = {
  planMeetings: { needsScheduling: [], scheduled: [] },
  planActivitiesCompleted: { items: [], overflowCount: 0 },
  planActivitiesUpcoming: { items: [], overflowCount: 0 },
};

export const PLAN_LIST_ENABLE_MESSAGE = "Enable Plan to use this module";

export type PlanListKind = "meetings" | "completed" | "upcoming";

export function planListEmptyMessage(kind: PlanListKind, planAvailable: boolean): string {
  if (!planAvailable) return PLAN_LIST_ENABLE_MESSAGE;
  if (kind === "meetings") return "No upcoming meetings.";
  if (kind === "completed") return "No completed activities.";
  return "No upcoming activities.";
}

export function mergePlanListsIntoSnapshot<T>(
  snapshot: T,
  lists: PlanReportLists
): T & PlanReportLists {
  return {
    ...snapshot,
    planMeetings: lists.planMeetings,
    planActivitiesCompleted: lists.planActivitiesCompleted,
    planActivitiesUpcoming: lists.planActivitiesUpcoming,
  };
}

export function snapshotHasPlanLists(snapshot: {
  planMeetings?: unknown;
  planActivitiesCompleted?: unknown;
  planActivitiesUpcoming?: unknown;
} | null | undefined): boolean {
  return (
    snapshot != null &&
    snapshot.planMeetings != null &&
    snapshot.planActivitiesCompleted != null &&
    snapshot.planActivitiesUpcoming != null
  );
}
