import { describe, expect, it } from "vitest";
import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";
import { countPlanCompletion } from "@/lib/plan/completion";

function item(partial: Partial<PlanItemJson> & Pick<PlanItemJson, "id" | "phaseId" | "label">): PlanItemJson {
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

function phase(partial: Partial<PlanPhaseJson> & Pick<PlanPhaseJson, "id" | "name" | "items">): PlanPhaseJson {
  return {
    planId: "plan-1",
    color: "#1941FA",
    order: 0,
    ...partial,
  };
}

describe("countPlanCompletion", () => {
  it("counts completed items across phases", () => {
    const phases = [
      phase({
        id: "p1",
        name: "A",
        items: [
          item({ id: "i1", phaseId: "p1", label: "One", status: "complete" }),
          item({ id: "i2", phaseId: "p1", label: "Two", status: "in_progress" }),
        ],
      }),
      phase({
        id: "p2",
        name: "B",
        items: [item({ id: "i3", phaseId: "p2", label: "Three" })],
      }),
    ];
    expect(countPlanCompletion(phases)).toEqual({ completed: 1, total: 3, percent: 33 });
  });

  it("returns zeros when the plan has no items", () => {
    expect(countPlanCompletion([phase({ id: "p1", name: "Empty", items: [] })])).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
    });
  });
});
