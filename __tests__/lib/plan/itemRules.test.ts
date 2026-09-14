import { describe, expect, it } from "vitest";
import { normalizeItemDates, validateItemPayload } from "@/lib/plan/itemRules";
import { meetingUiStatus, patchFromMeetingUiStatus, type PlanItemType } from "@/lib/plan/types";

const phaseA = "phase-a";
const phaseB = "phase-b";

const siblings = [
  { id: "root", phaseId: phaseA, parentItemId: null },
  { id: "child", phaseId: phaseA, parentItemId: "root" },
  { id: "grandchild", phaseId: phaseA, parentItemId: "child" },
  { id: "great", phaseId: phaseA, parentItemId: "grandchild" },
  { id: "other-phase", phaseId: phaseB, parentItemId: null },
];

describe("normalizeItemDates", () => {
  it("forces end = start for point types", () => {
    for (const type of ["milestone", "sign_off", "hard_deadline"] as PlanItemType[]) {
      expect(
        normalizeItemDates({
          type,
          startDate: "2025-02-17",
          endDate: "2025-02-21",
        })
      ).toEqual({ startDate: "2025-02-17", endDate: "2025-02-17" });
    }
  });

  it("forces end = start for scheduled meetings", () => {
    expect(
      normalizeItemDates({
        type: "meeting",
        meetingStatus: "scheduled",
        startDate: "2025-03-03",
        endDate: "2025-03-07",
      })
    ).toEqual({ startDate: "2025-03-03", endDate: "2025-03-03" });
  });

  it("keeps a range for unscheduled meetings", () => {
    expect(
      normalizeItemDates({
        type: "meeting",
        meetingStatus: "unscheduled",
        startDate: "2025-03-03",
        endDate: "2025-03-07",
      })
    ).toEqual({ startDate: "2025-03-03", endDate: "2025-03-07" });
  });

  it("keeps a range for tasks and waiting_on_client", () => {
    expect(
      normalizeItemDates({
        type: "task",
        startDate: "2025-02-17",
        endDate: "2025-02-21",
      })
    ).toEqual({ startDate: "2025-02-17", endDate: "2025-02-21" });
    expect(
      normalizeItemDates({
        type: "waiting_on_client",
        startDate: "2025-02-17",
        endDate: "2025-02-21",
      })
    ).toEqual({ startDate: "2025-02-17", endDate: "2025-02-21" });
  });
});

describe("validateItemPayload", () => {
  it("requires meetingStatus on meeting items", () => {
    expect(
      validateItemPayload(
        {
          type: "meeting",
          startDate: "2025-03-03",
          endDate: "2025-03-03",
          phaseId: phaseA,
        },
        siblings
      )
    ).toBe("Meeting items require a meetingStatus");
  });

  it("allows a date range for unscheduled meetings", () => {
    expect(
      validateItemPayload(
        {
          type: "meeting",
          meetingStatus: "unscheduled",
          startDate: "2025-03-03",
          endDate: "2025-03-07",
          phaseId: phaseA,
        },
        siblings
      )
    ).toBeNull();
  });

  it("requires a single date for scheduled meetings", () => {
    expect(
      validateItemPayload(
        {
          type: "meeting",
          meetingStatus: "scheduled",
          startDate: "2025-03-03",
          endDate: "2025-03-07",
          phaseId: phaseA,
        },
        siblings
      )
    ).toBe("Point items must use a single date");
  });

  it("requires a single date for point types", () => {
    expect(
      validateItemPayload(
        {
          type: "milestone",
          startDate: "2025-02-17",
          endDate: "2025-02-21",
          phaseId: phaseA,
        },
        siblings
      )
    ).toBe("Point items must use a single date");
  });

  it("rejects inverted ranges", () => {
    expect(
      validateItemPayload(
        {
          type: "task",
          startDate: "2025-02-21",
          endDate: "2025-02-17",
          phaseId: phaseA,
        },
        siblings
      )
    ).toBe("Start date must be on or before end date");
  });

  it("rejects a parent in a different phase", () => {
    expect(
      validateItemPayload(
        {
          type: "task",
          startDate: "2025-02-17",
          endDate: "2025-02-21",
          phaseId: phaseA,
          parentItemId: "other-phase",
        },
        siblings
      )
    ).toBe("Parent must be in the same phase");
  });

  it("rejects a missing parent", () => {
    expect(
      validateItemPayload(
        {
          type: "task",
          startDate: "2025-02-17",
          endDate: "2025-02-21",
          phaseId: phaseA,
          parentItemId: "missing",
        },
        siblings
      )
    ).toBe("Parent item not found");
  });

  it("rejects cycles", () => {
    expect(
      validateItemPayload(
        {
          type: "task",
          startDate: "2025-02-17",
          endDate: "2025-02-21",
          phaseId: phaseA,
          parentItemId: "grandchild",
          itemId: "root",
        },
        siblings
      )
    ).toBe("Nesting would create a cycle");
  });

  it("rejects nesting deeper than 3", () => {
    expect(
      validateItemPayload(
        {
          type: "task",
          startDate: "2025-02-17",
          endDate: "2025-02-21",
          phaseId: phaseA,
          parentItemId: "great",
        },
        siblings
      )
    ).toBe("Items cannot be nested deeper than 3 levels");
  });

  it("allows nesting at depth 3", () => {
    expect(
      validateItemPayload(
        {
          type: "task",
          startDate: "2025-02-17",
          endDate: "2025-02-21",
          phaseId: phaseA,
          parentItemId: "grandchild",
        },
        siblings
      )
    ).toBeNull();
  });
});

describe("meetingUiStatus", () => {
  it("maps unscheduled, scheduled, and complete", () => {
    expect(meetingUiStatus({ meetingStatus: "unscheduled", status: "not_started" })).toBe(
      "unscheduled"
    );
    expect(meetingUiStatus({ meetingStatus: "scheduled", status: "not_started" })).toBe(
      "scheduled"
    );
    expect(meetingUiStatus({ meetingStatus: "scheduled", status: "in_progress" })).toBe(
      "scheduled"
    );
    expect(meetingUiStatus({ meetingStatus: "scheduled", status: "complete" })).toBe("complete");
  });
});

describe("patchFromMeetingUiStatus", () => {
  it("schedules and completes on the start date", () => {
    expect(patchFromMeetingUiStatus({ startDate: "2026-03-15" }, "scheduled")).toEqual({
      meetingStatus: "scheduled",
      status: "not_started",
      endDate: "2026-03-15",
    });
    expect(patchFromMeetingUiStatus({ startDate: "2026-03-15" }, "complete")).toEqual({
      meetingStatus: "scheduled",
      status: "complete",
      endDate: "2026-03-15",
    });
    expect(patchFromMeetingUiStatus({ startDate: "2026-03-15" }, "unscheduled")).toEqual({
      meetingStatus: "unscheduled",
      status: "not_started",
    });
  });
});
