/**
 * Budget calculations for Project Workbench.
 * Uses ONLY plan + actuals. Float excluded.
 * Completed weeks: weekStartDate <= asOfDate. Never include current week in to-date.
 */

import {
  getAsOfDate,
  getCompletedWeeks,
  getFutureWeeks,
  getWeekStartDate,
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
};

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

  const burnPercentLowHours =
    totalBudgetLowHours > 0 ? (actualHoursToDate / totalBudgetLowHours) * 100 : null;
  const burnPercentHighHours =
    totalBudgetHighHours > 0 ? (actualHoursToDate / totalBudgetHighHours) * 100 : null;
  const burnPercentLowDollars =
    totalBudgetLowDollars > 0 ? (actualDollarsToDate / totalBudgetLowDollars) * 100 : null;
  const burnPercentHighDollars =
    totalBudgetHighDollars > 0 ? (actualDollarsToDate / totalBudgetHighDollars) * 100 : null;

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
