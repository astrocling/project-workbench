/** Presentation helpers for Modular budget modules. Uses snapshot.budget only — no second rollup. */

export type StatusReportBudgetView = {
  actualHours: number;
  budgetedHoursHigh: number;
  burnPercentHigh: number | null;
};

/** Hours donut: actualHours / budgetedHoursHigh, clamped 0–100. Null when HIGH hours are 0. */
export function budgetHoursBurnPercent(
  budget: Pick<StatusReportBudgetView, "actualHours" | "budgetedHoursHigh">
): number | null {
  if (budget.budgetedHoursHigh <= 0) return null;
  return Math.min(100, Math.max(0, (budget.actualHours / budget.budgetedHoursHigh) * 100));
}

/** Dollar donut: existing burnPercentHigh from the snapshot. */
export function budgetDollarsBurnPercent(
  budget: Pick<StatusReportBudgetView, "burnPercentHigh">
): number | null {
  return budget.burnPercentHigh;
}
