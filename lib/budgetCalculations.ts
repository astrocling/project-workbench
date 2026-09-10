/**
 * Budget calculations for Project Workbench.
 * Uses ONLY plan + actuals. Float excluded.
 * Completed weeks: weekStartDate <= asOfDate. Never include current week in to-date.
 */

import { isPastLastUtcDayOfMonthInWeek } from "./monthUtils";
import {
  formatWeekShort,
  getAllWeeks,
  getAsOfDate,
  getCompletedWeeks,
  getFutureWeeks,
  getWeekStartDate,
  isCompletedWeek,
  isCurrentWeek,
} from "./weekUtils";

export type WeeklyHoursRow = {
  weekStartDate: Date;
  plannedHours: number;
  actualHours: number | null;
  rate: number;
};

export type BudgetLineInput = {
  lowHours: number;
  highHours: number;
  lowDollars: number;
  highDollars: number;
};

export type BudgetResult = {
  plannedHoursToDate: number;
  actualHoursToDate: number;
  actualDollarsToDate: number;
  missingActuals: boolean;
  forecastHours: number;
  forecastDollars: number;
  forecastIncomplete: boolean;
  projectedCurrentWeekHours: number;
  projectedCurrentWeekDollars: number;
  projectedFutureWeeksHours: number;
  projectedFutureWeeksDollars: number;
  burnPercentLowHours: number | null;
  burnPercentHighHours: number | null;
  burnPercentLowDollars: number | null;
  burnPercentHighDollars: number | null;
  remainingHoursLow: number;
  remainingHoursHigh: number;
  remainingDollarsLow: number;
  remainingDollarsHigh: number;
  /** Budget minus forecast: expected hours/dollars left after spend to date + future allocations */
  remainingAfterForecastHoursLow: number;
  remainingAfterForecastHoursHigh: number;
  remainingAfterForecastDollarsLow: number;
  remainingAfterForecastDollarsHigh: number;
  projectedBurnHours: number;
  projectedBurnDollars: number;
  remainingAfterProjectedBurnHoursLow: number;
  remainingAfterProjectedBurnHoursHigh: number;
  remainingAfterProjectedBurnDollarsLow: number;
  remainingAfterProjectedBurnDollarsHigh: number;
  /** Hours-weighted person rates. Null when the hour denominator is 0. */
  blendedRatePast: number | null;
  blendedRateFuture: number | null;
  blendedRateProject: number | null;
  /** Project, then past, then future, then implied high$ / highHours. */
  blendedRateForRemainingHours: number | null;
  /** Leftover dollars converted at blendedRateForRemainingHours (not hours-cap leftover). */
  remainingHoursFromDollarsLow: number | null;
  remainingHoursFromDollarsHigh: number | null;
  bufferPercentLowDollars: number | null;
  bufferPercentHighDollars: number | null;
  /** Actuals freshness: up-to-date, 1 week behind, or more than 1 week behind. */
  actualsStatus: "up-to-date" | "1-week-behind" | "more-than-1-week-behind";
};

export function blendedRateFromTotals(dollars: number, hours: number): number | null {
  if (hours <= 0) return null;
  return dollars / hours;
}

