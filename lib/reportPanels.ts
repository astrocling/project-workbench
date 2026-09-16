export type PanelCategory = "data-owned" | "feature-linked";

/** Modular composer canvas (16:9). Standard/CDA/Milestones remain 720×405 in capture. */
export const MODULAR_SLIDE_WIDTH_PX = 1440;
export const MODULAR_SLIDE_HEIGHT_PX = 810;

export type SprintScheduleRow = {
  dateRange: string; // e.g. "4/28 – 5/15"
  label: string; // e.g. "Development / Internal QA"
};

export type StoryPointsSystem = {
  name: string; // free text, e.g. "OneSource", "1CTX"
};

export type StoryPointsRow = {
  metric: "planned" | "completed" | "inProgress" | "carryOver";
  values: number[]; // one per system, aligned to StoryPointsSystem[]
};

export type DonutKpiSize = "large" | "small";

export type DonutKpiSource =
  | "budgetBurnPct"
  | "hoursUtilization"
  | "manual";

export type DonutKpiData = {
  source: DonutKpiSource;
  manualValue?: number; // 0–100, required when source === 'manual'
  label: string;
  size: DonutKpiSize;
};

export type SprintScheduleData = {
  rows: SprintScheduleRow[];
};

export type StoryPointsMetricsData = {
  systems: StoryPointsSystem[]; // defines column headers; max 4
  rows: StoryPointsRow[];
};

export type EmptyModuleData = Record<string, never>;

/**
 * Fill-the-slot row shapes (v1). A row is 100% content width; each cell flex-grows
 * by its weight; the module box is 100% of its cell. Empty cells are still slots.
 */
export type RowShape = "full" | "halves" | "thirds" | "wideKpi" | "kpiWide";

export type RowHeight = "tall" | "short";

export type PageHeaderVariant = "full" | "compact";

export type ReportModule =
  | { id: string; type: "sprintSchedule"; data: SprintScheduleData }
  | { id: string; type: "storyPointMetrics"; data: StoryPointsMetricsData }
  | { id: string; type: "donutKpi"; data: DonutKpiData }
  | { id: string; type: "ganttTimeline"; data: EmptyModuleData }
  | { id: string; type: "milestones"; data: EmptyModuleData }
  | { id: string; type: "budgetFinancials"; data: EmptyModuleData }
  | { id: string; type: "narrativeCompleted"; data: EmptyModuleData }
  | { id: string; type: "narrativeUpcoming"; data: EmptyModuleData }
  | { id: string; type: "narrativeRisks"; data: EmptyModuleData }
  | { id: string; type: "planMeetings"; data: EmptyModuleData }
  | { id: string; type: "planActivitiesCompleted"; data: EmptyModuleData }
  | { id: string; type: "planActivitiesUpcoming"; data: EmptyModuleData }
  | { id: string; type: "budgetCompactDollars"; data: EmptyModuleData }
  | { id: string; type: "budgetCompactHours"; data: EmptyModuleData }
  | { id: string; type: "budgetBurnOnly"; data: EmptyModuleData };

export type ModuleType = ReportModule["type"];

/** Legacy array payload stored before the layout document. `order` is layout slot order now. */
export type ReportPanel =
  | { type: "sprintSchedule"; order: number; data: SprintScheduleData }
  | { type: "storyPointMetrics"; order: number; data: StoryPointsMetricsData }
  | { type: "donutKpi"; order: number; data: DonutKpiData }
  | { type: "ganttTimeline"; order: number; data: EmptyModuleData }
  | { type: "milestones"; order: number; data: EmptyModuleData }
  | { type: "budgetFinancials"; order: number; data: EmptyModuleData };

export type PanelType = ModuleType;

export type ModularLayoutRow = {
  id: string;
  shape: RowShape;
  height: RowHeight;
  /** length === shape cell count; null = empty slot */
  moduleIds: Array<string | null>;
};

