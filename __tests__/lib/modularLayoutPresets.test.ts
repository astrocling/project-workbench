import { describe, expect, it } from "vitest";
import {
  MODULAR_DEFAULT_DOCUMENT,
  normalizeModularPanels,
  shouldRenderModularPage2,
  type ModularPanelsDocument,
  type ModuleType,
} from "@/lib/reportPanels";
import {
  addModularRow,
  addModuleToSlot,
  appendModularContinuationPage,
  applyModularPreset,
  buildBudgetForwardDocument,
  buildClassicModularDocument,
  buildPlanDeliveryDocument,
  moveModularRow,
  removeModularRow,
  removeModuleFromSlot,
} from "@/lib/modularLayoutPresets";

function placedTypes(doc: ModularPanelsDocument): ModuleType[] {
  const types: ModuleType[] = [];
  for (const page of doc.layout.pages) {
    for (const row of page.rows) {
      for (const id of row.moduleIds) {
        if (id && doc.modules[id]) types.push(doc.modules[id].type);
      }
    }
  }
  return types;
}

function thirdsTypes(doc: ModularPanelsDocument): ModuleType[] {
  const row = doc.layout.pages[0].rows.find((r) => r.shape === "thirds");
  expect(row).toBeTruthy();
  return (row!.moduleIds as string[]).map((id) => doc.modules[id].type);
}

describe("buildClassicModularDocument", () => {
  it("places three typed narrative modules in the tall thirds row", () => {
    const doc = buildClassicModularDocument();
    expect(thirdsTypes(doc)).toEqual([
      "narrativeCompleted",
      "narrativeUpcoming",
      "narrativeRisks",
    ]);
    expect(doc.layout.pages).toHaveLength(1);
    expect(doc.layout.pages[0].header).toBe("full");
    expect(placedTypes(doc)).toEqual([
      "narrativeCompleted",
      "narrativeUpcoming",
      "narrativeRisks",
      "sprintSchedule",
      "storyPointMetrics",
      "donutKpi",
      "donutKpi",
    ]);
  });

  it("matches MODULAR_DEFAULT_DOCUMENT so new reports get typed columns", () => {
    expect(buildClassicModularDocument()).toEqual(MODULAR_DEFAULT_DOCUMENT);
    expect(thirdsTypes(MODULAR_DEFAULT_DOCUMENT)).toEqual([
      "narrativeCompleted",
      "narrativeUpcoming",
      "narrativeRisks",
    ]);
  });
});

describe("buildPlanDeliveryDocument", () => {
  it("places Plan activity types plus typed risks", () => {
    const doc = buildPlanDeliveryDocument({ planEnabled: false });
    expect(thirdsTypes(doc)).toEqual([
      "planActivitiesCompleted",
      "planActivitiesUpcoming",
      "narrativeRisks",
    ]);
  });

  it("uses a full meetings row when Plan is off", () => {
    const doc = buildPlanDeliveryDocument({ planEnabled: false });
    expect(placedTypes(doc)).toContain("planMeetings");
    expect(placedTypes(doc)).not.toContain("budgetCompactDollars");
    const meetingsRow = doc.layout.pages[0].rows.find((r) =>
      r.moduleIds.some((id) => id && doc.modules[id]?.type === "planMeetings")
    );
    expect(meetingsRow?.shape).toBe("full");
  });

  it("pairs meetings with compact budget dollars when Plan is on", () => {
    const doc = buildPlanDeliveryDocument({ planEnabled: true });
    expect(placedTypes(doc)).toEqual(
      expect.arrayContaining(["planMeetings", "budgetCompactDollars"])
    );
    const meetingsRow = doc.layout.pages[0].rows.find((r) =>
      r.moduleIds.some((id) => id && doc.modules[id]?.type === "planMeetings")
    );
    expect(meetingsRow?.shape).toBe("halves");
  });
});

describe("buildBudgetForwardDocument", () => {
  it("uses typed narratives and a full budgetFinancials row", () => {
    const doc = buildBudgetForwardDocument();
    expect(thirdsTypes(doc)).toEqual([
      "narrativeCompleted",
      "narrativeUpcoming",
      "narrativeRisks",
    ]);
    expect(placedTypes(doc)).toContain("budgetFinancials");
    const budgetRow = doc.layout.pages[0].rows.find((r) =>
      r.moduleIds.some((id) => id && doc.modules[id]?.type === "budgetFinancials")
    );
    expect(budgetRow?.shape).toBe("full");
  });
});

describe("normalizeModularPanels identity", () => {
  it("is identity for Classic, Plan delivery, and Budget-forward documents", () => {
    for (const doc of [
      buildClassicModularDocument(),
      buildPlanDeliveryDocument({ planEnabled: true }),
      buildBudgetForwardDocument(),
    ]) {
      expect(normalizeModularPanels(doc)).toEqual(doc);
    }
  });
});

