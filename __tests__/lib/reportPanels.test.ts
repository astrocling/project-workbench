import { describe, expect, it } from "vitest";
import {
  MODULAR_DEFAULT_DOCUMENT,
  MODULAR_SLIDE_HEIGHT_PX,
  MODULAR_SLIDE_WIDTH_PX,
  normalizeModularPanels,
  rowShapeWeights,
  rowSlotCount,
  shouldRenderModularPage2,
  type ModularPanelsDocument,
  type ReportPanel,
  type RowShape,
} from "@/lib/reportPanels";

const ROW_SHAPES: RowShape[] = ["full", "halves", "thirds", "wideKpi", "kpiWide"];

const legacyFourPanels: ReportPanel[] = [
  {
    type: "sprintSchedule",
    order: 0,
    data: {
      rows: [
        { dateRange: "4/28 – 5/15", label: "Development / Internal QA" },
        { dateRange: "5/16 – 5/22", label: "UAT" },
      ],
    },
  },
  {
    type: "storyPointMetrics",
    order: 1,
    data: {
      systems: [{ name: "OneSource" }, { name: "1CTX" }],
      rows: [
        { metric: "planned", values: [10, 4] },
        { metric: "completed", values: [8, 2] },
      ],
    },
  },
  {
    type: "donutKpi",
    order: 2,
    data: {
      source: "manual",
      manualValue: 72,
      label: "Utilization Rate",
      size: "large",
    },
  },
  {
    type: "donutKpi",
    order: 3,
    data: {
      source: "hoursUtilization",
      manualValue: 0,
      label: "Average Velocity",
      size: "small",
    },
  },
];

function expectClassicLayout(doc: ModularPanelsDocument) {
  expect(doc.version).toBe(1);
  expect(doc.layout.pages).toHaveLength(1);
  expect(doc.layout.pages[0].header).toBe("full");
  const rows = doc.layout.pages[0].rows;
  expect(rows).toHaveLength(3);

  expect(rows[0].shape).toBe("thirds");
  expect(rows[0].height).toBe("tall");
  expect(rows[0].moduleIds).toEqual([null, null, null]);
  expect(rows[0].moduleIds.length).toBe(rowSlotCount("thirds"));

  expect(rows[1].shape).toBe("halves");
  expect(rows[1].height).toBe("short");
  expect(rows[1].moduleIds.length).toBe(rowSlotCount("halves"));

  expect(rows[2].shape).toBe("halves");
  expect(rows[2].height).toBe("short");
  expect(rows[2].moduleIds.length).toBe(rowSlotCount("halves"));

  const [sprintId, storyId] = rows[1].moduleIds;
  const [donut1Id, donut2Id] = rows[2].moduleIds;
  expect(sprintId).toBeTruthy();
  expect(storyId).toBeTruthy();
  expect(donut1Id).toBeTruthy();
  expect(donut2Id).toBeTruthy();

  const sprint = doc.modules[sprintId as string];
  const story = doc.modules[storyId as string];
  const donut1 = doc.modules[donut1Id as string];
  const donut2 = doc.modules[donut2Id as string];

  expect(sprint?.type).toBe("sprintSchedule");
  expect(story?.type).toBe("storyPointMetrics");
  expect(donut1?.type).toBe("donutKpi");
  expect(donut2?.type).toBe("donutKpi");
}

describe("modular canvas constants", () => {
  it("locks the Modular slide to 1440×810", () => {
    expect(MODULAR_SLIDE_WIDTH_PX).toBe(1440);
    expect(MODULAR_SLIDE_HEIGHT_PX).toBe(810);
  });
});

describe("rowShapeWeights", () => {
  it("sums to 12 for every v1 shape and matches rowSlotCount", () => {
    for (const shape of ROW_SHAPES) {
      const weights = rowShapeWeights(shape);
      expect(weights.reduce((sum, w) => sum + w, 0)).toBe(12);
      expect(rowSlotCount(shape)).toBe(weights.length);
    }
  });

  it("uses the canonical cell counts and weight splits", () => {
    expect(rowShapeWeights("full")).toEqual([12]);
    expect(rowShapeWeights("halves")).toEqual([6, 6]);
    expect(rowShapeWeights("thirds")).toEqual([4, 4, 4]);
    expect(rowShapeWeights("wideKpi")).toEqual([8, 4]);
    expect(rowShapeWeights("kpiWide")).toEqual([4, 8]);
  });
});