export type ModularLayoutPage = {
  header: PageHeaderVariant;
  rows: ModularLayoutRow[];
};

export type ModularPanelsDocument = {
  version: 1;
  layout: {
    pages: ModularLayoutPage[];
  };
  modules: Record<string, ReportModule>;
};

export const PANEL_META: Record<
  PanelType,
  { label: string; category: PanelCategory }
> = {
  sprintSchedule: { label: "Sprint Schedule", category: "data-owned" },
  storyPointMetrics: { label: "Story Point Metrics", category: "data-owned" },
  donutKpi: { label: "Donut KPI", category: "data-owned" },
  ganttTimeline: { label: "Timeline", category: "feature-linked" },
  milestones: { label: "Milestones", category: "feature-linked" },
  budgetFinancials: { label: "Budget & Financials", category: "feature-linked" },
  narrativeCompleted: {
    label: "Completed Activities (typed)",
    category: "data-owned",
  },
  narrativeUpcoming: {
    label: "Upcoming Activities (typed)",
    category: "data-owned",
  },
  narrativeRisks: {
    label: "Risks / Issues / Decisions",
    category: "data-owned",
  },
  planMeetings: { label: "Upcoming Meetings", category: "feature-linked" },
  planActivitiesCompleted: {
    label: "Completed Activities (from Plan)",
    category: "feature-linked",
  },
  planActivitiesUpcoming: {
    label: "Upcoming Activities (from Plan)",
    category: "feature-linked",
  },
  budgetCompactDollars: {
    label: "Budget (compact dollars)",
    category: "feature-linked",
  },
  budgetCompactHours: {
    label: "Budget (compact hours)",
    category: "feature-linked",
  },
  budgetBurnOnly: { label: "Budget burn only", category: "feature-linked" },
};

const ROW_SHAPE_WEIGHTS: Record<RowShape, number[]> = {
  full: [12],
  halves: [6, 6],
  thirds: [4, 4, 4],
  wideKpi: [8, 4],
  kpiWide: [4, 8],
};

export function rowShapeWeights(shape: RowShape): number[] {
  return [...ROW_SHAPE_WEIGHTS[shape]];
}

export function rowSlotCount(shape: RowShape): number {
  return ROW_SHAPE_WEIGHTS[shape].length;
}

const MODULE_TYPES = new Set<string>(Object.keys(PANEL_META));
const ROW_SHAPES = new Set<string>(Object.keys(ROW_SHAPE_WEIGHTS));

const LEGACY_MIGRATE_TYPES = new Set([
  "sprintSchedule",
  "storyPointMetrics",
  "donutKpi",
]);

export const MODULAR_LEGACY_DEFAULT_PANELS: ReportPanel[] = [
  { type: "sprintSchedule", order: 0, data: { rows: [] } },
  { type: "storyPointMetrics", order: 1, data: { systems: [], rows: [] } },
  {
    type: "donutKpi",
    order: 2,
    data: {
      source: "manual",
      manualValue: 0,
      label: "Utilization Rate",
      size: "large",
    },
  },
  {
    type: "donutKpi",
    order: 3,
    data: {
      source: "manual",
      manualValue: 0,
      label: "Average Velocity",
      size: "large",
    },
  },
];

function classicModularDocumentFromModules(
  sprint: ReportModule,
  story: ReportModule,
  donut1: ReportModule,
  donut2: ReportModule
): ModularPanelsDocument {
  const completed: ReportModule = {
    id: "n1",
    type: "narrativeCompleted",
    data: {},
  };
  const upcoming: ReportModule = {
    id: "n2",
    type: "narrativeUpcoming",
    data: {},
  };
  const risks: ReportModule = {
    id: "n3",
    type: "narrativeRisks",
    data: {},
  };
  return {
    version: 1,
    layout: {
      pages: [
        {
          header: "full",
          rows: [
            {
              id: "r1",
              shape: "thirds",
              height: "tall",
              moduleIds: [completed.id, upcoming.id, risks.id],
            },
            {
              id: "r2",
              shape: "halves",
              height: "short",
              moduleIds: [sprint.id, story.id],
            },
            {
              id: "r3",
              shape: "halves",
              height: "short",
              moduleIds: [donut1.id, donut2.id],
            },
          ],
        },
      ],
    },
    modules: {
      [completed.id]: completed,
      [upcoming.id]: upcoming,
      [risks.id]: risks,
      [sprint.id]: sprint,
      [story.id]: story,
      [donut1.id]: donut1,
      [donut2.id]: donut2,
    },
  };
}

