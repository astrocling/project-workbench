import { describe, expect, it } from "vitest";
import {
  buildPlanReportLists,
  capMeetingsForDisplay,
  PLAN_LIST_ENABLE_MESSAGE,
  PLAN_REPORT_LIST_LIMIT,
  mergePlanListsIntoSnapshot,
  planListEmptyMessage,
  type PlanReportListItem,
  type PlanReportLists,
} from "@/lib/plan/reportLists";
import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";
import type { PlanItemStatus, PlanItemType, PlanMeetingStatus } from "@/lib/plan/types";

const REPORT_DATE = "2026-06-15";

function item(overrides: Partial<PlanItemJson> & Pick<PlanItemJson, "id">): PlanItemJson {
  return {
    phaseId: "p1",
    type: "task",
    label: overrides.id,
    startDate: "2026-06-01",
    endDate: "2026-06-20",
    order: 0,
    parentItemId: null,
    meetingStatus: null,
    scheduledTime: null,
    showOnReports: false,
    reportLabel: null,
    status: "not_started",
    completedAt: null,
    ...overrides,
  };
}

function phase(
  id: string,
  order: number,
  items: PlanItemJson[]
): PlanPhaseJson {
  return {
    id,
    planId: "plan",
    name: id,
    color: "#1941FA",
    order,
    items: items.map((it) => ({ ...it, phaseId: id })),
  };
}

function meeting(opts: {
  id: string;
  order: number;
  meetingStatus: PlanMeetingStatus;
  status?: PlanItemStatus;
  startDate?: string;
  scheduledTime?: string | null;
  label?: string;
  reportLabel?: string | null;
  showOnReports?: boolean;
}): PlanItemJson {
  return item({
    id: opts.id,
    type: "meeting",
    order: opts.order,
    meetingStatus: opts.meetingStatus,
    status: opts.status ?? "not_started",
    startDate: opts.startDate ?? "2026-06-20",
    endDate: opts.startDate ?? "2026-06-20",
    scheduledTime: opts.scheduledTime ?? null,
    label: opts.label ?? opts.id,
    reportLabel: opts.reportLabel ?? null,
    showOnReports: opts.showOnReports,
  });
}

describe("buildPlanReportLists — meetings", () => {
  it("splits unscheduled vs scheduled and excludes completed meetings", () => {
    const lists = buildPlanReportLists(
      [
        phase("late", 1, [
          meeting({
            id: "sched-late",
            order: 0,
            meetingStatus: "scheduled",
            startDate: "2026-07-01",
            scheduledTime: "14:00",
          }),
        ]),
        phase("early", 0, [
          meeting({ id: "unsched-b", order: 1, meetingStatus: "unscheduled" }),
          meeting({ id: "unsched-a", order: 0, meetingStatus: "unscheduled" }),
          meeting({
            id: "done",
            order: 2,
            meetingStatus: "scheduled",
            status: "complete",
            startDate: "2026-05-01",
          }),
          meeting({
            id: "sched-early",
            order: 3,
            meetingStatus: "scheduled",
            startDate: "2026-06-16",
            scheduledTime: "09:30",
            reportLabel: "Kickoff",
            label: "ignored",
          }),
        ]),
      ],
      REPORT_DATE
    );

    expect(lists.planMeetings.needsScheduling.map((m) => m.id)).toEqual([
      "unsched-a",
      "unsched-b",
    ]);
    expect(lists.planMeetings.needsScheduling[0]?.date).toBeNull();
    expect(lists.planMeetings.scheduled.map((m) => m.id)).toEqual([
      "sched-early",
      "sched-late",
    ]);
    expect(lists.planMeetings.scheduled[0]).toMatchObject({
      label: "Kickoff",
      date: "2026-06-16",
      extra: "09:30",
    });
    expect(
      lists.planMeetings.needsScheduling.concat(lists.planMeetings.scheduled).map((m) => m.id)
    ).not.toContain("done");
  });

  it("does not filter showOnReports on meetings", () => {
    const lists = buildPlanReportLists(
      [
        phase("p", 0, [
          meeting({
            id: "hidden",
            order: 0,
            meetingStatus: "unscheduled",
            showOnReports: false,
          }),
        ]),
      ],
      REPORT_DATE
    );
    expect(lists.planMeetings.needsScheduling.map((m) => m.id)).toEqual(["hidden"]);
  });
});

