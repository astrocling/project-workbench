import { describe, expect, it } from "vitest";
import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";
import { compactPlanToSchedule } from "@/lib/plan/reportSchedule";

function item(
  partial: Partial<PlanItemJson> & Pick<PlanItemJson, "id" | "phaseId" | "label">
): PlanItemJson {
  return {
    type: "task",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    order: 0,
    parentItemId: null,
    meetingStatus: null,
    scheduledTime: null,
    ...partial,
  };
}

function phase(
  partial: Partial<PlanPhaseJson> & Pick<PlanPhaseJson, "id" | "name" | "items">
): PlanPhaseJson {
  return {
    planId: "plan-1",
    color: "#1941FA",
    order: 0,
    ...partial,
  };
}

describe("compactPlanToSchedule", () => {
  it("returns null for empty phases", () => {
    expect(compactPlanToSchedule([], "phases")).toBeNull();
    expect(compactPlanToSchedule([], "phases_and_key_dates")).toBeNull();
  });

  it("omits phases with no items and returns null when all are empty", () => {
    expect(
      compactPlanToSchedule(
        [
          phase({ id: "p1", name: "Empty", order: 0, items: [] }),
          phase({ id: "p2", name: "Also empty", order: 1, items: [] }),
        ],
        "phases"
      )
    ).toBeNull();
  });

  it("maps phase order to rowIndex with wrap at 4", () => {
    const order0 = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Discovery",
          order: 0,
          items: [item({ id: "i1", phaseId: "p1", label: "Task" })],
        }),
      ],
      "phases"
    );
    expect(order0?.bars).toEqual([
      {
        rowIndex: 1,
        label: "Discovery",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        color: null,
      },
    ]);

    const order4 = compactPlanToSchedule(
      [
        phase({
          id: "p2",
          name: "Deployment",
          order: 4,
          items: [item({ id: "i2", phaseId: "p2", label: "Task" })],
        }),
      ],
      "phases"
    );
    expect(order4?.bars[0]?.rowIndex).toBe(1);
  });

  it("builds phase bars from min/max item dates with no markers in phases density", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Build",
          order: 0,
          items: [
            item({
              id: "i1",
              phaseId: "p1",
              label: "Early",
              startDate: "2026-03-01",
              endDate: "2026-03-05",
            }),
            item({
              id: "i2",
              phaseId: "p1",
              label: "Late",
              startDate: "2026-03-10",
              endDate: "2026-03-12",
            }),
          ],
        }),
      ],
      "phases"
    );

    expect(result).toEqual({
      bars: [
        {
          rowIndex: 1,
          label: "Build",
          startDate: "2026-03-01",
          endDate: "2026-03-12",
          color: null,
        },
      ],
      markers: [],
    });
  });

  it("includes key-date markers and omits tasks, assumed meetings, and waiting_on_client", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Delivery",
          order: 1,
          items: [
            item({
              id: "task",
              phaseId: "p1",
              label: "Implement",
              type: "task",
              startDate: "2026-04-01",
              endDate: "2026-04-10",
            }),
            item({
              id: "milestone",
              phaseId: "p1",
              label: "Alpha",
              type: "milestone",
              startDate: "2026-04-05",
              endDate: "2026-04-05",
            }),
            item({
              id: "signoff",
              phaseId: "p1",
              label: "Client sign-off",
              type: "sign_off",
              startDate: "2026-04-08",
              endDate: "2026-04-08",
            }),
            item({
              id: "deadline",
              phaseId: "p1",
              label: "Launch deadline",
              type: "hard_deadline",
              startDate: "2026-04-15",
              endDate: "2026-04-15",
            }),
            item({
              id: "meeting",
              phaseId: "p1",
              label: "Kickoff call",
              type: "meeting",
              meetingStatus: "scheduled",
              startDate: "2026-04-02",
              endDate: "2026-04-02",
            }),
            item({
              id: "assumed",
              phaseId: "p1",
              label: "Weekly sync",
              type: "meeting",
              meetingStatus: "assumed",
              startDate: "2026-04-03",
              endDate: "2026-04-03",
            }),
            item({
              id: "waiting",
              phaseId: "p1",
              label: "Waiting on client",
              type: "waiting_on_client",
              startDate: "2026-04-06",
              endDate: "2026-04-07",
            }),
          ],
        }),
      ],
      "phases_and_key_dates"
    );

    expect(result?.bars).toEqual([
      {
        rowIndex: 2,
        label: "Delivery",
        startDate: "2026-04-01",
        endDate: "2026-04-15",
        color: null,
      },
    ]);
    expect(result?.markers).toEqual([
      { label: "Alpha", date: "2026-04-05", shape: "Pin", rowIndex: 2 },
      { label: "Client sign-off", date: "2026-04-08", shape: "ThumbsUp", rowIndex: 2 },
      { label: "Launch deadline", date: "2026-04-15", shape: "BadgeAlert", rowIndex: 2 },
      { label: "Kickoff call", date: "2026-04-02", shape: "Rocket", rowIndex: 2 },
    ]);
  });

  it("uses nested tasks for phase bar dates but not as markers", () => {
    const result = compactPlanToSchedule(
      [
        phase({
          id: "p1",
          name: "Development",
          order: 2,
          items: [
            item({
              id: "parent",
              phaseId: "p1",
              label: "Parent task",
              type: "task",
              startDate: "2026-05-01",
              endDate: "2026-05-05",
              order: 0,
            }),
            item({
              id: "child",
              phaseId: "p1",
              label: "Nested task",
              type: "task",
              startDate: "2026-05-10",
              endDate: "2026-05-20",
              order: 1,
              parentItemId: "parent",
            }),
            item({
              id: "milestone",
              phaseId: "p1",
              label: "Code complete",
              type: "milestone",
              startDate: "2026-05-15",
              endDate: "2026-05-15",
              order: 2,
            }),
          ],
        }),
      ],
      "phases_and_key_dates"
    );

    expect(result?.bars).toEqual([
      {
        rowIndex: 3,
        label: "Development",
        startDate: "2026-05-01",
        endDate: "2026-05-20",
        color: null,
      },
    ]);
    expect(result?.markers).toEqual([
      { label: "Code complete", date: "2026-05-15", shape: "Pin", rowIndex: 3 },
    ]);
  });
});
