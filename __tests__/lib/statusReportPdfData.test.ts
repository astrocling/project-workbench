import { describe, expect, it } from "vitest";
import {
  applyCdaBudgetRefresh,
  resolvePlanDensity,
  resolveScheduleSource,
  resolveShowBudget,
  shouldAttachBudgetToPdfData,
  shouldRebuildCdaBudgetFromProject,
  shouldShowRefreshBudget,
  shouldUseLockedSnapshotBudget,
  type StatusReportSnapshot,
} from "@/lib/statusReportPdfData";
import {
  cdaOverallHoursPlanned,
  type StatusReportPDFData,
} from "@/components/pdf/StatusReportDocument";

const baseSnapshot: StatusReportSnapshot = {
  period: "Jan 1 – Jan 5, 2026",
  today: "Jan 6, 2026",
};

const lockedBudget = {
  estBudgetHigh: 0,
  estBudgetLow: 0,
  spentDollars: 100,
  remainingDollarsHigh: -100,
  remainingDollarsLow: -100,
  budgetedHoursHigh: 0,
  budgetedHoursLow: 0,
  actualHours: 10,
  remainingHoursHigh: -10,
  remainingHoursLow: -10,
  burnPercentHigh: null,
};

describe("resolveScheduleSource", () => {
  it("defaults to timeline", () => {
    expect(resolveScheduleSource(baseSnapshot)).toBe("timeline");
  });
  it("uses snapshot plan unless options override", () => {
    expect(resolveScheduleSource({ ...baseSnapshot, scheduleSource: "plan" })).toBe("plan");
    expect(
      resolveScheduleSource({ ...baseSnapshot, scheduleSource: "plan" }, { scheduleSource: "timeline" })
    ).toBe("timeline");
  });
});

describe("resolvePlanDensity", () => {
  it("defaults to phases_and_key_dates", () => {
    expect(resolvePlanDensity(baseSnapshot)).toBe("phases_and_key_dates");
  });
  it("honors snapshot phases", () => {
    expect(resolvePlanDensity({ ...baseSnapshot, planDensity: "phases" })).toBe("phases");
  });
});

describe("resolveShowBudget", () => {
  it("defaults to true when snapshot is null", () => {
    expect(resolveShowBudget(null)).toBe(true);
  });

  it("defaults to true when showBudget is absent from snapshot", () => {
    expect(resolveShowBudget(baseSnapshot)).toBe(true);
  });

  it("returns false when snapshot.showBudget is false", () => {
    expect(resolveShowBudget({ ...baseSnapshot, showBudget: false })).toBe(false);
  });

  it("returns true when snapshot.showBudget is true", () => {
    expect(resolveShowBudget({ ...baseSnapshot, showBudget: true })).toBe(true);
  });
});

describe("shouldAttachBudgetToPdfData", () => {
  it("attaches budget for Standard and Milestones reports", () => {
    expect(shouldAttachBudgetToPdfData("Standard")).toBe(true);
    expect(shouldAttachBudgetToPdfData("Milestones")).toBe(true);
  });

  it("attaches budget for CDA so Overall Planned can use budget high hours", () => {
    expect(shouldAttachBudgetToPdfData("CDA")).toBe(true);
  });

  it("does not attach budget for Modular", () => {
    expect(shouldAttachBudgetToPdfData("Modular")).toBe(false);
  });
});

describe("shouldShowRefreshBudget", () => {
  it("shows Refresh budget for Standard, Milestones, and CDA (not only Standard)", () => {
    expect(shouldShowRefreshBudget("Standard")).toBe(true);
    expect(shouldShowRefreshBudget("Milestones")).toBe(true);
    expect(shouldShowRefreshBudget("CDA")).toBe(true);
  });

  it("hides Refresh budget for Modular", () => {
    expect(shouldShowRefreshBudget("Modular")).toBe(false);
  });
});

describe("shouldUseLockedSnapshotBudget", () => {
  it("uses locked snapshot budget when present", () => {
    expect(
      shouldUseLockedSnapshotBudget({ ...baseSnapshot, budget: lockedBudget })
    ).toBe(true);
  });

  it("does not use locked budget when snapshot has no budget key", () => {
    expect(shouldUseLockedSnapshotBudget(baseSnapshot)).toBe(false);
    expect(shouldUseLockedSnapshotBudget(null)).toBe(false);
  });

  it("ignores locked snapshot budget when rebuildBudgetFromProject is true", () => {
    expect(
      shouldUseLockedSnapshotBudget(
        { ...baseSnapshot, budget: lockedBudget },
        { rebuildBudgetFromProject: true }
      )
    ).toBe(false);
  });
});