describe("buildPlanReportLists — completed activities", () => {
  it("excludes meetings and items completed after the report date", () => {
    const lists = buildPlanReportLists(
      [
        phase("p", 0, [
          item({
            id: "done-in-window",
            type: "task",
            status: "complete",
            completedAt: "2026-06-15T18:00:00.000Z",
            label: "Shipped",
          }),
          item({
            id: "done-no-timestamp",
            type: "milestone",
            status: "complete",
            completedAt: null,
            startDate: "2026-01-01",
          }),
          item({
            id: "done-after-report",
            type: "task",
            status: "complete",
            completedAt: "2026-06-16T00:00:00.000Z",
          }),
          item({
            id: "open-task",
            type: "task",
            status: "in_progress",
          }),
          meeting({
            id: "done-meeting",
            order: 9,
            meetingStatus: "scheduled",
            status: "complete",
            startDate: "2026-06-10",
          }),
        ]),
      ],
      REPORT_DATE
    );

    expect(lists.planActivitiesCompleted.items.map((a) => a.id)).toEqual([
      "done-in-window",
      "done-no-timestamp",
    ]);
    expect(lists.planActivitiesCompleted.overflowCount).toBe(0);
    expect(lists.planActivitiesCompleted.items[0]?.label).toBe("Shipped");
    expect(lists.planActivitiesCompleted.items[0]?.date).toBe("2026-06-15");
  });

  it("caps at 10 and counts overflow, newest first", () => {
    const items: PlanItemJson[] = [];
    for (let i = 1; i <= 12; i++) {
      const day = String(i).padStart(2, "0");
      items.push(
        item({
          id: `c${i}`,
          type: "task",
          status: "complete",
          completedAt: `2026-05-${day}T12:00:00.000Z`,
          label: `c${i}`,
        })
      );
    }
    const lists = buildPlanReportLists([phase("p", 0, items)], REPORT_DATE);
    expect(lists.planActivitiesCompleted.items).toHaveLength(PLAN_REPORT_LIST_LIMIT);
    expect(lists.planActivitiesCompleted.items[0]?.id).toBe("c12");
    expect(lists.planActivitiesCompleted.items[9]?.id).toBe("c3");
    expect(lists.planActivitiesCompleted.overflowCount).toBe(2);
  });
});

describe("buildPlanReportLists — upcoming activities", () => {
  it("excludes meetings, completed items, and items that ended before the report date", () => {
    const lists = buildPlanReportLists(
      [
        phase("p", 0, [
          item({
            id: "later",
            type: "waiting_on_client",
            status: "not_started",
            startDate: "2026-07-01",
            endDate: "2026-07-10",
          }),
          item({
            id: "sooner",
            type: "task",
            status: "in_progress",
            startDate: "2026-06-10",
            endDate: "2026-06-15",
            reportLabel: "UAT",
            label: "raw",
          }),
          item({
            id: "already-ended",
            type: "task",
            status: "in_progress",
            startDate: "2026-05-01",
            endDate: "2026-06-14",
          }),
          item({
            id: "complete-task",
            type: "task",
            status: "complete",
            startDate: "2026-06-20",
            endDate: "2026-06-30",
            completedAt: "2026-06-10T00:00:00.000Z",
          }),
          meeting({
            id: "open-meeting",
            order: 8,
            meetingStatus: "scheduled",
            startDate: "2026-06-20",
          }),
        ]),
      ],
      REPORT_DATE
    );

    expect(lists.planActivitiesUpcoming.items.map((a) => a.id)).toEqual(["sooner", "later"]);
    expect(lists.planActivitiesUpcoming.items[0]).toMatchObject({
      label: "UAT",
      date: "2026-06-10",
    });
  });

  it("does not filter showOnReports and caps with overflow", () => {
    const items: PlanItemJson[] = [];
    for (let i = 1; i <= 11; i++) {
      const day = String(i).padStart(2, "0");
      items.push(
        item({
          id: `u${i}`,
          type: "task" as PlanItemType,
          status: "not_started",
          startDate: `2026-07-${day}`,
          endDate: "2026-08-01",
          showOnReports: false,
        })
      );
    }
    const lists = buildPlanReportLists([phase("p", 0, items)], REPORT_DATE);
    expect(lists.planActivitiesUpcoming.items).toHaveLength(PLAN_REPORT_LIST_LIMIT);
    expect(lists.planActivitiesUpcoming.items[0]?.id).toBe("u1");
    expect(lists.planActivitiesUpcoming.overflowCount).toBe(1);
  });
});

