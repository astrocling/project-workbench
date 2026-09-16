import { describe, expect, it } from "vitest";
import {
  MODULAR_DEFAULT_DOCUMENT,
  type ModularPanelsDocument,
} from "@/lib/reportPanels";
import {
  PREVIOUS_MONTHS_ON_SCHEDULE_LABEL,
  buildScheduleSourceCreatePayload,
  createScheduleFormDefaults,
  detailedPlanCheckboxLabel,
  isScheduleEligibleVariation,
  planDensityLabel,
  scheduleSourceLabel,
  shouldAttachBudgetToPdfData,
  shouldLockModularTimelineOnCreate,
  shouldResetScheduleDefaultsOnVariationChange,
  shouldShowPreviousMonthsOnSchedule,
  shouldShowRefreshBudget,
  shouldShowRefreshPlanLists,
  shouldShowRefreshTimeline,
  shouldShowScheduleSourceFields,
  shouldUseLockedPlanLists,
} from "@/lib/statusReportFlags";

describe("isScheduleEligibleVariation", () => {
  it("is true for Standard, Milestones, and Modular", () => {
    expect(isScheduleEligibleVariation("Standard")).toBe(true);
    expect(isScheduleEligibleVariation("Milestones")).toBe(true);
    expect(isScheduleEligibleVariation("Modular")).toBe(true);
    expect(isScheduleEligibleVariation("CDA")).toBe(false);
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
  it("preserves schedule choices among Standard, Milestones, and Modular", () => {
    expect(
      shouldResetScheduleDefaultsOnVariationChange("Standard", "Milestones")
    ).toBe(false);
    expect(
      shouldResetScheduleDefaultsOnVariationChange("Milestones", "Standard")
    ).toBe(false);
    expect(
      shouldResetScheduleDefaultsOnVariationChange("Standard", "Modular")
    ).toBe(false);
    expect(
      shouldResetScheduleDefaultsOnVariationChange("Modular", "Milestones")
    ).toBe(false);
  });

  it("reapplies defaults when entering an eligible variation from CDA", () => {
    expect(shouldResetScheduleDefaultsOnVariationChange("CDA", "Standard")).toBe(
      true
    );
    expect(shouldResetScheduleDefaultsOnVariationChange("CDA", "Modular")).toBe(
      true
    );
  });

  it("does not reset when leaving eligible variations for CDA", () => {
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

  it("includes schedule fields for Modular when Plan is enabled", () => {
    expect(
      buildScheduleSourceCreatePayload(true, "Modular", "timeline", "phases")
    ).toEqual({ scheduleSource: "timeline" });
    expect(
      buildScheduleSourceCreatePayload(
        true,
        "Modular",
        "plan",
        "phases_and_key_dates"
      )
    ).toEqual({
      scheduleSource: "plan",
      planDensity: "phases_and_key_dates",
    });
  });
});

describe("detailedPlanCheckboxLabel", () => {
  it("uses Modular copy for the detailed-plan checkbox", () => {
    expect(detailedPlanCheckboxLabel("Modular")).toBe(
      "Add full project plan to report"
    );
    expect(detailedPlanCheckboxLabel("Standard")).toBe(
      "Include detailed plan page"
    );
  });
});

describe("shouldLockModularTimelineOnCreate", () => {
  it("locks Modular timeline when Plan is selected even without a gantt module", () => {
    expect(shouldLockModularTimelineOnCreate(false, "plan")).toBe(true);
    expect(shouldLockModularTimelineOnCreate(false, "timeline")).toBe(false);
    expect(shouldLockModularTimelineOnCreate(true, "timeline")).toBe(true);
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
  it("is for Project timeline and Plan compact window lookback", () => {
    expect(shouldShowPreviousMonthsOnSchedule("timeline")).toBe(true);
    expect(shouldShowPreviousMonthsOnSchedule("plan")).toBe(true);
  });
});

const modularWithBudgetFinancials: ModularPanelsDocument = {
  version: 1,
  layout: {
    pages: [
      {
        header: "full",
        rows: [
          {
            id: "r1",
            shape: "full",
            height: "tall",
            moduleIds: ["bf"],
          },
        ],
      },
    ],
  },
  modules: {
    bf: { id: "bf", type: "budgetFinancials", data: {} },
  },
};

const modularWithTimeline: ModularPanelsDocument = {
  version: 1,
  layout: {
    pages: [
      {
        header: "full",
        rows: [
          {
            id: "r1",
            shape: "full",
            height: "tall",
            moduleIds: ["gt"],
          },
        ],
      },
    ],
  },
  modules: {
    gt: { id: "gt", type: "ganttTimeline", data: {} },
  },
};

describe("shouldAttachBudgetToPdfData", () => {
  it("attaches budget for Standard, Milestones, and CDA regardless of panels", () => {
    expect(shouldAttachBudgetToPdfData("Standard")).toBe(true);
    expect(shouldAttachBudgetToPdfData("Milestones", modularWithTimeline)).toBe(true);
    expect(shouldAttachBudgetToPdfData("CDA", MODULAR_DEFAULT_DOCUMENT)).toBe(true);
  });

  it("does not attach budget for Classic Modular default (no budget modules)", () => {
    expect(shouldAttachBudgetToPdfData("Modular", MODULAR_DEFAULT_DOCUMENT)).toBe(false);
    expect(shouldAttachBudgetToPdfData("Modular")).toBe(false);
  });

  it("attaches budget for Modular when a budgetFinancials module is in the document", () => {
    expect(shouldAttachBudgetToPdfData("Modular", modularWithBudgetFinancials)).toBe(
      true
    );
  });
});

describe("shouldShowRefreshBudget", () => {
  it("matches attach flags for Standard/CDA and Modular documents", () => {
    expect(shouldShowRefreshBudget("Standard")).toBe(true);
    expect(shouldShowRefreshBudget("Milestones")).toBe(true);
    expect(shouldShowRefreshBudget("CDA")).toBe(true);
    expect(shouldShowRefreshBudget("Modular", MODULAR_DEFAULT_DOCUMENT)).toBe(false);
    expect(shouldShowRefreshBudget("Modular", modularWithBudgetFinancials)).toBe(true);
  });
});

describe("shouldShowRefreshTimeline", () => {
  it("shows for Standard and Milestones, not CDA", () => {
    expect(shouldShowRefreshTimeline("Standard")).toBe(true);
    expect(shouldShowRefreshTimeline("Milestones")).toBe(true);
    expect(shouldShowRefreshTimeline("CDA")).toBe(false);
  });

  it("shows for Modular only when a ganttTimeline module is in the document", () => {
    expect(shouldShowRefreshTimeline("Modular", MODULAR_DEFAULT_DOCUMENT)).toBe(false);
    expect(shouldShowRefreshTimeline("Modular", modularWithTimeline)).toBe(true);
  });
});

const modularWithPlanMeetings: ModularPanelsDocument = {
  version: 1,
  layout: {
    pages: [
      {
        header: "full",
        rows: [
          {
            id: "r1",
            shape: "full",
            height: "tall",
            moduleIds: ["pm"],
          },
        ],
      },
    ],
  },
  modules: {
    pm: { id: "pm", type: "planMeetings", data: {} },
  },
};

describe("shouldShowRefreshPlanLists", () => {
  it("is only for Modular reports with a placed plan list module", () => {
    expect(shouldShowRefreshPlanLists("Standard")).toBe(false);
    expect(shouldShowRefreshPlanLists("Modular", MODULAR_DEFAULT_DOCUMENT)).toBe(false);
    expect(shouldShowRefreshPlanLists("Modular", modularWithPlanMeetings)).toBe(true);
  });
});

describe("shouldUseLockedPlanLists", () => {
  const lists = {
    planMeetings: { needsScheduling: [], scheduled: [] },
    planActivitiesCompleted: { items: [], overflowCount: 0 },
    planActivitiesUpcoming: { items: [], overflowCount: 0 },
  };

  it("uses locked lists when all three snapshot keys exist", () => {
    expect(shouldUseLockedPlanLists(lists)).toBe(true);
  });

  it("rebuilds when any list key is missing or refresh is requested", () => {
    expect(shouldUseLockedPlanLists({})).toBe(false);
    expect(shouldUseLockedPlanLists(lists, { rebuildPlanListsFromProject: true })).toBe(false);
  });
});
