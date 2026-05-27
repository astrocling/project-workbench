export type PanelCategory = "data-owned" | "feature-linked";

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

export type ReportPanel =
  | { type: "sprintSchedule"; order: number; data: SprintScheduleData }
  | { type: "storyPointMetrics"; order: number; data: StoryPointsMetricsData }
  | { type: "donutKpi"; order: number; data: DonutKpiData }
  | { type: "ganttTimeline"; order: number; data: Record<string, never> }
  | { type: "milestones"; order: number; data: Record<string, never> }
  | { type: "budgetFinancials"; order: number; data: Record<string, never> };

export type PanelType = ReportPanel["type"];

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
};

export const MODULAR_DEFAULT_PANELS: ReportPanel[] = [
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