describe("normalizeModularPanels", () => {
  it("returns Classic Modular default for undefined (empty thirds + sprint/metrics + two donuts)", () => {
    const doc = normalizeModularPanels(undefined);
    expect(doc).toEqual(MODULAR_DEFAULT_DOCUMENT);
    expectClassicLayout(doc);

    const [, , donut1Id, donut2Id] = [
      ...doc.layout.pages[0].rows[1].moduleIds,
      ...doc.layout.pages[0].rows[2].moduleIds,
    ];
    const donut1 = doc.modules[donut1Id as string];
    const donut2 = doc.modules[donut2Id as string];
    expect(donut1).toMatchObject({
      type: "donutKpi",
      data: { source: "manual", manualValue: 0, label: "Utilization Rate", size: "large" },
    });
    expect(donut2).toMatchObject({
      type: "donutKpi",
      data: { source: "manual", manualValue: 0, label: "Average Velocity", size: "large" },
    });
  });

  it("returns Classic Modular default for null", () => {
    expect(normalizeModularPanels(null)).toEqual(MODULAR_DEFAULT_DOCUMENT);
  });

  it("migrates four legacy panels into modules and Classic rows, preserving payload data", () => {
    const doc = normalizeModularPanels(legacyFourPanels);
    expectClassicLayout(doc);

    const [sprintId, storyId] = doc.layout.pages[0].rows[1].moduleIds;
    const [donut1Id, donut2Id] = doc.layout.pages[0].rows[2].moduleIds;

    expect(doc.modules[sprintId as string]?.data).toEqual(legacyFourPanels[0].data);
    expect(doc.modules[storyId as string]?.data).toEqual(legacyFourPanels[1].data);
    expect(doc.modules[donut1Id as string]?.data).toEqual(legacyFourPanels[2].data);
    expect(doc.modules[donut2Id as string]?.data).toEqual(legacyFourPanels[3].data);
    expect(Object.keys(doc.modules)).toHaveLength(4);
  });

  it("is identity for an already-v1 document (stable ids)", () => {
    const alreadyV1 = normalizeModularPanels(legacyFourPanels);
    const again = normalizeModularPanels(alreadyV1);
    expect(again).toEqual(alreadyV1);
    expect(Object.keys(again.modules)).toEqual(Object.keys(alreadyV1.modules));
    expect(again.layout.pages[0].rows.map((r) => r.id)).toEqual(
      alreadyV1.layout.pages[0].rows.map((r) => r.id)
    );
  });

  it("treats invalid garbage as Classic default and does not throw", () => {
    expect(() => normalizeModularPanels("nope")).not.toThrow();
    expect(normalizeModularPanels("nope")).toEqual(MODULAR_DEFAULT_DOCUMENT);
    expect(normalizeModularPanels(42)).toEqual(MODULAR_DEFAULT_DOCUMENT);
    expect(normalizeModularPanels({ foo: 1 })).toEqual(MODULAR_DEFAULT_DOCUMENT);
    expect(normalizeModularPanels([{ not: "a panel" }])).toEqual(MODULAR_DEFAULT_DOCUMENT);
  });
});

describe("shouldRenderModularPage2", () => {
  const page1 = MODULAR_DEFAULT_DOCUMENT.layout.pages[0];

  function docWithPage2(
    rows: ModularPanelsDocument["layout"]["pages"][number]["rows"]
  ): ModularPanelsDocument {
    return {
      ...MODULAR_DEFAULT_DOCUMENT,
      modules: {
        ...MODULAR_DEFAULT_DOCUMENT.modules,
        extra: {
          id: "extra",
          type: "narrativeCompleted",
          data: {},
        },
      },
      layout: {
        pages: [
          page1,
          { header: "compact", rows },
        ],
      },
    };
  }

  it("is false when there is only one page", () => {
    expect(shouldRenderModularPage2(MODULAR_DEFAULT_DOCUMENT)).toBe(false);
  });

  it("is false when page 2 has no rows", () => {
    expect(shouldRenderModularPage2(docWithPage2([]))).toBe(false);
  });

  it("is false when every page-2 moduleId is null", () => {
    expect(
      shouldRenderModularPage2(
        docWithPage2([
          {
            id: "p2r1",
            shape: "halves",
            height: "short",
            moduleIds: [null, null],
          },
        ])
      )
    ).toBe(false);
  });

  it("is true when page 2 has at least one non-null moduleId", () => {
    expect(
      shouldRenderModularPage2(
        docWithPage2([
          {
            id: "p2r1",
            shape: "full",
            height: "tall",
            moduleIds: ["extra"],
          },
        ])
      )
    ).toBe(true);
  });
});
