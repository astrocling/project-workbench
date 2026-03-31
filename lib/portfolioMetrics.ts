import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  buildPlannedActualMaps,
  plannedActualKey,
  computeRevenueRecoveryToDateWithMaps,
  computeRevenueRecoveryRecentWeeksWithMaps,
  type RevenueRecoveryToDate,
  type RevenueRecoveryWeek,
} from "@/lib/revenueRecovery";
import {
  computeBudgetRollups,
  type WeeklyHoursRow,
  type BudgetResult,
} from "@/lib/budgetCalculations";
import { getAllWeeks, getAsOfDate } from "@/lib/weekUtils";

export type RagOverall = "Red" | "Amber" | "Green";

export type PmProjectTableRow = {
  id: string;
  name: string;
  slug: string;
  clientName: string;
  cdaEnabled: boolean;
  burnPercent: number | null;
  bufferPercent: number | null;
  /** Most recent completed week (same week as portfolio "This week" card). */
  recoveryThisWeekPercent: number | null;
  recovery4WeekPercent: number | null;
  actualsStatus: BudgetResult["actualsStatus"];
  /** Overall RAG from the most recent status report, if within 2 weeks. */
  ragOverall: RagOverall | null;
  /** True when the project has at least one status report but the most recent is older than 2 weeks. */
  statusReportStale?: boolean;
  recoveryToDatePercent?: number | null;
  /** True when at least one visible assignment has Ready on in the Planned grid. */
  requestOpen: boolean;
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
  /** Distinct client names from projects in scope (for filter dropdown). */
  clientsInScope: string[];
  /** Aggregated revenue recovery across PM's projects (only for PM-scoped metrics). */
  revenueRecovery?: PortfolioRevenueRecovery | null;
  /** True if any PM project has missing actuals (completed weeks with planned but no actuals). */
  staleActuals?: boolean;
  /** Per-project rows for PM dashboard table (only when from getCachedPortfolioMetricsForPm). */
  projectTableRows?: PmProjectTableRow[];
};

type KeyRoleType = "PM" | "PGM" | "CAD";

/**
 * Internal: fetch portfolio metrics for a person and role (PM/PGM/CAD).
 * Uses single asOf, Map-based lookups for planned/actual, and WithMaps revenue recovery.
 */
