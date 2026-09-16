import {
  MODULAR_DEFAULT_DOCUMENT,
  PANEL_META,
  PLAN_LIST_MODULE_TYPES,
  rowSlotCount,
  type ModularLayoutRow,
  type ModularPanelsDocument,
  type ModuleType,
  type ReportModule,
  type RowHeight,
  type RowShape,
} from "@/lib/reportPanels";

export type ModularPresetId = "classic" | "planDelivery" | "budgetForward";

const UNIQUE_EXCEPT = new Set<ModuleType>(["donutKpi"]);

function cloneDoc(doc: ModularPanelsDocument): ModularPanelsDocument {
  return structuredClone(doc);
}

function emptyDataForType(type: ModuleType): ReportModule["data"] {
  if (type === "sprintSchedule") return { rows: [] };
  if (type === "storyPointMetrics") return { systems: [], rows: [] };
  if (type === "donutKpi") {
    return { source: "manual", manualValue: 0, label: "KPI", size: "large" };
  }
  return {};
}

function makeModule(id: string, type: ModuleType): ReportModule {
  return { id, type, data: emptyDataForType(type) } as ReportModule;
}

function nextId(used: Set<string>, prefix: string): string {
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  const id = `${prefix}${n}`;
  used.add(id);
  return id;
}

function usedIds(doc: ModularPanelsDocument): Set<string> {
  const used = new Set<string>(Object.keys(doc.modules));
  for (const page of doc.layout.pages) {
    for (const row of page.rows) used.add(row.id);
  }
  return used;
}

export function modulesInLayoutOrder(doc: ModularPanelsDocument): ReportModule[] {
  const out: ReportModule[] = [];
  const seen = new Set<string>();
  for (const page of doc.layout.pages) {
    for (const row of page.rows) {
      for (const id of row.moduleIds) {
        if (!id || seen.has(id) || !doc.modules[id]) continue;
        seen.add(id);
        out.push(doc.modules[id]);
      }
    }
  }
  return out;
}

function placedTypesSet(doc: ModularPanelsDocument): Set<ModuleType> {
  return new Set(modulesInLayoutOrder(doc).map((m) => m.type));
}

export function moduleTypeAlreadyPlaced(
  doc: ModularPanelsDocument,
  type: ModuleType
): boolean {
  return placedTypesSet(doc).has(type);
}

export function canPlaceModuleType(
  doc: ModularPanelsDocument,
  type: ModuleType
): boolean {
  if (UNIQUE_EXCEPT.has(type)) return true;
  return !moduleTypeAlreadyPlaced(doc, type);
}

export function isPlanGatedModuleType(type: ModuleType): boolean {
  return PLAN_LIST_MODULE_TYPES.includes(type);
}

export function buildClassicModularDocument(): ModularPanelsDocument {
  return cloneDoc(MODULAR_DEFAULT_DOCUMENT);
}

export function buildPlanDeliveryDocument(options: {
  planEnabled: boolean;
}): ModularPanelsDocument {
  const used = new Set<string>();
  const completed = makeModule(nextId(used, "m"), "planActivitiesCompleted");
  const upcoming = makeModule(nextId(used, "m"), "planActivitiesUpcoming");
  const risks = makeModule(nextId(used, "m"), "narrativeRisks");
  const meetings = makeModule(nextId(used, "m"), "planMeetings");
  const modules: Record<string, ReportModule> = {
    [completed.id]: completed,
    [upcoming.id]: upcoming,
    [risks.id]: risks,
    [meetings.id]: meetings,
  };
  const rows: ModularLayoutRow[] = [
    {
      id: nextId(used, "r"),
      shape: "thirds",
      height: "tall",
      moduleIds: [completed.id, upcoming.id, risks.id],
    },
  ];
  if (options.planEnabled) {
    const budget = makeModule(nextId(used, "m"), "budgetCompactDollars");
    modules[budget.id] = budget;
    rows.push({
      id: nextId(used, "r"),
      shape: "halves",
      height: "short",
      moduleIds: [meetings.id, budget.id],
    });
  } else {
    rows.push({
      id: nextId(used, "r"),
      shape: "full",
      height: "short",
      moduleIds: [meetings.id],
    });
  }
  return {
    version: 1,
    layout: { pages: [{ header: "full", rows }] },
    modules,
  };
}

