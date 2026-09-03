export type StatusReportVariationLike = string;

/** Resolves whether Standard report budget block is visible (default true). */
export function resolveShowBudget(
  snapshot: { showBudget?: boolean } | null
): boolean {
  if (snapshot != null && typeof snapshot.showBudget === "boolean") {
    return snapshot.showBudget;
  }
  return true;
}

/**
 * Whether PDF/view data should include the budget block.
 * CDA needs budgetedHoursHigh for Overall Hours Planned (not the CDA monthly plan sum).
 */
export function shouldAttachBudgetToPdfData(
  variation: StatusReportVariationLike
): boolean {
  return (
    variation === "Standard" ||
    variation === "Milestones" ||
    variation === "CDA"
  );
}

/**
 * Edit-form **Refresh budget** is offered for every variation that locks budget
 * into the snapshot. The API refreshes Standard, Milestones, and CDA
 * (`snapshot.budget`; on CDA also monthly hours / totalMtdActuals / overallBudget).
 * Modular has no budget snapshot.
 */
export function shouldShowRefreshBudget(
  variation: StatusReportVariationLike
): boolean {
  return shouldAttachBudgetToPdfData(variation);
}