async function getPortfolioMetricsForRole(
  personId: string,
  role: KeyRoleType,
  clientFilter?: string
): Promise<PortfolioMetrics> {
  let activeProjects = await prisma.project.findMany({
    where: {
      status: "Active",
      projectKeyRoles: {
        some: { personId, type: role },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      clientName: true,
      cdaEnabled: true,
      startDate: true,
      endDate: true,
      useSingleRate: true,
      singleBillRate: true,
      budgetLines: {
        select: {
          lowHours: true,
          highHours: true,
          lowDollars: true,
          highDollars: true,
        },
      },
      assignments: {
        select: {
          personId: true,
          roleId: true,
          billRateOverride: true,
          hiddenFromGrid: true,
        },
      },
      readyForFloatUpdates: {
        select: { personId: true, ready: true },
      },
      plannedHours: true,
      actualHours: true,
      projectRoleRates: { select: { roleId: true, billRate: true } },
      statusReports: {
        orderBy: { reportDate: "desc" },
        take: 1,
        select: { ragOverall: true, reportDate: true },
      },
    },
  });

  const clientsInScope = [...new Set(activeProjects.map((p) => p.clientName))].sort();
  if (clientFilter && clientFilter.trim() !== "") {
    activeProjects = activeProjects.filter((p) => p.clientName === clientFilter);
  }

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

  const asOf = getAsOfDate();
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
    const { plannedMap, actualMap } = buildPlannedActualMaps(
      project.plannedHours,
      project.actualHours
    );

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
        rateByRole.set(
          `${a.personId}-${a.roleId}`,
          prr ? Number(prr.billRate) : 0
        );
      }
    }
    const getRate = (pid: string, rid: string) =>
      rateByRole.get(`${pid}-${rid}`) ?? 0;

    const assignmentsList = project.assignments.map((a) => ({
      personId: a.personId,
      roleId: a.roleId,
    }));

    const toDate = computeRevenueRecoveryToDateWithMaps(
      project.startDate,
      project.endDate,
      assignmentsList,
      plannedMap,
      actualMap,
      getRate,
      asOf
    );
    sumForecast += toDate.forecastDollars;
    sumActual += toDate.actualDollars;

    const recentWeeks = computeRevenueRecoveryRecentWeeksWithMaps(
      project.startDate,
      project.endDate,
      assignmentsList,
      plannedMap,
      actualMap,
      getRate,
      asOf
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
        const plannedHours =
          plannedMap.get(plannedActualKey(a.personId, wk)) ?? 0;
        const actualVal = actualMap.get(plannedActualKey(a.personId, wk));
        weeklyRows.push({
          weekStartDate: new Date(weekDate),
          plannedHours,
          actualHours: actualVal != null ? actualVal : null,
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
      budgetLinesInput,
      asOf
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
    const recoveryThisWeekPercent = recentWeeks[0]?.recoveryPercent ?? null;
    const recovery4WeekPercent =
      sum4Forecast > 0 ? (sum4Actual / sum4Forecast) * 100 : null;

    const latestStatusReport = project.statusReports[0];
    const twoWeeksAgo = new Date(asOf);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    twoWeeksAgo.setHours(0, 0, 0, 0);
    const reportDate = latestStatusReport?.reportDate
      ? new Date(latestStatusReport.reportDate)
      : null;
    if (reportDate) reportDate.setHours(0, 0, 0, 0);
    const reportIsRecent =
      reportDate != null && reportDate >= twoWeeksAgo;
    const ragOverall =
      reportIsRecent && latestStatusReport?.ragOverall
        ? latestStatusReport.ragOverall
        : null;
    const statusReportStale = !!latestStatusReport && !reportIsRecent;

    const visiblePersonIds = new Set(
      project.assignments.filter((a) => !a.hiddenFromGrid).map((a) => a.personId)
    );
    const requestOpen = project.readyForFloatUpdates.some(
      (r) => r.ready && visiblePersonIds.has(r.personId)
    );

    projectTableRows.push({
      id: project.id,
      name: project.name,
      slug: project.slug,
      clientName: project.clientName,
      cdaEnabled: project.cdaEnabled === true,
      burnPercent: rollups.burnPercentHighHours,
      bufferPercent,
      recoveryThisWeekPercent,
      recovery4WeekPercent,
      actualsStatus: rollups.actualsStatus,
      ragOverall,
      statusReportStale,
      recoveryToDatePercent: toDate.recoveryPercent ?? null,
      requestOpen,
    });
  }

  if (activeProjects.length > 0) {
    const prevFourForecast =
      weekSums[0].f + weekSums[1].f + weekSums[2].f + weekSums[3].f;
    const prevFourActual =
      weekSums[0].a + weekSums[1].a + weekSums[2].a + weekSums[3].a;
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
    clientsInScope,
    revenueRecovery,
    staleActuals: activeProjects.length > 0 ? staleActuals : undefined,
    projectTableRows,
  };
}

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
      return { totalActive, activeCda, activeNonCda, portfolioValue, clientsInScope: [] };
    },
    ["portfolio-metrics"],
    { revalidate: 60, tags: ["portfolio-metrics"] }
  )();
}

/** Portfolio metrics for projects where the given person is Project Manager (PM). */
export async function getCachedPortfolioMetricsForPm(
  personId: string,
  clientFilter?: string
): Promise<PortfolioMetrics> {
  return unstable_cache(
    () => getPortfolioMetricsForRole(personId, "PM", clientFilter),
    ["portfolio-metrics-pm", personId, clientFilter ?? ""],
    { revalidate: 60, tags: ["portfolio-metrics"] }
  )();
}

/** Portfolio metrics for projects where the given person is Program Manager (PGM). */
export async function getCachedPortfolioMetricsForPgm(
  personId: string,
  clientFilter?: string
): Promise<PortfolioMetrics> {
  return unstable_cache(
    () => getPortfolioMetricsForRole(personId, "PGM", clientFilter),
    ["portfolio-metrics-pgm", personId, clientFilter ?? ""],
    { revalidate: 60, tags: ["portfolio-metrics"] }
  )();
}

/** Portfolio metrics for projects where the given person is Client Account Director (CAD). */
export async function getCachedPortfolioMetricsForCad(
  personId: string,
  clientFilter?: string
): Promise<PortfolioMetrics> {
  return unstable_cache(
    () => getPortfolioMetricsForRole(personId, "CAD", clientFilter),
    ["portfolio-metrics-cad", personId, clientFilter ?? ""],
    { revalidate: 60, tags: ["portfolio-metrics"] }
  )();
}

export function formatPortfolioDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