export function buildBudgetForwardDocument(): ModularPanelsDocument {
  const used = new Set<string>();
  const completed = makeModule(nextId(used, "m"), "narrativeCompleted");
  const upcoming = makeModule(nextId(used, "m"), "narrativeUpcoming");
  const risks = makeModule(nextId(used, "m"), "narrativeRisks");
  const budget = makeModule(nextId(used, "m"), "budgetFinancials");
  return {
    version: 1,
    layout: {
      pages: [
        {
          header: "full",
          rows: [
            {
              id: nextId(used, "r"),
              shape: "thirds",
              height: "tall",
              moduleIds: [completed.id, upcoming.id, risks.id],
            },
            {
              id: nextId(used, "r"),
              shape: "full",
              height: "tall",
              moduleIds: [budget.id],
            },
          ],
        },
      ],
    },
    modules: {
      [completed.id]: completed,
      [upcoming.id]: upcoming,
      [risks.id]: risks,
      [budget.id]: budget,
    },
  };
}

function preserveSprintStoryDonut(
  from: ModularPanelsDocument,
  to: ModularPanelsDocument
): ModularPanelsDocument {
  const next = cloneDoc(to);
  const fromByType = (type: ModuleType) =>
    modulesInLayoutOrder(from).filter((m) => m.type === type);
  for (const type of ["sprintSchedule", "storyPointMetrics"] as const) {
    const prev = fromByType(type)[0];
    const dest = modulesInLayoutOrder(next).find((m) => m.type === type);
    if (prev && dest) {
      next.modules[dest.id] = {
        ...dest,
        data: structuredClone(prev.data),
      } as ReportModule;
    }
  }
  const fromDonuts = fromByType("donutKpi");
  const toDonuts = modulesInLayoutOrder(next).filter((m) => m.type === "donutKpi");
  toDonuts.forEach((dest, i) => {
    const prev = fromDonuts[i];
    if (prev?.type === "donutKpi") {
      next.modules[dest.id] = { ...dest, data: structuredClone(prev.data) };
    }
  });
  return next;
}

export function applyModularPreset(
  current: ModularPanelsDocument,
  preset: ModularPresetId,
  options: { planEnabled: boolean }
): ModularPanelsDocument {
  const built =
    preset === "classic"
      ? buildClassicModularDocument()
      : preset === "planDelivery"
        ? buildPlanDeliveryDocument(options)
        : buildBudgetForwardDocument();
  return preserveSprintStoryDonut(current, built);
}

export function appendModularContinuationPage(
  doc: ModularPanelsDocument
): ModularPanelsDocument {
  if (doc.layout.pages.length >= 2) return doc;
  const next = cloneDoc(doc);
  const used = usedIds(next);
  next.layout.pages.push({
    header: "compact",
    rows: [
      {
        id: nextId(used, "r"),
        shape: "full",
        height: "short",
        moduleIds: [null],
      },
    ],
  });
  return next;
}

export function addModularRow(
  doc: ModularPanelsDocument,
  pageIndex: number,
  shape: RowShape,
  height: RowHeight
): ModularPanelsDocument {
  const page = doc.layout.pages[pageIndex];
  if (!page) return doc;
  const next = cloneDoc(doc);
  const used = usedIds(next);
  next.layout.pages[pageIndex].rows.push({
    id: nextId(used, "r"),
    shape,
    height,
    moduleIds: Array.from({ length: rowSlotCount(shape) }, () => null),
  });
  return next;
}

export function removeModularRow(
  doc: ModularPanelsDocument,
  pageIndex: number,
  rowIndex: number
): ModularPanelsDocument {
  const page = doc.layout.pages[pageIndex];
  if (!page || rowIndex < 0 || rowIndex >= page.rows.length) return doc;
  const next = cloneDoc(doc);
  const [removed] = next.layout.pages[pageIndex].rows.splice(rowIndex, 1);
  pruneUnreferencedModules(next, removed?.moduleIds ?? []);
  return next;
}

