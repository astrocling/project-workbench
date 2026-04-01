/**
 * CDA tab projections: budget high hours vs prior actuals + planned current/future burn.
 */

export function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

export type CdaCalculationRow = {
  monthKey: string;
  planned: number;
  mtdActuals: number;
};

export type CdaProjections = {
  burnedPrior: number;
  plannedCurrent: number;
  plannedFuture: number;
  projectedTotalBurn: number;
  /** Positive = surplus hours expected at contract end; negative = projected deficit. */
  expectedSurplusEnd: number;
  remainingAfterPrior: number;
  poolForFutureMonths: number;
  futureMonthCount: number;
  /** Average hours per month for rows strictly after current month; null if none. */
  hoursPerFutureMonth: number | null;
};

/**
 * @param contractHoursHigh - Budget high hours (H), or sum of planned when no budget.
 * @param rows - CDA month rows (sorted by monthKey in UI; iteration order is fine).
 * @param currentMonthKey - Calendar YYYY-MM (e.g. from getCurrentMonthKey()).
 */
export function computeCdaProjections(input: {
  contractHoursHigh: number;
  rows: CdaCalculationRow[];
  currentMonthKey: string;
}): CdaProjections {
  const { contractHoursHigh: H, rows, currentMonthKey } = input;

  let burnedPrior = 0;
  let plannedCurrent = 0;
  let plannedFuture = 0;
  let futureMonthCount = 0;

  for (const r of rows) {
    if (r.monthKey < currentMonthKey) {
      burnedPrior += r.mtdActuals;
    } else if (r.monthKey === currentMonthKey) {
      plannedCurrent += r.planned;
    } else {
      plannedFuture += r.planned;
      futureMonthCount += 1;
    }
  }

  const projectedTotalBurn = burnedPrior + plannedCurrent + plannedFuture;
  const expectedSurplusEnd = roundToQuarter(H - projectedTotalBurn);

  const remainingAfterPrior = H - burnedPrior;
  const poolForFutureMonths = remainingAfterPrior - plannedCurrent;
  const hoursPerFutureMonth =
    futureMonthCount > 0
      ? roundToQuarter(poolForFutureMonths / futureMonthCount)
      : null;

  return {
    burnedPrior,
    plannedCurrent,
    plannedFuture,
    projectedTotalBurn,
    expectedSurplusEnd,
    remainingAfterPrior,
    poolForFutureMonths,
    futureMonthCount,
    hoursPerFutureMonth,
  };
}
