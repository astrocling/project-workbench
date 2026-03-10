import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  computeRevenueRecoveryToDate,
  computeRevenueRecoveryRecentWeeks,
  type RevenueRecoveryToDate,
  type RevenueRecoveryWeek,
} from "@/lib/revenueRecovery";
import {
  computeBudgetRollups,
  type WeeklyHoursRow,
  type BudgetResult,
} from "@/lib/budgetCalculations";
import { getAllWeeks } from "@/lib/weekUtils";

export type PmProjectTableRow = {
  id: string;
  name: string;
  slug: string;
  cdaEnabled: boolean;
  burnPercent: number | null;
  bufferPercent: number | null;
  recovery4WeekPercent: number | null;
  actualsStatus: BudgetResult["actualsStatus"];
  recoveryToDatePercent?: number | null;
};

export type PortfolioRevenueRecovery = {
  toDate: RevenueRecoveryToDate;
  /** Most recent single week (same as project "This week"). */
  thisWeek: RevenueRecoveryWeek;
  /** Sum of the previous 4 weeks. */
  prevFourWeeks: RevenueRecoveryToDate;
};

export type PortfolioMetrics = {
  totalActive: number;
  activeCda: number;
  activeNonCda: number;
  portfolioValue: number;
  /** Aggregated revenue recovery across PM's projects (only for PM-scoped metrics). */
  revenueRecovery?: PortfolioRevenueRecovery | null;
  /** True if any PM project has missing actuals (completed weeks with planned but no actuals). */
  staleActuals?: boolean;
  /** Per-project rows for PM dashboard table (only when from getCachedPortfolioMetricsForPm). */
  projectTableRows?: PmProjectTableRow[];
};

export async function getCachedPortfolioMetrics(): Promise<PortfolioMetrics> {
  return unstable_cache(
    async () => {
      const activeProjects = await prisma.project.findMany({
        where: { status: "Active" },
        select: {
          id: true,
          cdaEnabled: true,
          budgetLines: { select: { highDollars: true } },
        },
      });
      const totalActive = activeProjects.length;
      const activeCda = activeProjects.filter((p) => p.cdaEnabled === true).length;
      const activeNonCda = activeProjects.filter((p) => p.cdaEnabled !== true).length;
      const portfolioValue = activeProjects.reduce((sum, p) => {
        const projectBudget = p.budgetLines.reduce(
          (s, bl) => s + Number(bl.highDollars),
          0
        );
        return sum + projectBudget;
      }, 0);
      return { totalActive, activeCda, activeNonCda, portfolioValue };
    },
    ["portfolio-metrics"],
    { revalidate: 60 }
  )();
}