export function moveModularRow(
  doc: ModularPanelsDocument,
  pageIndex: number,
  rowIndex: number,
  direction: "up" | "down"
): ModularPanelsDocument {
  const page = doc.layout.pages[pageIndex];
  if (!page) return doc;
  const swapWith = direction === "up" ? rowIndex - 1 : rowIndex + 1;
  if (swapWith < 0 || swapWith >= page.rows.length) return doc;
  const next = cloneDoc(doc);
  const rows = next.layout.pages[pageIndex].rows;
  const tmp = rows[rowIndex];
  rows[rowIndex] = rows[swapWith];
  rows[swapWith] = tmp;
  return next;
}

function pruneUnreferencedModules(
  doc: ModularPanelsDocument,
  candidateIds: Array<string | null>
): void {
  const placed = new Set<string>();
  for (const page of doc.layout.pages) {
    for (const row of page.rows) {
      for (const id of row.moduleIds) {
        if (id) placed.add(id);
      }
    }
  }
  for (const id of candidateIds) {
    if (id && !placed.has(id)) delete doc.modules[id];
  }
}

export function addModuleToSlot(
  doc: ModularPanelsDocument,
  pageIndex: number,
  rowIndex: number,
  slotIndex: number,
  type: ModuleType
): ModularPanelsDocument {
  const row = doc.layout.pages[pageIndex]?.rows[rowIndex];
  if (!row || slotIndex < 0 || slotIndex >= row.moduleIds.length) return doc;
  if (row.moduleIds[slotIndex] != null) return doc;
  if (!canPlaceModuleType(doc, type)) return doc;
  const next = cloneDoc(doc);
  const used = usedIds(next);
  const module = makeModule(nextId(used, "m"), type);
  next.modules[module.id] = module;
  next.layout.pages[pageIndex].rows[rowIndex].moduleIds[slotIndex] = module.id;
  return next;
}

export function removeModuleFromSlot(
  doc: ModularPanelsDocument,
  pageIndex: number,
  rowIndex: number,
  slotIndex: number
): ModularPanelsDocument {
  const row = doc.layout.pages[pageIndex]?.rows[rowIndex];
  if (!row || slotIndex < 0 || slotIndex >= row.moduleIds.length) return doc;
  const next = cloneDoc(doc);
  const id = next.layout.pages[pageIndex].rows[rowIndex].moduleIds[slotIndex];
  next.layout.pages[pageIndex].rows[rowIndex].moduleIds[slotIndex] = null;
  pruneUnreferencedModules(next, [id]);
  return next;
}

export function updateModulesByType<T extends ModuleType>(
  doc: ModularPanelsDocument,
  type: T,
  updater: (mod: Extract<ReportModule, { type: T }>) => Extract<ReportModule, { type: T }>
): ModularPanelsDocument {
  const next = cloneDoc(doc);
  for (const id of Object.keys(next.modules)) {
    const mod = next.modules[id];
    if (mod.type === type) {
      next.modules[id] = updater(mod as Extract<ReportModule, { type: T }>);
    }
  }
  return next;
}

export function updateModuleById(
  doc: ModularPanelsDocument,
  moduleId: string,
  updater: (mod: ReportModule) => ReportModule
): ModularPanelsDocument {
  if (!doc.modules[moduleId]) return doc;
  const next = cloneDoc(doc);
  const updated = updater(next.modules[moduleId]);
  next.modules[moduleId] = { ...updated, id: moduleId };
  return next;
}

export const ADDABLE_MODULE_TYPES = Object.keys(PANEL_META) as ModuleType[];

export const ROW_SHAPE_OPTIONS: { value: RowShape; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "halves", label: "Halves" },
  { value: "thirds", label: "Thirds" },
  { value: "wideKpi", label: "Wide + KPI" },
  { value: "kpiWide", label: "KPI + Wide" },
];
