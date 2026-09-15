export type PlanGridMode = "view" | "edit" | "chart";

export const PLAN_EXPAND_COL = 28;
export const PLAN_VIEW_GRID_WIDTH = 400;
export const PLAN_COMPACT_DATE_COL = 88;
/** Present view pane: prior 288px name+status plus compact dates. */
export const PLAN_PRESENT_GRID_WIDTH = 288 + PLAN_COMPACT_DATE_COL;
export const PLAN_ACTIONS_COL = 52;
export const PLAN_FULL_GRID_INNER_WIDTH = 906 + PLAN_ACTIONS_COL;

export function effectivePlanGridMode(
  gridMode: PlanGridMode,
  presenting: boolean
): PlanGridMode {
  if (presenting && gridMode === "edit") return "view";
  return gridMode;
}

export function leftPaneWidth({
  gridMode,
  presenting,
  collapsed,
}: {
  gridMode: PlanGridMode;
  presenting: boolean;
  collapsed: boolean;
}): number {
  const mode = effectivePlanGridMode(gridMode, presenting);
  if (mode === "chart" || (presenting && collapsed)) return PLAN_EXPAND_COL;
  if (mode === "edit") return PLAN_FULL_GRID_INNER_WIDTH;
  if (presenting) return PLAN_PRESENT_GRID_WIDTH;
  return PLAN_VIEW_GRID_WIDTH;
}

export function showGanttLabels({
  gridMode,
  presenting,
}: {
  gridMode: PlanGridMode;
  presenting: boolean;
}): boolean {
  const mode = effectivePlanGridMode(gridMode, presenting);
  return presenting || mode === "chart";
}

export function showLeftPaneCollapseControl({
  gridMode,
  presenting,
}: {
  gridMode: PlanGridMode;
  presenting: boolean;
}): boolean {
  return presenting && effectivePlanGridMode(gridMode, presenting) === "view";
}

export function leftPaneIsRail(width: number): boolean {
  return width === PLAN_EXPAND_COL;
}