describe("buildPlanReportLists — empty", () => {
  it("returns empty arrays when there is no plan or no items", () => {
    expect(buildPlanReportLists(undefined, REPORT_DATE).planMeetings.scheduled).toEqual([]);
    expect(buildPlanReportLists([], REPORT_DATE).planActivitiesCompleted.items).toEqual([]);
    expect(buildPlanReportLists([phase("p", 0, [])], REPORT_DATE).planActivitiesUpcoming.items).toEqual(
      []
    );
  });
});

describe("capMeetingsForDisplay", () => {
  function row(id: string): PlanReportListItem {
    return { id, label: id, date: null, extra: null };
  }

  it("keeps needs-scheduling first and reports overflow past 10", () => {
    const needsScheduling = Array.from({ length: 7 }, (_, i) => row(`n${i}`));
    const scheduled = Array.from({ length: 6 }, (_, i) => row(`s${i}`));
    const capped = capMeetingsForDisplay({ needsScheduling, scheduled });
    expect(capped.needsScheduling.map((m) => m.id)).toEqual(
      needsScheduling.map((m) => m.id)
    );
    expect(capped.scheduled.map((m) => m.id)).toEqual(["s0", "s1", "s2"]);
    expect(capped.overflowCount).toBe(3);
  });
});

describe("planListEmptyMessage", () => {
  it("asks to enable Plan when the project has no Plan", () => {
    expect(planListEmptyMessage("meetings", false)).toBe(PLAN_LIST_ENABLE_MESSAGE);
    expect(planListEmptyMessage("completed", false)).toBe(PLAN_LIST_ENABLE_MESSAGE);
    expect(planListEmptyMessage("upcoming", false)).toBe(PLAN_LIST_ENABLE_MESSAGE);
  });

  it("uses list-specific empty copy when Plan is available", () => {
    expect(planListEmptyMessage("meetings", true)).toBe("No upcoming meetings.");
    expect(planListEmptyMessage("completed", true)).toBe("No completed activities.");
    expect(planListEmptyMessage("upcoming", true)).toBe("No upcoming activities.");
  });
});

describe("mergePlanListsIntoSnapshot", () => {
  it("replaces the three list keys and preserves other snapshot fields", () => {
    const lists: PlanReportLists = {
      planMeetings: {
        needsScheduling: [{ id: "n1", label: "Kickoff", date: null, extra: null }],
        scheduled: [],
      },
      planActivitiesCompleted: { items: [], overflowCount: 0 },
      planActivitiesUpcoming: {
        items: [{ id: "u1", label: "UAT", date: "2026-07-01", extra: null }],
        overflowCount: 0,
      },
    };
    const merged = mergePlanListsIntoSnapshot(
      {
        period: "Jun 8 – Jun 12, 2026",
        today: "Jun 15, 2026",
        budget: { estBudgetHigh: 1 } as never,
      },
      lists
    );
    expect(merged.period).toBe("Jun 8 – Jun 12, 2026");
    expect(merged.budget).toEqual({ estBudgetHigh: 1 });
    expect(merged.planMeetings.needsScheduling.map((m) => m.id)).toEqual(["n1"]);
    expect(merged.planActivitiesUpcoming.items[0]?.label).toBe("UAT");
  });
});
