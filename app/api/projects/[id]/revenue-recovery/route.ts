import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { getWeekStartDate, getCompletedWeeks, getAllWeeks, getAsOfDate } from "@/lib/weekUtils";

/**
 * GET /api/projects/[id]/revenue-recovery
 * Returns previous 4 weeks' and to-date forecast vs actual revenue for the project.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assignments: { include: { role: true } },
      plannedHours: true,
      actualHours: true,
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const singleRate =
    project.useSingleRate && project.singleBillRate != null
      ? Number(project.singleBillRate)
      : null;
  const rateByRole = new Map<string, number>();
  for (const a of project.assignments) {
    const override = a.billRateOverride ? Number(a.billRateOverride) : null;
    if (override != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, override);
    } else if (singleRate != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, singleRate);
    } else {
      const prr = await prisma.projectRoleRate.findUnique({
        where: {
          projectId_roleId: { projectId: id, roleId: a.roleId },
        },
      });
      rateByRole.set(`${a.personId}-${a.roleId}`, prr ? Number(prr.billRate) : 0);
    }
  }

  const weeks: Array<{
    weekStartDate: string;
    forecastDollars: number;
    actualDollars: number;
    recoveryPercent: number | null;
    dollarsDelta: number;
  }> = [];

  let weekStart = getWeekStartDate(new Date());
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  for (let i = 0; i < 4; i++) {
    const weekKey = weekStart.toISOString().slice(0, 10);
    let forecastDollars = 0;
    let actualDollars = 0;

    for (const a of project.assignments) {
      const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
      const planned = project.plannedHours.find(
        (ph) =>
          ph.personId === a.personId &&
          ph.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const actual = project.actualHours.find(
        (ah) =>
          ah.personId === a.personId &&
          ah.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const plannedHours = planned ? Number(planned.hours) : 0;
      const actualHours = actual?.hours != null ? Number(actual.hours) : 0;
      forecastDollars += plannedHours * rate;
      actualDollars += actualHours * rate;
    }

    const recoveryPercent =
      forecastDollars > 0 ? (actualDollars / forecastDollars) * 100 : null;
    const dollarsDelta = actualDollars - forecastDollars;

    weeks.push({
      weekStartDate: weekKey,
      forecastDollars,
      actualDollars,
      recoveryPercent,
      dollarsDelta,
    });

    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  }

  const completedWeeks = getCompletedWeeks(
    project.startDate,
    project.endDate
  );
  let toDateForecastDollars = 0;
  let toDateActualDollars = 0;
  for (const weekDate of completedWeeks) {
    const weekKey = weekDate.toISOString().slice(0, 10);
    for (const a of project.assignments) {
      const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
      const planned = project.plannedHours.find(
        (ph) =>
          ph.personId === a.personId &&
          ph.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const actual = project.actualHours.find(
        (ah) =>
          ah.personId === a.personId &&
          ah.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const plannedHours = planned ? Number(planned.hours) : 0;
      const actualHours = actual?.hours != null ? Number(actual.hours) : 0;
      toDateForecastDollars += plannedHours * rate;
      toDateActualDollars += actualHours * rate;
    }
  }
  const toDateRecoveryPercent =
    toDateForecastDollars > 0
      ? (toDateActualDollars / toDateForecastDollars) * 100
      : null;
  const toDateDollarsDelta = toDateActualDollars - toDateForecastDollars;

  // Monthly aggregates for chart: all months of the project (completed + future)
  const completedWeekKeys = new Set(
    completedWeeks.map((d) => d.toISOString().slice(0, 10))
  );
  const allWeeks = getAllWeeks(project.startDate, project.endDate);
  const monthTotals = new Map<
    string,
    { forecastDollars: number; actualDollars: number }
  >();
  for (const weekDate of allWeeks) {
    const weekKey = weekDate.toISOString().slice(0, 10);
    const isCompleted = completedWeekKeys.has(weekKey);
    const y = weekDate.getUTCFullYear();
    const m = weekDate.getUTCMonth() + 1;
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    let forecastDollars = 0;
    let actualDollars = 0;
    for (const a of project.assignments) {
      const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
      const planned = project.plannedHours.find(
        (ph) =>
          ph.personId === a.personId &&
          ph.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const actual = project.actualHours.find(
        (ah) =>
          ah.personId === a.personId &&
          ah.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const plannedHours = planned ? Number(planned.hours) : 0;
      const actualHours =
        isCompleted && actual?.hours != null ? Number(actual.hours) : 0;
      forecastDollars += plannedHours * rate;
      actualDollars += actualHours * rate;
    }
    const existing = monthTotals.get(monthKey) ?? {
      forecastDollars: 0,
      actualDollars: 0,
    };
    monthTotals.set(monthKey, {
      forecastDollars: existing.forecastDollars + forecastDollars,
      actualDollars: existing.actualDollars + actualDollars,
    });
  }
  const monthKeys = Array.from(monthTotals.keys()).sort();
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const asOfDate = getAsOfDate();
  let cumulativeForecastToDate = 0;
  let cumulativeActualToDate = 0;
  const monthly: Array<{
    monthKey: string;
    monthLabel: string;
    forecastDollars: number;
    actualDollars: number;
    recoveryPercent: number | null;
    overallRecoveryPercent: number | null;
  }> = [];
  for (const monthKey of monthKeys) {
    const { forecastDollars: fd, actualDollars: ad } = monthTotals.get(monthKey)!;
    const [y, m] = monthKey.split("-").map(Number);
    const lastDayOfMonth = new Date(Date.UTC(y, m, 0));
    const lastWeekStartOfMonth = getWeekStartDate(lastDayOfMonth);
    const monthComplete = lastWeekStartOfMonth <= asOfDate;
    if (monthComplete) {
      cumulativeForecastToDate += fd;
      cumulativeActualToDate += ad;
    }
    const monthLabel = `${monthNames[m - 1]} ${y}`;
    const recoveryPercent =
      fd > 0 ? (ad / fd) * 100 : null;
    const overallRecoveryPercent = monthComplete && cumulativeForecastToDate > 0
      ? (cumulativeActualToDate / cumulativeForecastToDate) * 100
      : null;
    monthly.push({
      monthKey,
      monthLabel,
      forecastDollars: fd,
      actualDollars: ad,
      recoveryPercent,
      overallRecoveryPercent: overallRecoveryPercent ?? null,
    });
  }

  return NextResponse.json({
    weeks,
    toDate: {
      forecastDollars: toDateForecastDollars,
      actualDollars: toDateActualDollars,
      recoveryPercent: toDateRecoveryPercent,
      dollarsDelta: toDateDollarsDelta,
    },
    monthly,
  });
}