export function resolveBlendedRateForRemainingHours(opts: {
  blendedRateProject: number | null;
  blendedRatePast: number | null;
  blendedRateFuture: number | null;
  impliedContractRate: number | null;
}): number | null {
  return (
    opts.blendedRateProject ??
    opts.blendedRatePast ??
    opts.blendedRateFuture ??
    opts.impliedContractRate
  );
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function computeBudgetRollups(
  projectStart: Date,
  projectEnd: Date | null | undefined,
  weeklyRows: WeeklyHoursRow[],
  budgetLines: BudgetLineInput[],
  asOf?: Date
): BudgetResult {
  const asOfDate = asOf ?? getAsOfDate();
  const completedWeeks = getCompletedWeeks(projectStart, projectEnd, asOfDate);
  const futureWeeks = getFutureWeeks(projectStart, projectEnd, asOfDate);
  const currentWeekStart = getWeekStartDate(asOfDate);
  currentWeekStart.setDate(currentWeekStart.getDate() + 7); // next Monday after as-of
  const currentAndFutureWeeks: Date[] = [...futureWeeks];
  // Add current week (the one containing "now" relative to as-of) - actually as-of is end of prev week,
  // so "current" week is the week that starts the Monday after the prev Sunday
  const weekAfterAsOf = new Date(asOfDate);
  weekAfterAsOf.setDate(weekAfterAsOf.getDate() + 1);
  const currentWeek = getWeekStartDate(weekAfterAsOf);
  if (!completedWeeks.some((w) => toDateOnly(w).getTime() === toDateOnly(currentWeek).getTime())) {
    currentAndFutureWeeks.unshift(currentWeek);
  }
  currentAndFutureWeeks.sort((a, b) => a.getTime() - b.getTime());

  const completedKeys = new Set(
    completedWeeks.map((w) => toDateOnly(w).toISOString().slice(0, 10))
  );
  const futureKeys = new Set(
    currentAndFutureWeeks.map((w) => toDateOnly(w).toISOString().slice(0, 10))
  );
  const currentWeekKey = new Set<string>();
  const futureWeeksKeys = new Set<string>();
  if (currentAndFutureWeeks.length > 0) {
    currentWeekKey.add(toDateOnly(currentAndFutureWeeks[0]!).toISOString().slice(0, 10));
    for (let i = 1; i < currentAndFutureWeeks.length; i++) {
      futureWeeksKeys.add(toDateOnly(currentAndFutureWeeks[i]!).toISOString().slice(0, 10));
    }
  }

  let plannedHoursToDate = 0;
  let actualHoursToDate = 0;
  let actualDollarsToDate = 0;
  let missingActuals = false;

  for (const row of weeklyRows) {
    const key = toDateOnly(row.weekStartDate).toISOString().slice(0, 10);
    if (!completedKeys.has(key)) continue;
    plannedHoursToDate += row.plannedHours;
    if (row.plannedHours > 0 && row.actualHours === null) {
      missingActuals = true;
    }
    if (row.actualHours !== null) {
      actualHoursToDate += row.actualHours;
      actualDollarsToDate += row.actualHours * row.rate;
    }
  }

  let forecastHours = actualHoursToDate;
  let forecastDollars = actualDollarsToDate;
  let projectedCurrentWeekHours = 0;
  let projectedCurrentWeekDollars = 0;
  let projectedFutureWeeksHours = 0;
  let projectedFutureWeeksDollars = 0;

  for (const row of weeklyRows) {
    const key = toDateOnly(row.weekStartDate).toISOString().slice(0, 10);
    if (currentWeekKey.has(key)) {
      projectedCurrentWeekHours += row.plannedHours;
      projectedCurrentWeekDollars += row.plannedHours * row.rate;
      forecastHours += row.plannedHours;
      forecastDollars += row.plannedHours * row.rate;
    } else if (futureWeeksKeys.has(key)) {
      projectedFutureWeeksHours += row.plannedHours;
      projectedFutureWeeksDollars += row.plannedHours * row.rate;
      forecastHours += row.plannedHours;
      forecastDollars += row.plannedHours * row.rate;
    }
  }

  const totalBudgetLowHours = budgetLines.reduce((s, b) => s + b.lowHours, 0);
  const totalBudgetHighHours = budgetLines.reduce((s, b) => s + b.highHours, 0);
  const totalBudgetLowDollars = budgetLines.reduce((s, b) => s + b.lowDollars, 0);
  const totalBudgetHighDollars = budgetLines.reduce((s, b) => s + b.highDollars, 0);

  let projectedBurnHours = 0;
  let projectedBurnDollars = 0;
  for (const row of weeklyRows) {
    const hours = row.actualHours ?? row.plannedHours;
    projectedBurnHours += hours;
    projectedBurnDollars += hours * row.rate;
  }

  const burnPercentLowHours =
    totalBudgetLowHours > 0 ? (actualHoursToDate / totalBudgetLowHours) * 100 : null;
  const burnPercentHighHours =
    totalBudgetHighHours > 0 ? (actualHoursToDate / totalBudgetHighHours) * 100 : null;
  const burnPercentLowDollars =
    totalBudgetLowDollars > 0 ? (actualDollarsToDate / totalBudgetLowDollars) * 100 : null;
  const burnPercentHighDollars =
    totalBudgetHighDollars > 0 ? (actualDollarsToDate / totalBudgetHighDollars) * 100 : null;

  const sortedCompletedKeys = Array.from(completedKeys).sort();
  const lastCompletedKey =
    sortedCompletedKeys.length > 0 ? sortedCompletedKeys[sortedCompletedKeys.length - 1]! : null;
  let earliestMissingKey: string | null = null;
  for (const key of sortedCompletedKeys) {
    const hasMissing = weeklyRows.some(
      (r) =>
        toDateOnly(r.weekStartDate).toISOString().slice(0, 10) === key &&
        r.plannedHours > 0 &&
        r.actualHours === null
    );
    if (hasMissing) {
      earliestMissingKey = key;
      break;
    }
  }
  const actualsStatus: BudgetResult["actualsStatus"] =
    !earliestMissingKey
      ? "up-to-date"
      : lastCompletedKey && earliestMissingKey === lastCompletedKey
        ? "1-week-behind"
        : "more-than-1-week-behind";

  const remainingAfterProjectedBurnHoursLow = totalBudgetLowHours - projectedBurnHours;
  const remainingAfterProjectedBurnHoursHigh = totalBudgetHighHours - projectedBurnHours;
  const remainingAfterProjectedBurnDollarsLow = totalBudgetLowDollars - projectedBurnDollars;
  const remainingAfterProjectedBurnDollarsHigh = totalBudgetHighDollars - projectedBurnDollars;

  const futureHours = projectedCurrentWeekHours + projectedFutureWeeksHours;
  const futureDollars = projectedCurrentWeekDollars + projectedFutureWeeksDollars;
  const blendedRatePast = blendedRateFromTotals(actualDollarsToDate, actualHoursToDate);
  const blendedRateFuture = blendedRateFromTotals(futureDollars, futureHours);
  const blendedRateProject = blendedRateFromTotals(projectedBurnDollars, projectedBurnHours);
  const impliedContractRateHigh = blendedRateFromTotals(
    totalBudgetHighDollars,
    totalBudgetHighHours
  );
  const blendedRateForRemainingHours = resolveBlendedRateForRemainingHours({
    blendedRateProject,
    blendedRatePast,
    blendedRateFuture,
    impliedContractRate: impliedContractRateHigh,
  });
  const remainingHoursFromDollarsLow =
    blendedRateForRemainingHours != null
      ? remainingAfterProjectedBurnDollarsLow / blendedRateForRemainingHours
      : null;
  const remainingHoursFromDollarsHigh =
    blendedRateForRemainingHours != null
      ? remainingAfterProjectedBurnDollarsHigh / blendedRateForRemainingHours
      : null;
  const bufferPercentLowDollars =
    totalBudgetLowDollars > 0
      ? (remainingAfterProjectedBurnDollarsLow / totalBudgetLowDollars) * 100
      : null;
  const bufferPercentHighDollars =
    totalBudgetHighDollars > 0
      ? (remainingAfterProjectedBurnDollarsHigh / totalBudgetHighDollars) * 100
      : null;

  return {
    plannedHoursToDate,
    actualHoursToDate,
    actualDollarsToDate,
    missingActuals,
    forecastHours,
    forecastDollars,
    forecastIncomplete: missingActuals,
    projectedCurrentWeekHours,
    projectedCurrentWeekDollars,
    projectedFutureWeeksHours,
    projectedFutureWeeksDollars,
    burnPercentLowHours,
    burnPercentHighHours,
    burnPercentLowDollars,
    burnPercentHighDollars,
    remainingHoursLow: totalBudgetLowHours - actualHoursToDate,
    remainingHoursHigh: totalBudgetHighHours - actualHoursToDate,
    remainingDollarsLow: totalBudgetLowDollars - actualDollarsToDate,
    remainingDollarsHigh: totalBudgetHighDollars - actualDollarsToDate,
    remainingAfterForecastHoursLow: totalBudgetLowHours - forecastHours,
    remainingAfterForecastHoursHigh: totalBudgetHighHours - forecastHours,
    remainingAfterForecastDollarsLow: totalBudgetLowDollars - forecastDollars,
    remainingAfterForecastDollarsHigh: totalBudgetHighDollars - forecastDollars,
    projectedBurnHours,
    projectedBurnDollars,
    remainingAfterProjectedBurnHoursLow,
    remainingAfterProjectedBurnHoursHigh,
    remainingAfterProjectedBurnDollarsLow,
    remainingAfterProjectedBurnDollarsHigh,
    blendedRatePast,
    blendedRateFuture,
    blendedRateProject,
    blendedRateForRemainingHours,
    remainingHoursFromDollarsLow,
    remainingHoursFromDollarsHigh,
    bufferPercentLowDollars,
    bufferPercentHighDollars,
    actualsStatus,
  };
}

/**
 * Returns weekly utilization (actual/planned) for a week. N/A if planned=0 or actual null.
 */
export function weeklyUtilization(
  plannedHours: number,
  actualHours: number | null
): number | null {
  if (plannedHours === 0 || actualHours === null) return null;
  return actualHours / plannedHours;
}

/**
 * Check if a planning cell should show mismatch (future weeks only, planned !== float).
 */
export function hasPlanningMismatch(
  weekStartDate: Date,
  plannedHours: number,
  floatScheduledHours: number,
  asOf?: Date
): boolean {
  const asOfDate = asOf ?? getAsOfDate();
  const weekStart = new Date(weekStartDate);
  weekStart.setUTCHours(0, 0, 0, 0);
  if (weekStart <= asOfDate) return false; // completed weeks: no mismatch highlight
  return Math.abs(plannedHours - floatScheduledHours) > 0.001;
}

/**
 * Check if a week has missing actuals (completed week, planned>0, actual null, not current week).
 */
export function hasMissingActuals(
  weekStartDate: Date,
  plannedHours: number,
  actualHours: number | null,
  asOf?: Date,
  now?: Date
): boolean {
  const asOfDate = asOf ?? getAsOfDate();
  const nowDate = now ?? new Date();
  if (isCurrentWeek(weekStartDate, nowDate)) return false;
  const weekStart = new Date(weekStartDate);
  weekStart.setHours(0, 0, 0, 0);
  if (weekStart > asOfDate) return false; // future: no actuals expected
  return plannedHours > 0 && actualHours === null;
}

/** When set, stale uses presence of ActualHoursMonthSplit rows instead of only null checks (avoids treating coerced 0 as “filled”). */
export type HasMissingActualsSplitWeekRowFlags = {
  hasRowFirst: boolean;
  hasRowSecond: boolean;
};

/**
 * Split-week actuals: stale if any month-half that is already "due" is still unfilled.
 * Matches Resourcing Actual grid unlock rules (first month after its UTC month ends; second after week completes).
 * Pass `rowFlags` from the client when split rows are loaded so a month with no row counts as unfilled even if the UI used to coerce the other month to 0.
 */
export function hasMissingActualsSplitWeek(
  weekStartDate: Date,
  plannedHours: number,
  valFirstMonth: number | null,
  valSecondMonth: number | null,
  monthKeyFirst: string,
  monthKeySecond: string,
  asOf?: Date,
  now?: Date,
  rowFlags?: HasMissingActualsSplitWeekRowFlags
): boolean {
  const asOfDate = asOf ?? getAsOfDate();
  const nowDate = now ?? new Date();
  if (isCurrentWeek(weekStartDate, nowDate)) return false;
  const weekStart = new Date(weekStartDate);
  weekStart.setHours(0, 0, 0, 0);
  if (weekStart > asOfDate) return false;
  if (plannedHours <= 0) return false;

  const firstMissing = rowFlags ? !rowFlags.hasRowFirst : valFirstMonth === null;
  const secondMissing = rowFlags ? !rowFlags.hasRowSecond : valSecondMonth === null;

  const firstHalfDue =
    isPastLastUtcDayOfMonthInWeek(weekStartDate, monthKeyFirst, nowDate) && firstMissing;
  const secondHalfEditable =
    isCompletedWeek(weekStartDate, asOfDate) && !isCurrentWeek(weekStartDate, nowDate);
  const secondHalfDue = secondHalfEditable && secondMissing;

  return firstHalfDue || secondHalfDue;
}

/**
 * Budget status for display (e.g. project detail header and overview cards).
 * Returns last week with actuals, missingActuals, and full rollups so the client can skip the budget API on load.
 */
export function getBudgetStatusForDisplay(
  projectStart: Date,
  projectEnd: Date | null | undefined,
  weeklyRows: WeeklyHoursRow[],
  budgetLines: BudgetLineInput[]
): {
  lastWeekWithActuals: string | null;
  missingActuals: boolean;
  rollups: BudgetResult;
  burndown: BudgetBurndownSeries;
} {
  const rollups = computeBudgetRollups(projectStart, projectEnd, weeklyRows, budgetLines);
  const burndown = computeBudgetBurndownSeries(
    projectStart,
    projectEnd,
    weeklyRows,
    budgetLines
  );
  const weeksWithActuals = weeklyRows
    .filter((r) => r.actualHours != null)
    .map((r) => r.weekStartDate.getTime());
  const lastWeekWithActuals =
    weeksWithActuals.length > 0
      ? new Date(Math.max(...weeksWithActuals)).toISOString().slice(0, 10)
      : null;
  return {
    lastWeekWithActuals,
    missingActuals: rollups.missingActuals,
    rollups,
    burndown,
  };
}

export type BudgetBurndownWeekPoint = {
  weekStartDate: string;
  label: string;
  monthKey: string;
  plannedHours: number;
  plannedDollars: number;
  actualHours: number | null;
  actualDollars: number | null;
  periodHours: number;
  periodDollars: number;
  isCompleted: boolean;
  isProjected: boolean;
  isMissingActuals: boolean;
  cumulativePlanHours: number;
  cumulativePlanDollars: number;
  cumulativeActualForecastHours: number;
  cumulativeActualForecastDollars: number;
  remainingVsHighDollars: number | null;
};

export type BudgetBurndownMonthPoint = {
  monthKey: string;
  label: string;
  plannedHours: number;
  plannedDollars: number;
  actualHours: number | null;
  actualDollars: number | null;
  periodHours: number;
  periodDollars: number;
  isCompleted: boolean;
  isProjected: boolean;
  isMixed: boolean;
  isMissingActuals: boolean;
  cumulativePlanHours: number;
  cumulativePlanDollars: number;
  cumulativeActualForecastHours: number;
  cumulativeActualForecastDollars: number;
  remainingVsHighDollars: number | null;
};

export type BudgetBurndownSeries = {
  weeks: BudgetBurndownWeekPoint[];
  months: BudgetBurndownMonthPoint[];
  contractHighDollars: number;
  asOfWeekStart: string | null;
  asOfMonthKey: string | null;
};

function weekKeyUtc(d: Date): string {
  return getWeekStartDate(d).toISOString().slice(0, 10);
}

function monthKeyFromWeekStart(d: Date): string {
  const w = getWeekStartDate(d);
  return `${w.getUTCFullYear()}-${String(w.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${m}/${y}`;
}

/**
 * Weekly (and month-rolled) budget burndown series. Float excluded.
 * Period burn: actual $ on completed weeks with full actuals; planned $ on
 * projected weeks and on completed weeks with missing actuals (not $0).
 * Cumulative actual + forecast uses actualHours ?? plannedHours per row (same as projected burn).
 */
export function computeBudgetBurndownSeries(
  projectStart: Date,
  projectEnd: Date | null | undefined,
  weeklyRows: WeeklyHoursRow[],
  budgetLines: BudgetLineInput[],
  asOf?: Date
): BudgetBurndownSeries {
  const asOfDate = asOf ?? getAsOfDate();
  const spine = getAllWeeks(projectStart, projectEnd);
  const completedWeeks = getCompletedWeeks(projectStart, projectEnd, asOfDate);
  const lastCompleted =
    completedWeeks.length > 0 ? completedWeeks[completedWeeks.length - 1]! : null;
  const asOfWeekStart = lastCompleted ? weekKeyUtc(lastCompleted) : null;
  const asOfMonthKey = lastCompleted ? monthKeyFromWeekStart(lastCompleted) : null;

  const contractHighDollars = budgetLines.reduce((s, b) => s + b.highDollars, 0);

  type Agg = {
    plannedHours: number;
    plannedDollars: number;
    actualHoursSum: number;
    actualDollarsSum: number;
    forecastHours: number;
    forecastDollars: number;
    isMissingActuals: boolean;
  };
  const byWeek = new Map<string, Agg>();
  for (const row of weeklyRows) {
    const key = weekKeyUtc(row.weekStartDate);
    const cur = byWeek.get(key) ?? {
      plannedHours: 0,
      plannedDollars: 0,
      actualHoursSum: 0,
      actualDollarsSum: 0,
      forecastHours: 0,
      forecastDollars: 0,
      isMissingActuals: false,
    };
    cur.plannedHours += row.plannedHours;
    cur.plannedDollars += row.plannedHours * row.rate;
    const forecastH = row.actualHours ?? row.plannedHours;
    cur.forecastHours += forecastH;
    cur.forecastDollars += forecastH * row.rate;
    if (row.actualHours !== null) {
      cur.actualHoursSum += row.actualHours;
      cur.actualDollarsSum += row.actualHours * row.rate;
    }
    const completed = isCompletedWeek(row.weekStartDate, asOfDate);
    if (completed && row.plannedHours > 0 && row.actualHours === null) {
      cur.isMissingActuals = true;
    }
    byWeek.set(key, cur);
  }

  const weeks: BudgetBurndownWeekPoint[] = [];
  let cumulativePlanHours = 0;
  let cumulativePlanDollars = 0;
  let cumulativeActualForecastHours = 0;
  let cumulativeActualForecastDollars = 0;

  for (const weekDate of spine) {
    const key = weekKeyUtc(weekDate);
    const agg = byWeek.get(key) ?? {
      plannedHours: 0,
      plannedDollars: 0,
      actualHoursSum: 0,
      actualDollarsSum: 0,
      forecastHours: 0,
      forecastDollars: 0,
      isMissingActuals: false,
    };
    const isCompleted = isCompletedWeek(weekDate, asOfDate);
    const isProjected = !isCompleted;
    const isMissingActuals = isCompleted && agg.isMissingActuals;
    const actualHours = !isCompleted || isMissingActuals ? null : agg.actualHoursSum;
    const actualDollars = !isCompleted || isMissingActuals ? null : agg.actualDollarsSum;
    const periodHours = isCompleted && !isMissingActuals ? agg.actualHoursSum : agg.plannedHours;
    const periodDollars =
      isCompleted && !isMissingActuals ? agg.actualDollarsSum : agg.plannedDollars;

    cumulativePlanHours += agg.plannedHours;
    cumulativePlanDollars += agg.plannedDollars;
    cumulativeActualForecastHours += agg.forecastHours;
    cumulativeActualForecastDollars += agg.forecastDollars;

    weeks.push({
      weekStartDate: key,
      label: formatWeekShort(weekDate),
      monthKey: monthKeyFromWeekStart(weekDate),
      plannedHours: agg.plannedHours,
      plannedDollars: agg.plannedDollars,
      actualHours,
      actualDollars,
      periodHours,
      periodDollars,
      isCompleted,
      isProjected,
      isMissingActuals,
      cumulativePlanHours,
      cumulativePlanDollars,
      cumulativeActualForecastHours,
      cumulativeActualForecastDollars,
      remainingVsHighDollars:
        contractHighDollars > 0
          ? contractHighDollars - cumulativeActualForecastDollars
          : null,
    });
  }

  const months: BudgetBurndownMonthPoint[] = [];
  const monthOrder: string[] = [];
  const weeksByMonth = new Map<string, BudgetBurndownWeekPoint[]>();
  for (const w of weeks) {
    if (!weeksByMonth.has(w.monthKey)) {
      monthOrder.push(w.monthKey);
      weeksByMonth.set(w.monthKey, []);
    }
    weeksByMonth.get(w.monthKey)!.push(w);
  }

  for (const mk of monthOrder) {
    const group = weeksByMonth.get(mk)!;
    const last = group[group.length - 1]!;
    const plannedHours = group.reduce((s, w) => s + w.plannedHours, 0);
    const plannedDollars = group.reduce((s, w) => s + w.plannedDollars, 0);
    const periodHours = group.reduce((s, w) => s + w.periodHours, 0);
    const periodDollars = group.reduce((s, w) => s + w.periodDollars, 0);
    const isMissingActuals = group.some((w) => w.isMissingActuals);
    const allCompleted = group.every((w) => w.isCompleted);
    const allProjected = group.every((w) => w.isProjected);
    const isMixed = !allCompleted && !allProjected;
    const actualHours = isMissingActuals
      ? null
      : group.reduce((s, w) => s + (w.actualHours ?? 0), 0);
    const actualDollars = isMissingActuals
      ? null
      : group.reduce((s, w) => s + (w.actualDollars ?? 0), 0);

    months.push({
      monthKey: mk,
      label: monthLabelFromKey(mk),
      plannedHours,
      plannedDollars,
      actualHours,
      actualDollars,
      periodHours,
      periodDollars,
      isCompleted: allCompleted,
      isProjected: allProjected,
      isMixed,
      isMissingActuals,
      cumulativePlanHours: last.cumulativePlanHours,
      cumulativePlanDollars: last.cumulativePlanDollars,
      cumulativeActualForecastHours: last.cumulativeActualForecastHours,
      cumulativeActualForecastDollars: last.cumulativeActualForecastDollars,
      remainingVsHighDollars: last.remainingVsHighDollars,
    });
  }

  return {
    weeks,
    months,
    contractHighDollars,
    asOfWeekStart,
    asOfMonthKey,
  };
}
