import { describe, expect, it } from "vitest";
import {
  PREVIOUS_MONTHS_ON_SCHEDULE_LABEL,
  buildScheduleSourceCreatePayload,
  createScheduleFormDefaults,
  isScheduleEligibleVariation,
  planDensityLabel,
  scheduleSourceLabel,
  shouldResetScheduleDefaultsOnVariationChange,
  shouldShowPreviousMonthsOnSchedule,
  shouldShowScheduleSourceFields,
} from "@/lib/statusReportFlags";

describe("isScheduleEligibleVariation", () => {
  it("is true for Standard and Milestones only", () => {
    expect(isScheduleEligibleVariation("Standard")).toBe(true);
    expect(isScheduleEligibleVariation("Milestones")).toBe(true);
    expect(isScheduleEligibleVariation("CDA")).toBe(false);
    expect(isScheduleEligibleVariation("Modular")).toBe(false);
  });
});

describe("shouldShowScheduleSourceFields", () => {
  it("shows fields when Plan is enabled on the project", () => {
    expect(shouldShowScheduleSourceFields(true, "timeline")).toBe(true);
    expect(shouldShowScheduleSourceFields(true, "plan")).toBe(true);
  });

  it("shows locked fields when editing a Plan-source report after Plan is disabled", () => {
    expect(shouldShowScheduleSourceFields(false, "plan")).toBe(true);
  });

  it("hides fields when Plan is off and the report used timeline", () => {
    expect(shouldShowScheduleSourceFields(false, "timeline")).toBe(false);
  });
});

describe("shouldResetScheduleDefaultsOnVariationChange", () => {
  it("preserves schedule choices when switching Standard ↔ Milestones", () => {
    expect(
      shouldResetScheduleDefaultsOnVariationChange("Standard", "Milestones")
    ).toBe(false);
    expect(
      shouldResetScheduleDefaultsOnVariationChange("Milestones", "Standard")
    ).toBe(false);
  });

  it("reapplies defaults when entering Standard/Milestones from CDA or Modular", () => {
    expect(shouldResetScheduleDefaultsOnVariationChange("CDA", "Standard")).toBe(
      true
    );
    expect(
      shouldResetScheduleDefaultsOnVariationChange("Modular", "Milestones")
    ).toBe(true);
  });

  it("does not reset when leaving Standard/Milestones for other variations", () => {
    expect(shouldResetScheduleDefaultsOnVariationChange("Standard", "CDA")).toBe(
      false
    );
    expect(
      shouldResetScheduleDefaultsOnVariationChange("Milestones", "Modular")
    ).toBe(false);
  });
});

describe("createScheduleFormDefaults", () => {
  it("prefills schedule source from planReportDefault and default density", () => {
    expect(createScheduleFormDefaults("plan")).toEqual({
      scheduleSource: "plan",
      planDensity: "phases_and_key_dates",
    });
    expect(createScheduleFormDefaults("timeline")).toEqual({
      scheduleSource: "timeline",
      planDensity: "phases_and_key_dates",
    });
  });
});

describe("buildScheduleSourceCreatePayload", () => {
  it("omits schedule fields when Plan is off or variation is ineligible", () => {
    expect(
      buildScheduleSourceCreatePayload(false, "Standard", "plan", "phases")
    ).toEqual({});
    expect(
      buildScheduleSourceCreatePayload(true, "CDA", "plan", "phases")
    ).toEqual({});
    expect(
      buildScheduleSourceCreatePayload(true, "Modular", "timeline", "phases")
    ).toEqual({});
  });

  it("includes scheduleSource for eligible create when Plan is enabled", () => {
    expect(
      buildScheduleSourceCreatePayload(true, "Standard", "timeline", "phases")
    ).toEqual({ scheduleSource: "timeline" });
    expect(
      buildScheduleSourceCreatePayload(
        true,
        "Milestones",
        "plan",
        "phases_and_key_dates"
      )
    ).toEqual({
      scheduleSource: "plan",
      planDensity: "phases_and_key_dates",
    });
  });

  it("omits planDensity when schedule source is timeline", () => {
    expect(
      buildScheduleSourceCreatePayload(
        true,
        "Standard",
        "timeline",
        "phases_and_key_dates"
      )
    ).toEqual({ scheduleSource: "timeline" });
  });
});

describe("scheduleSourceLabel", () => {
  it("maps schedule sources to UI labels", () => {
    expect(scheduleSourceLabel("timeline")).toBe("Project timeline");
    expect(scheduleSourceLabel("plan")).toBe("Project Plan");
  });
});

describe("planDensityLabel", () => {
  it("maps plan density values to UI labels", () => {
    expect(planDensityLabel("phases")).toBe("Phases only");
    expect(planDensityLabel("phases_and_key_dates")).toBe("Phases + key dates");
  });
});

describe("PREVIOUS_MONTHS_ON_SCHEDULE_LABEL", () => {
  it("uses schedule-neutral copy", () => {
    expect(PREVIOUS_MONTHS_ON_SCHEDULE_LABEL).toBe("Previous months on schedule");
  });
});

describe("shouldShowPreviousMonthsOnSchedule", () => {
  it("is only for Project timeline source", () => {
    expect(shouldShowPreviousMonthsOnSchedule("timeline")).toBe(true);
    expect(shouldShowPreviousMonthsOnSchedule("plan")).toBe(false);
  });
});