/** Portfolio metrics for projects where the given person is Project Manager (PM). */
export async function getCachedPortfolioMetricsForPm(
  personId: string
): Promise<PortfolioMetrics> {
  return unstable_cache(
    async () => {
      const activeProjects = await prisma.project.findMany({
        where: {
          status: "Active",
          projectKeyRoles: {
            some: { personId, type: "PM" },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          cdaEnabled: true,
          startDate: true,
          endDate: true,
          useSingleRate: true,
          singleBillRate: true,
          budgetLines: {
            select: { lowHours: true, highHours: true, lowDollars: true, highDollars: true },
          },
          assignments: {
            select: { personId: true, roleId: true, billRateOverride: true },
          },
          plannedHours: true,
          actualHours: true,
          projectRoleRates: { select: { roleId: true, billRate: true } },
        },
      });
      const totalActive = activeProjects.length;
      const activeCda = activeProjects.filter((p) => p.cdaEnabled === true).length;
      const activeNonCda = activeProjects.filter((p) => p.cdaEnabled !== true).length;
      const portfolioValue = activeProjects.reduce((sum, p) => {
        const projectBudget = p.budgetLines.reduce(
          (s, bl) => s + Number(bl.highDollars),
          0
        );
        return sum + projectBudget;
      }, 0);

      let staleActuals = false;
      let revenueRecovery: PortfolioRevenueRecovery | null = null;
      const projectTableRows: PmProjectTableRow[] = [];
      let sumForecast = 0;
      let sumActual = 0;
      const weekSums = [
        { f: 0, a: 0 },
        { f: 0, a: 0 },
        { f: 0, a: 0 },
        { f: 0, a: 0 },
      ];
      let thisWeekStartDate = "";

      for (const project of activeProjects) {
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
            const prr = project.projectRoleRates.find((r) => r.roleId === a.roleId);
            rateByRole.set(`${a.personId}-${a.roleId}`, prr ? Number(prr.billRate) : 0);
          }
        }
        const getRate = (pid: string, rid: string) =>
          rateByRole.get(`${pid}-${rid}`) ?? 0;
        const toDate = computeRevenueRecoveryToDate(
          project.startDate,
          project.endDate,
          project.assignments.map((a) => ({ personId: a.personId, roleId: a.roleId })),
          project.plannedHours,
          project.actualHours,
          getRate
        );
        sumForecast += toDate.forecastDollars;
        sumActual += toDate.actualDollars;

        const recentWeeks = computeRevenueRecoveryRecentWeeks(
          project.startDate,
          project.endDate,
          project.assignments.map((a) => ({ personId: a.personId, roleId: a.roleId })),
          project.plannedHours,
          project.actualHours,
          getRate
        );
        if (recentWeeks.length > 0 && !thisWeekStartDate) {
          thisWeekStartDate = recentWeeks[0].weekStartDate;
        }
        recentWeeks.forEach((w, i) => {
          if (i < 4) {
            weekSums[i].f += w.forecastDollars;
            weekSums[i].a += w.actualDollars;
          }
        });

        const end = project.endDate ?? new Date();
        const allWeeks = getAllWeeks(project.startDate, end);
        const weeklyRows: WeeklyHoursRow[] = [];
        for (const a of project.assignments) {
          const rate = getRate(a.personId, a.roleId);
          for (const weekDate of allWeeks) {
            const wk = weekDate.toISOString().slice(0, 10);
            const planned = project.plannedHours.find(
              (ph) =>
                ph.personId === a.personId &&
                ph.weekStartDate.toISOString().slice(0, 10) === wk
            );
            const actual = project.actualHours.find(
              (ah) =>
                ah.personId === a.personId &&
                ah.weekStartDate.toISOString().slice(0, 10) === wk
            );
            weeklyRows.push({
              weekStartDate: new Date(weekDate),
              plannedHours: planned ? Number(planned.hours) : 0,
              actualHours: actual?.hours != null ? Number(actual.hours) : null,
              rate,
            });
          }
        }
        const budgetLinesInput = project.budgetLines.map((bl) => ({
          lowHours: Number(bl.lowHours),
          highHours: Number(bl.highHours),
          lowDollars: Number(bl.lowDollars),
          highDollars: Number(bl.highDollars),
        }));
        const rollups = computeBudgetRollups(
          project.startDate,
          project.endDate,
          weeklyRows,
          budgetLinesInput
        );
        if (rollups.missingActuals) staleActuals = true;

        const totalBudgetHours =
          rollups.remainingHoursHigh + rollups.actualHoursToDate;
        const bufferPercent =
          totalBudgetHours > 0
            ? (rollups.remainingAfterProjectedBurnHoursHigh / totalBudgetHours) * 100
            : null;
        const sum4Forecast = recentWeeks
          .slice(0, 4)
          .reduce((s, w) => s + w.forecastDollars, 0);
        const sum4Actual = recentWeeks
          .slice(0, 4)
          .reduce((s, w) => s + w.actualDollars, 0);
        const recovery4WeekPercent =
          sum4Forecast > 0 ? (sum4Actual / sum4Forecast) * 100 : null;

        projectTableRows.push({
          id: project.id,
          name: project.name,
          slug: project.slug,
          cdaEnabled: project.cdaEnabled === true,
          burnPercent: rollups.burnPercentHighHours,
          bufferPercent,
          recovery4WeekPercent,
          actualsStatus: rollups.actualsStatus,
          recoveryToDatePercent: toDate.recoveryPercent ?? null,
        });
      }

      if (activeProjects.length > 0) {
        const prevFourForecast = weekSums[0].f + weekSums[1].f + weekSums[2].f + weekSums[3].f;
        const prevFourActual = weekSums[0].a + weekSums[1].a + weekSums[2].a + weekSums[3].a;
        revenueRecovery = {
          toDate: {
            forecastDollars: sumForecast,
            actualDollars: sumActual,
            recoveryPercent:
              sumForecast > 0 ? (sumActual / sumForecast) * 100 : null,
            dollarsDelta: sumActual - sumForecast,
          },
          thisWeek: {
            weekStartDate: thisWeekStartDate,
            forecastDollars: weekSums[0].f,
            actualDollars: weekSums[0].a,
            recoveryPercent:
              weekSums[0].f > 0 ? (weekSums[0].a / weekSums[0].f) * 100 : null,
            dollarsDelta: weekSums[0].a - weekSums[0].f,
          },
          prevFourWeeks: {
            forecastDollars: prevFourForecast,
            actualDollars: prevFourActual,
            recoveryPercent:
              prevFourForecast > 0
                ? (prevFourActual / prevFourForecast) * 100
                : null,
            dollarsDelta: prevFourActual - prevFourForecast,
          },
        };
      }

      return {
        totalActive,
        activeCda,
        activeNonCda,
        portfolioValue,
        revenueRecovery,
        staleActuals: activeProjects.length > 0 ? staleActuals : undefined,
        projectTableRows,
      };
    },
    ["portfolio-metrics-pm", personId],
    { revalidate: 60 }
  )();
}

export function formatPortfolioDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