describe("shouldRebuildCdaBudgetFromProject", () => {
  it("rebuilds CDA budget fields when refresh-budget runs on a CDA report", () => {
    expect(
      shouldRebuildCdaBudgetFromProject("CDA", { rebuildBudgetFromProject: true })
    ).toBe(true);
  });

  it("does not rebuild CDA budget for Standard or when not refreshing", () => {
    expect(
      shouldRebuildCdaBudgetFromProject("Standard", { rebuildBudgetFromProject: true })
    ).toBe(false);
    expect(shouldRebuildCdaBudgetFromProject("CDA")).toBe(false);
    expect(shouldRebuildCdaBudgetFromProject("CDA", {})).toBe(false);
  });
});

describe("applyCdaBudgetRefresh", () => {
  const lockedMilestones = [
    {
      id: "m1",
      phase: "May Sprint",
      devStartDate: "2026-05-01",
      devEndDate: "2026-05-15",
      uatStartDate: "2026-05-16",
      uatEndDate: "2026-05-22",
      deployDate: "2026-05-23",
      completed: false,
    },
  ];

  const staleCda = {
    rows: [{ monthKey: "2026-08", monthLabel: "August", planned: 40, mtdActuals: 44.75 }],
    overallBudget: { totalDollars: 10000, actualDollars: 5000 },
    totalPlanned: 40,
    totalMtdActuals: 44.75,
    totalRemaining: -4.75,
    milestones: lockedMilestones,
  };

  const liveCdaBudget = {
    rows: [{ monthKey: "2026-08", monthLabel: "August", planned: 40, mtdActuals: 45 }],
    overallBudget: { totalDollars: 10000, actualDollars: 5100 },
    totalPlanned: 40,
    totalMtdActuals: 45,
    totalRemaining: -5,
  };

  it("updates CDA hours and dollars from live actuals while keeping locked milestones", () => {
    const next = applyCdaBudgetRefresh(staleCda, liveCdaBudget);
    expect(next.totalMtdActuals).toBe(45);
    expect(next.rows[0]?.mtdActuals).toBe(45);
    expect(next.overallBudget?.actualDollars).toBe(5100);
    expect(next.milestones).toEqual(lockedMilestones);
  });

  it("works when the snapshot had no CDA block yet", () => {
    const next = applyCdaBudgetRefresh(undefined, liveCdaBudget);
    expect(next.totalMtdActuals).toBe(45);
    expect(next.milestones).toBeUndefined();
  });
});

describe("cdaOverallHoursPlanned", () => {
  const baseCdaData = {
    report: {
      reportDate: "2026-08-06",
      variation: "CDA" as const,
      completedActivities: "",
      upcomingActivities: "",
      risksIssuesDecisions: "",
      meetingNotes: null,
      ragOverall: "Green" as const,
      ragScope: "Green" as const,
      ragSchedule: "Green" as const,
      ragBudget: "Green" as const,
      ragOverallExplanation: null,
      ragScopeExplanation: null,
      ragScheduleExplanation: null,
      ragBudgetExplanation: null,
    },
    project: {
      name: "Test",
      clientName: "Client",
      clientSponsor: null,
      clientSponsor2: null,
      otherContact: null,
      keyStaffName: null,
      projectKeyRoles: [],
    },
    period: "Jul 27 – Jul 31, 2026",
    today: "Aug 6, 2026",
    cda: {
      rows: [],
      overallBudget: null,
      totalPlanned: 780,
      totalMtdActuals: 632.25,
      totalRemaining: 147.75,
    },
  } satisfies Partial<StatusReportPDFData> as StatusReportPDFData;

  it("uses budgetedHoursHigh when present, not sum of CDA monthly planned", () => {
    const data: StatusReportPDFData = {
      ...baseCdaData,
      budget: {
        estBudgetHigh: 97200,
        estBudgetLow: 97200,
        spentDollars: 0,
        remainingDollarsHigh: 0,
        remainingDollarsLow: 0,
        budgetedHoursHigh: 720,
        budgetedHoursLow: 720,
        actualHours: 0,
        remainingHoursHigh: 0,
        remainingHoursLow: 0,
        burnPercentHigh: null,
      },
    };
    expect(cdaOverallHoursPlanned(data)).toBe(720);
  });

  it("falls back to cda.totalPlanned when budget high hours are missing", () => {
    expect(cdaOverallHoursPlanned(baseCdaData)).toBe(780);
  });
});
