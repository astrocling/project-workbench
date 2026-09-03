import { describe, expect, it } from "vitest";
import {
  isPlanScheduleCreateRequest,
  PLAN_NOT_ENABLED_ERROR,
  PLAN_SCHEDULE_EMPTY_ERROR,
  PLAN_SCHEDULE_PHASES_ONLY_POINT_DATES_ERROR,
  PROJECT_END_DATE_REQUIRED_ERROR,
  resolvePlanScheduleEmptyError,
  resolveScheduleRebuildError,
  TIMELINE_SCHEDULE_EMPTY_ERROR,
  validatePlanScheduleCreateEligibility,
} from "@/lib/plan/reportScheduleErrors";

describe("reportScheduleErrors", () => {
  it("exposes stable Plan schedule error copy", () => {
    expect(PLAN_NOT_ENABLED_ERROR).toBe("Plan is not enabled for this project.");
    expect(PLAN_SCHEDULE_EMPTY_ERROR).toContain("Plan tab");
    expect(PROJECT_END_DATE_REQUIRED_ERROR).toContain("project end date");
  });

  describe("resolvePlanScheduleEmptyError", () => {
    it("suggests Phases + key dates when density is phases", () => {
      expect(resolvePlanScheduleEmptyError("phases")).toBe(
        PLAN_SCHEDULE_PHASES_ONLY_POINT_DATES_ERROR
      );
      expect(PLAN_SCHEDULE_PHASES_ONLY_POINT_DATES_ERROR).toContain("Phases + key dates");
    });

    it("uses generic Plan empty copy for key-dates density", () => {
      expect(resolvePlanScheduleEmptyError("phases_and_key_dates")).toBe(
        PLAN_SCHEDULE_EMPTY_ERROR
      );
      expect(resolvePlanScheduleEmptyError(undefined)).toBe(PLAN_SCHEDULE_EMPTY_ERROR);
    });
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

    it("returns density-aware Plan empty message when end date exists", () => {
      expect(
        resolveScheduleRebuildError("plan", {
          hasProjectEndDate: true,
          planDensity: "phases",
        })
      ).toBe(PLAN_SCHEDULE_PHASES_ONLY_POINT_DATES_ERROR);
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

  describe("validatePlanScheduleCreateEligibility", () => {
    it("blocks create when plan is disabled", () => {
      expect(
        validatePlanScheduleCreateEligibility({ planEnabled: false, hasEndDate: true })
      ).toBe(PLAN_NOT_ENABLED_ERROR);
    });

    it("blocks create when project end date is missing", () => {
      expect(
        validatePlanScheduleCreateEligibility({ planEnabled: true, hasEndDate: false })
      ).toBe(PROJECT_END_DATE_REQUIRED_ERROR);
    });

    it("returns null when plan create is eligible", () => {
      expect(
        validatePlanScheduleCreateEligibility({ planEnabled: true, hasEndDate: true })
      ).toBeNull();
    });
  });
});