function buildClassicModularDefault(): ModularPanelsDocument {
  return classicModularDocumentFromModules(
    { id: "m1", type: "sprintSchedule", data: { rows: [] } },
    { id: "m2", type: "storyPointMetrics", data: { systems: [], rows: [] } },
    {
      id: "m3",
      type: "donutKpi",
      data: {
        source: "manual",
        manualValue: 0,
        label: "Utilization Rate",
        size: "large",
      },
    },
    {
      id: "m4",
      type: "donutKpi",
      data: {
        source: "manual",
        manualValue: 0,
        label: "Average Velocity",
        size: "large",
      },
    }
  );
}

export const MODULAR_DEFAULT_DOCUMENT: ModularPanelsDocument =
  buildClassicModularDefault();

/** @deprecated Use MODULAR_DEFAULT_DOCUMENT */
export const MODULAR_DEFAULT_PANELS: ModularPanelsDocument =
  MODULAR_DEFAULT_DOCUMENT;

function isRowShape(value: unknown): value is RowShape {
  return typeof value === "string" && ROW_SHAPES.has(value);
}

function isReportModule(value: unknown): value is ReportModule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.id === "string" && typeof rec.type === "string" && MODULE_TYPES.has(rec.type);
}

function coerceModuleData(mod: ReportModule): ReportModule {
  const raw =
    mod.data && typeof mod.data === "object" && !Array.isArray(mod.data)
      ? (mod.data as Record<string, unknown>)
      : {};
  switch (mod.type) {
    case "sprintSchedule":
      return {
        ...mod,
        data: { rows: Array.isArray(raw.rows) ? (raw.rows as SprintScheduleData["rows"]) : [] },
      };
    case "storyPointMetrics":
      return {
        ...mod,
        data: {
          systems: Array.isArray(raw.systems)
            ? (raw.systems as StoryPointsMetricsData["systems"])
            : [],
          rows: Array.isArray(raw.rows) ? (raw.rows as StoryPointsMetricsData["rows"]) : [],
        },
      };
    case "donutKpi": {
      const source =
        raw.source === "budgetBurnPct" ||
        raw.source === "hoursUtilization" ||
        raw.source === "manual"
          ? raw.source
          : "manual";
      return {
        ...mod,
        data: {
          source,
          manualValue: typeof raw.manualValue === "number" ? raw.manualValue : 0,
          label: typeof raw.label === "string" ? raw.label : "",
          size: raw.size === "small" ? "small" : "large",
        },
      };
    }
    default:
      return { ...mod, data: {} };
  }
}

