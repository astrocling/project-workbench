import { describe, expect, it } from "vitest";
import {
  isPlanScheduleCreateRequest,
  PLAN_NOT_ENABLED_ERROR,
  PLAN_SCHEDULE_EMPTY_ERROR,
  PROJECT_END_DATE_REQUIRED_ERROR,
  resolveScheduleRebuildError,
  TIMELINE_SCHEDULE_EMPTY_ERROR,
} from "@/lib/plan/reportScheduleErrors";

describe("reportScheduleErrors", () => {
  it("exposes stable Plan schedule error copy", () => {
    expect(PLAN_NOT_ENABLED_ERROR).toBe("Plan is not enabled for this project.");
    expect(PLAN_SCHEDULE_EMPTY_ERROR).toContain("Plan tab");
    expect(PROJECT_END_DATE_REQUIRED_ERROR).toContain("project end date");
  });

  describe("resolveScheduleRebuildError", () => {
    it("returns end-date message before source-specific empty schedule copy", () => {
      expect(
        resolveScheduleRebuildError("plan", { hasProjectEndDate: false })
      ).toBe(PROJECT_END_DATE_REQUIRED_ERROR);
      expect(
        resolveScheduleRebuildError("timeline", { hasProjectEndDate: false })
      ).toBe(PROJECT_END_DATE_REQUIRED_ERROR);
    });

    it("returns Plan empty message when end date exists and source is plan", () => {
      expect(
        resolveScheduleRebuildError("plan", { hasProjectEndDate: true })
      ).toBe(PLAN_SCHEDULE_EMPTY_ERROR);
    });

    it("returns Timeline empty message when end date exists and source is timeline", () => {
      expect(
        resolveScheduleRebuildError("timeline", { hasProjectEndDate: true })
      ).toBe(TIMELINE_SCHEDULE_EMPTY_ERROR);
    });
  });

  describe("isPlanScheduleCreateRequest", () => {
    it("is true only for Standard/Milestones with scheduleSource plan", () => {
      expect(isPlanScheduleCreateRequest("Standard", "plan")).toBe(true);
      expect(isPlanScheduleCreateRequest("Milestones", "plan")).toBe(true);
      expect(isPlanScheduleCreateRequest("Standard", "timeline")).toBe(false);
      expect(isPlanScheduleCreateRequest("CDA", "plan")).toBe(false);
      expect(isPlanScheduleCreateRequest("Modular", "plan")).toBe(false);
    });
  });
});