describe("appendModularContinuationPage", () => {
  it("leaves shouldRenderModularPage2 false until a page-2 module is placed", () => {
    const classic = buildClassicModularDocument();
    expect(shouldRenderModularPage2(classic)).toBe(false);

    const withPage = appendModularContinuationPage(classic);
    expect(withPage.layout.pages).toHaveLength(2);
    expect(withPage.layout.pages[1].header).toBe("compact");
    expect(withPage.layout.pages[1].rows).toEqual([
      expect.objectContaining({
        shape: "full",
        height: "short",
        moduleIds: [null],
      }),
    ]);
    expect(shouldRenderModularPage2(withPage)).toBe(false);

    const filled = addModuleToSlot(withPage, 1, 0, 0, "ganttTimeline");
    expect(shouldRenderModularPage2(filled)).toBe(true);
  });

  it("does not add a third page", () => {
    const once = appendModularContinuationPage(buildClassicModularDocument());
    const twice = appendModularContinuationPage(once);
    expect(twice.layout.pages).toHaveLength(2);
    expect(twice).toEqual(once);
  });
});

describe("applyModularPreset", () => {
  it("preserves sprint, story, and donut payloads when the target still has those types", () => {
    const current = structuredClone(buildClassicModularDocument());
    const sprint = Object.values(current.modules).find((m) => m.type === "sprintSchedule");
    const story = Object.values(current.modules).find((m) => m.type === "storyPointMetrics");
    const donuts = Object.values(current.modules).filter((m) => m.type === "donutKpi");
    expect(sprint && story && donuts.length === 2).toBe(true);
    if (sprint?.type === "sprintSchedule") {
      sprint.data = { rows: [{ dateRange: "4/1 – 4/14", label: "Sprint A" }] };
    }
    if (story?.type === "storyPointMetrics") {
      story.data = {
        systems: [{ name: "OneSource" }],
        rows: [{ metric: "planned", values: [9] }],
      };
    }
    if (donuts[0]?.type === "donutKpi") {
      donuts[0].data = {
        source: "manual",
        manualValue: 41,
        label: "Utilization Rate",
        size: "large",
      };
    }

    const again = applyModularPreset(current, "classic", { planEnabled: false });
    const nextSprint = Object.values(again.modules).find((m) => m.type === "sprintSchedule");
    const nextStory = Object.values(again.modules).find((m) => m.type === "storyPointMetrics");
    const nextDonuts = Object.values(again.modules).filter((m) => m.type === "donutKpi");
    expect(nextSprint?.type === "sprintSchedule" && nextSprint.data).toEqual({
      rows: [{ dateRange: "4/1 – 4/14", label: "Sprint A" }],
    });
    expect(nextStory?.type === "storyPointMetrics" && nextStory.data).toEqual({
      systems: [{ name: "OneSource" }],
      rows: [{ metric: "planned", values: [9] }],
    });
    expect(nextDonuts[0]?.type === "donutKpi" && nextDonuts[0].data.manualValue).toBe(41);
  });
});

describe("row and slot edits", () => {
  it("appends a row to the selected page", () => {
    const doc = addModularRow(buildClassicModularDocument(), 0, "wideKpi", "tall");
    const last = doc.layout.pages[0].rows.at(-1);
    expect(last).toMatchObject({
      shape: "wideKpi",
      height: "tall",
      moduleIds: [null, null],
    });
  });

  it("moves and removes rows", () => {
    const withRow = addModularRow(buildClassicModularDocument(), 0, "full", "short");
    const moved = moveModularRow(withRow, 0, 3, "up");
    expect(moved.layout.pages[0].rows[2].shape).toBe("full");
    const removed = removeModularRow(moved, 0, 2);
    expect(removed.layout.pages[0].rows).toHaveLength(3);
  });

  it("allows duplicate donutKpi only", () => {
    const classic = buildClassicModularDocument();
    const extraRow = addModularRow(classic, 0, "full", "short");
    const blocked = addModuleToSlot(extraRow, 0, 3, 0, "sprintSchedule");
    expect(placedTypes(blocked).filter((t) => t === "sprintSchedule")).toHaveLength(1);
    expect(blocked.layout.pages[0].rows[3].moduleIds[0]).toBeNull();

    const withDonut = addModuleToSlot(extraRow, 0, 3, 0, "donutKpi");
    expect(placedTypes(withDonut).filter((t) => t === "donutKpi")).toHaveLength(3);

    const cleared = removeModuleFromSlot(withDonut, 0, 3, 0);
    expect(cleared.layout.pages[0].rows[3].moduleIds[0]).toBeNull();
  });
});