function parseV1Document(input: unknown): ModularPanelsDocument | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const rec = input as Record<string, unknown>;
  if (rec.version !== 1) return null;
  const layout = rec.layout;
  const modulesRaw = rec.modules;
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) return null;
  if (!modulesRaw || typeof modulesRaw !== "object" || Array.isArray(modulesRaw)) {
    return null;
  }

  const pagesRaw = (layout as { pages?: unknown }).pages;
  if (!Array.isArray(pagesRaw) || pagesRaw.length < 1) {
    return null;
  }
  const pagesLimited = pagesRaw.slice(0, 2);

  const modules: Record<string, ReportModule> = {};
  for (const [key, value] of Object.entries(modulesRaw as Record<string, unknown>)) {
    if (!isReportModule(value) || value.id !== key) return null;
    modules[key] = coerceModuleData(value);
  }

  const pages: ModularLayoutPage[] = [];
  for (let i = 0; i < pagesLimited.length; i++) {
    const page = pagesLimited[i];
    if (!page || typeof page !== "object" || Array.isArray(page)) return null;
    const header = (page as { header?: unknown }).header;
    const rowsRaw = (page as { rows?: unknown }).rows;
    if (header !== "full" && header !== "compact") return null;
    if (i === 0 && header !== "full") return null;
    if (!Array.isArray(rowsRaw)) return null;

    const rows: ModularLayoutRow[] = [];
    for (const row of rowsRaw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const id = (row as { id?: unknown }).id;
      const shape = (row as { shape?: unknown }).shape;
      const height = (row as { height?: unknown }).height;
      const moduleIds = (row as { moduleIds?: unknown }).moduleIds;
      if (typeof id !== "string" || !isRowShape(shape)) return null;
      if (height !== "tall" && height !== "short") return null;
      if (!Array.isArray(moduleIds) || moduleIds.length !== rowSlotCount(shape)) {
        return null;
      }
      const ids: Array<string | null> = [];
      for (const slot of moduleIds) {
        if (slot === null) {
          ids.push(null);
          continue;
        }
        if (typeof slot !== "string" || !(slot in modules)) return null;
        ids.push(slot);
      }
      rows.push({ id, shape, height, moduleIds: ids });
    }
    pages.push({ header, rows });
  }

  return { version: 1, layout: { pages }, modules };
}

function asLegacyPanel(value: unknown): ReportPanel | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.type !== "string" || !LEGACY_MIGRATE_TYPES.has(rec.type)) {
    return null;
  }
  if (!("data" in rec) || rec.data === undefined) return null;
  return rec as ReportPanel;
}

function migrateLegacyArray(input: unknown[]): ModularPanelsDocument {
  const recognized: ReportPanel[] = [];
  for (const item of input) {
    const panel = asLegacyPanel(item);
    if (panel) recognized.push(panel);
  }
  if (recognized.length === 0) return MODULAR_DEFAULT_DOCUMENT;

  let n = 1;
  const nextId = () => `m${n++}`;

  const sprintPanel = recognized.find((p) => p.type === "sprintSchedule");
  const storyPanel = recognized.find((p) => p.type === "storyPointMetrics");
  const donuts = recognized.filter((p) => p.type === "donutKpi");

  const sprint: ReportModule = {
    id: nextId(),
    type: "sprintSchedule",
    data: sprintPanel?.type === "sprintSchedule" ? sprintPanel.data : { rows: [] },
  };
  const story: ReportModule = {
    id: nextId(),
    type: "storyPointMetrics",
    data:
      storyPanel?.type === "storyPointMetrics"
        ? storyPanel.data
        : { systems: [], rows: [] },
  };

  const defaultDonut = (label: string): ReportModule => ({
    id: nextId(),
    type: "donutKpi",
    data: { source: "manual", manualValue: 0, label, size: "large" },
  });

  const donut1: ReportModule =
    donuts[0] != null
      ? { id: nextId(), type: "donutKpi", data: donuts[0].data }
      : defaultDonut("Utilization Rate");
  const donut2: ReportModule =
    donuts[1] != null
      ? { id: nextId(), type: "donutKpi", data: donuts[1].data }
      : defaultDonut("Average Velocity");

  return classicModularDocumentFromModules(sprint, story, donut1, donut2);
}

/**
 * Migrate-on-read for StatusReport.panels JSON.
 * null/undefined → Classic Modular default. Legacy `{ type, order, data }[]` → v1 document.
 * Invalid input → Classic default (never throws).
 */
export function normalizeModularPanels(input: unknown): ModularPanelsDocument {
  if (input == null) return MODULAR_DEFAULT_DOCUMENT;
  const v1 = parseV1Document(input);
  if (v1) return v1;
  if (Array.isArray(input)) return migrateLegacyArray(input);
  return MODULAR_DEFAULT_DOCUMENT;
}

