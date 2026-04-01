/**
 * CDA tab — forward-looking hours math (`CDATab` Budget sub-tab, right-hand card).
 *
 * **Inputs**
 * - `contractHoursHigh` (**H**): Budget tab **high** hours total (same as Overall “Planned” hours when
 *   budget lines exist). If the project has no budget hours, the UI falls back to sum of CDA planned
 *   months; that value is passed here as **H**.
 * - **Rows**: One per contract month (`monthKey` YYYY-MM), with `planned` and `mtdActuals` (from resourcing).
 * - **currentMonthKey**: Calendar current month (not project-relative).
 *
 * **1) Projected surplus at contract end** (`expectedSurplusEnd`)
 *
 * Compares **H** to an end-to-contract **projected total burn**:
 * - **Completed months** (`monthKey` &lt; current): use **MTD actuals** (treated as final for past months).
 * - **Current month**: use **planned** hours as expected burn (partial MTD is ignored so the projection
 *   is not distorted mid-month).
 * - **Future months** (`monthKey` &gt; current): sum of **planned** for each row.
 *
 *   burnedPrior = Σ mtdActuals (monthKey before current); plannedCurrent = current row planned (else 0);
 *   plannedFuture = Σ planned (monthKey after current); projectedTotalBurn = sum of those three;
 *   expectedSurplusEnd = roundToQuarter(H − projectedTotalBurn).
 *
 * Positive ⇒ hours left over at contract end if the plan holds; negative ⇒ projected deficit.
 *
 * **2) Avg hours per future month** (`hoursPerFutureMonth`)
 *
 * Hours still available after prior **actual** burn: `H − burnedPrior`. Reserve the current month’s
 * **planned** hours from that pool, then spread what remains across **strictly future** contract months
 * (rows with `monthKey` &gt; current). If there are no future months (e.g. last month of the contract),
 * this is `null` (shown as “—”).
 *
 *   remainingAfterPrior = H − burnedPrior; poolForFutureMonths = remainingAfterPrior − plannedCurrent;
 *   futureMonthCount = rows after current month; hoursPerFutureMonth = pool ÷ futureMonthCount (rounded), or null.
 *
 * **Not covered here**: The Overall table **Remaining** column (`H − Σ all MTD actuals`, including partial
 * current month) is a separate “as of today” figure; these metrics are projections.
 *
 * @see components/CDATab.tsx — wires `computeCdaProjections` and labels.
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
  /** Σ MTD actuals for months strictly before `currentMonthKey`. */
  burnedPrior: number;
  plannedCurrent: number;
  plannedFuture: number;
  projectedTotalBurn: number;
  /** `roundToQuarter(H - projectedTotalBurn)`. Positive = surplus at contract end; negative = deficit. */
  expectedSurplusEnd: number;
  /** `H - burnedPrior` — hours nominally left for current + future months before splitting. */
  remainingAfterPrior: number;
  /** `remainingAfterPrior - plannedCurrent` — hours allocated across future months only. */
  poolForFutureMonths: number;
  /** Number of CDA rows with `monthKey` > `currentMonthKey`. */
  futureMonthCount: number;
  /** Average per future month; `null` when `futureMonthCount === 0`. */
  hoursPerFutureMonth: number | null;
};

/**
 * Computes {@link CdaProjections} for the CDA Budget card. See module doc for formulas.
 *
 * @param contractHoursHigh - **H**: budget high hours, or UI fallback (sum of planned).
 * @param rows - CDA month rows (any order; split by comparing `monthKey` to `currentMonthKey`).
 * @param currentMonthKey - Calendar YYYY-MM (e.g. from `getCurrentMonthKey()` in `CDATab`).
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
