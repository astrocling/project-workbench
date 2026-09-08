import type { PlanScale } from "@/lib/plan/scale";

/** Minimum column width so day/week headers like `12/31` are not clipped. */
export const GANTT_COL_WIDTH_DAY_WEEK = 40;
/** Minimum column width so month headers like `12/2026` are not clipped. */
export const GANTT_COL_WIDTH_MONTH = 64;

export function readableGanttColWidth(scale: PlanScale): number {
  if (scale === "month") return GANTT_COL_WIDTH_MONTH;
  return GANTT_COL_WIDTH_DAY_WEEK;
}

/** Fit zoom: fill the pane when there is room, never shrink below the readable min. */
export function fitGanttColWidth(
  paneWidth: number,
  columnCount: number,
  scale: PlanScale
): number {
  const min = readableGanttColWidth(scale);
  const n = Math.max(columnCount, 1);
  if (paneWidth <= 0) return min;
  return Math.max(min, paneWidth / n);
}

/** `YYYY-MM-DD` → `M/DD` for compact grid cells. */
export function formatCompactYmd(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return ymd;
  return `${month}/${String(day).padStart(2, "0")}`;
}