/** True when layout.pages[1] exists and has at least one non-null moduleId. Caps at two module pages. */
export function shouldRenderModularPage2(doc: ModularPanelsDocument): boolean {
  const page = doc.layout.pages[1];
  if (!page) return false;
  return page.rows.some((row) => row.moduleIds.some((id) => id != null));
}

export const BUDGET_MODULE_TYPES: ModuleType[] = [
  "budgetFinancials",
  "budgetCompactDollars",
  "budgetCompactHours",
  "budgetBurnOnly",
];

export function modularDocumentHasType(
  doc: ModularPanelsDocument,
  types: ModuleType[]
): boolean {
  const wanted = new Set(types);
  for (const page of doc.layout.pages) {
    for (const row of page.rows) {
      for (const id of row.moduleIds) {
        if (id == null) continue;
        const mod = doc.modules[id];
        if (mod && wanted.has(mod.type)) return true;
      }
    }
  }
  return false;
}

export function modularNeedsBudget(doc: ModularPanelsDocument): boolean {
  return modularDocumentHasType(doc, BUDGET_MODULE_TYPES);
}

export function modularNeedsTimeline(doc: ModularPanelsDocument): boolean {
  return modularDocumentHasType(doc, ["ganttTimeline"]);
}

export const PLAN_LIST_MODULE_TYPES: ModuleType[] = [
  "planMeetings",
  "planActivitiesCompleted",
  "planActivitiesUpcoming",
];

export function modularNeedsPlanLists(doc: ModularPanelsDocument): boolean {
  return modularDocumentHasType(doc, PLAN_LIST_MODULE_TYPES);
}

const LEGACY_FORM_TYPES = new Set([
  "sprintSchedule",
  "storyPointMetrics",
  "donutKpi",
]);

/** Flatten layout slot order to the legacy array the Modular form still edits. */
export function modularDocumentToLegacyPanels(
  doc: ModularPanelsDocument
): ReportPanel[] {
  const seen = new Set<string>();
  const out: ReportPanel[] = [];
  let order = 0;
  const push = (mod: ReportModule) => {
    if (seen.has(mod.id) || !LEGACY_FORM_TYPES.has(mod.type)) return;
    seen.add(mod.id);
    if (mod.type === "sprintSchedule") {
      out.push({ type: "sprintSchedule", order: order++, data: mod.data });
    } else if (mod.type === "storyPointMetrics") {
      out.push({ type: "storyPointMetrics", order: order++, data: mod.data });
    } else if (mod.type === "donutKpi") {
      out.push({ type: "donutKpi", order: order++, data: mod.data });
    }
  };
  for (const page of doc.layout.pages) {
    for (const row of page.rows) {
      for (const id of row.moduleIds) {
        if (id && doc.modules[id]) push(doc.modules[id]);
      }
    }
  }
  for (const mod of Object.values(doc.modules)) push(mod);
  return out.length > 0 ? out : MODULAR_LEGACY_DEFAULT_PANELS;
}

export function panelsInputToLegacyFormPanels(input: unknown): ReportPanel[] {
  if (Array.isArray(input)) {
    const panels = input.map(asLegacyPanel).filter((p): p is ReportPanel => p != null);
    return panels.length > 0 ? panels : MODULAR_LEGACY_DEFAULT_PANELS;
  }
  return modularDocumentToLegacyPanels(normalizeModularPanels(input));
}

/** Current Modular slide/PDF still read an array; Task 2 switches to the layout grid. */
export function reportPanelsForLegacyRender(
  panels: ReportPanel[] | ModularPanelsDocument | undefined
): ReportPanel[] {
  if (panels == null) return [];
  if (Array.isArray(panels)) return panels;
  return modularDocumentToLegacyPanels(panels);
}
