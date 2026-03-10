import { getCompletedWeeks, getWeekStartDate, getAsOfDate } from "@/lib/weekUtils";

export type RevenueRecoveryToDate = {
  forecastDollars: number;
  actualDollars: number;
  recoveryPercent: number | null;
  dollarsDelta: number;
};

/** Single week recovery (used for "this week" and as element of recent weeks). */
export type RevenueRecoveryWeek = {
  weekStartDate: string;
  forecastDollars: number;
  actualDollars: number;
  recoveryPercent: number | null;
  dollarsDelta: number;
};

type AssignmentRow = { personId: string; roleId: string };
type PlannedRow = { personId: string; weekStartDate: Date; hours: unknown };
type ActualRow = { personId: string; weekStartDate: Date; hours: unknown };

function computeOneWeek(
  weekKey: string,
  assignments: AssignmentRow[],
  plannedHours: PlannedRow[],
  actualHours: ActualRow[],
  getRate: (personId: string, roleId: string) => number
): { forecastDollars: number; actualDollars: number } {
  let forecastDollars = 0;
  let actualDollars = 0;
  for (const a of assignments) {
    const rate = getRate(a.personId, a.roleId);
    const planned = plannedHours.find(
      (ph) =>
        ph.personId === a.personId &&
        ph.weekStartDate.toISOString().slice(0, 10) === weekKey
    );
    const actual = actualHours.find(
      (ah) =>
        ah.personId === a.personId &&
        ah.weekStartDate.toISOString().slice(0, 10) === weekKey
    );
    const plannedHoursVal = planned ? Number(planned.hours) : 0;
    const actualHoursVal = actual?.hours != null ? Number(actual.hours) : 0;
    forecastDollars += plannedHoursVal * rate;
    actualDollars += actualHoursVal * rate;
  }
  return { forecastDollars, actualDollars };
}

/**
 * Computes to-date revenue recovery for a single project: sum of forecast (planned × rate)
 * and actual (actual hours × rate) over all completed weeks, then recovery % and delta.
 */
export function computeRevenueRecoveryToDate(
  projectStart: Date,
  projectEnd: Date | null,
  assignments: AssignmentRow[],
  plannedHours: PlannedRow[],
  actualHours: ActualRow[],
  getRate: (personId: string, roleId: string) => number,
  asOf?: Date
): RevenueRecoveryToDate {
  const completedWeeks = getCompletedWeeks(projectStart, projectEnd, asOf);
  let toDateForecastDollars = 0;
  let toDateActualDollars = 0;

  for (const weekDate of completedWeeks) {
    const weekKey = weekDate.toISOString().slice(0, 10);
    const one = computeOneWeek(
      weekKey,
      assignments,
      plannedHours,
      actualHours,
      getRate
    );
    toDateForecastDollars += one.forecastDollars;
    toDateActualDollars += one.actualDollars;
  }

  const recoveryPercent =
    toDateForecastDollars > 0
      ? (toDateActualDollars / toDateForecastDollars) * 100
      : null;
  const dollarsDelta = toDateActualDollars - toDateForecastDollars;

  return {
    forecastDollars: toDateForecastDollars,
    actualDollars: toDateActualDollars,
    recoveryPercent,
    dollarsDelta,
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns the previous 4 weeks (most recent first), same week range as the project revenue-recovery API.
 * Only includes forecast/actual for weeks that fall within project start/end and are completed (weekStart <= asOf).
 */
export function computeRevenueRecoveryRecentWeeks(
  projectStart: Date,
  projectEnd: Date | null,
  assignments: AssignmentRow[],
  plannedHours: PlannedRow[],
  actualHours: ActualRow[],
  getRate: (personId: string, roleId: string) => number,
  asOf?: Date
): RevenueRecoveryWeek[] {
  const asOfDate = asOf ?? getAsOfDate();
  const projectStartMs = getWeekStartDate(projectStart).getTime();
  const projectEndMs = projectEnd
    ? getWeekStartDate(projectEnd).getTime()
    : Infinity;
  const asOfMs = getWeekStartDate(asOfDate).getTime();

  let weekStart = getWeekStartDate(new Date());
  weekStart.setUTCDate(weekStart.getUTCDate() - 7); // last week's Monday

  const result: RevenueRecoveryWeek[] = [];
  for (let i = 0; i < 4; i++) {
    const weekKey = weekStart.toISOString().slice(0, 10);
    const weekMs = weekStart.getTime();
    const inRange =
      weekMs >= projectStartMs &&
      weekMs <= projectEndMs &&
      weekMs <= asOfMs;
    const { forecastDollars, actualDollars } = inRange
      ? computeOneWeek(weekKey, assignments, plannedHours, actualHours, getRate)
      : { forecastDollars: 0, actualDollars: 0 };
    const recoveryPercent =
      forecastDollars > 0 ? (actualDollars / forecastDollars) * 100 : null;
    const dollarsDelta = actualDollars - forecastDollars;
    result.push({
      weekStartDate: weekKey,
      forecastDollars,
      actualDollars,
      recoveryPercent,
      dollarsDelta,
    });
    weekStart = new Date(weekStart.getTime() - WEEK_MS);
  }
  return result;
}
