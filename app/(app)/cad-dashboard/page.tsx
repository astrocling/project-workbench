import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCachedPortfolioMetricsForCad,
  formatPortfolioDollars,
} from "@/lib/portfolioMetrics";
import { getDashboardPtoWidgetProjects } from "@/lib/pgmPtoWidgetData";
import { getDashboardContext } from "@/lib/dashboardContext";
import {
  RecoveryCardContent,
  formatWeekLabelShort,
} from "@/components/RevenueRecoveryShared";
import { DashboardClientFilter } from "@/components/DashboardClientFilter";
import { DashboardProjectsTable } from "@/components/DashboardProjectsTable";
import PgmPtoWidget from "@/components/PgmPtoWidget";
import AbsencePills from "@/components/AbsencePills";

const DASHBOARD_SORT_KEYS = [
  "name",
  "clientName",
  "burnPercent",
  "bufferPercent",
  "recoveryThisWeekPercent",
  "recovery4WeekPercent",
  "requestOpen",
  "actualsStatus",
  "ragOverall",
] as const;
type DashboardSortKey = (typeof DASHBOARD_SORT_KEYS)[number];

function normalizeSort(raw: string | undefined): DashboardSortKey {
  if (raw && DASHBOARD_SORT_KEYS.includes(raw as DashboardSortKey)) return raw as DashboardSortKey;
  return "clientName";
}

function normalizeDir(raw: string | undefined): "asc" | "desc" {
  if (raw === "asc" || raw === "desc") return raw;
  return "asc";
}

const emptyMetrics = {
  totalActive: 0,
  activeCda: 0,
  activeNonCda: 0,
  portfolioValue: 0,
  clientsInScope: [] as string[],
  revenueRecovery: null,
  projectTableRows: [] as Array<{
    id: string;
    name: string;
    slug: string;
    clientName: string;
    cdaEnabled: boolean;
    burnPercent: number | null;
    bufferPercent: number | null;
    recoveryThisWeekPercent: number | null;
    recovery4WeekPercent: number | null;
    actualsStatus: "up-to-date" | "1-week-behind" | "more-than-1-week-behind";
    ragOverall: "Red" | "Amber" | "Green" | null;
    statusReportStale?: boolean;
    recoveryToDatePercent?: number | null;
    requestOpen: boolean;
  }>,
};

export default async function CADDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; sort?: string; dir?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { personId: currentPersonId } = await getDashboardContext(session);
  const { client: clientParam, sort: sortParam, dir: dirParam } = await searchParams;
  const sortKey = normalizeSort(sortParam);
  const sortDir = normalizeDir(dirParam);

  const metricsNoFilter =
    currentPersonId != null
      ? await getCachedPortfolioMetricsForCad(currentPersonId).catch(() => emptyMetrics)
      : emptyMetrics;
  const clientsInScope = metricsNoFilter.clientsInScope ?? [];
  const validClient =
    clientParam && clientsInScope.includes(clientParam) ? clientParam : undefined;
  if (clientParam != null && clientParam !== "" && validClient == null) {
    redirect("/cad-dashboard");
  }
  const portfolioMetrics =
    currentPersonId != null && validClient
      ? await getCachedPortfolioMetricsForCad(currentPersonId, validClient).catch(
          () => metricsNoFilter
        )
      : metricsNoFilter;
  const selectedClient = validClient ?? null;

  const today = new Date();
  const ptoWidgetProjects =
    currentPersonId != null
      ? await getDashboardPtoWidgetProjects(
          currentPersonId,
          selectedClient,
          today,
          "CAD"
        ).catch(() => [])
      : [];

  return (
    <div>
      <h2 className="text-display-lg font-bold text-surface-900 dark:text-white mb-2">
        CAD Dashboard
      </h2>
      <p className="text-body-md text-surface-600 dark:text-surface-300 mb-6">
        Metrics for projects where you are CAD (Client Account Director).{" "}
        <Link
          href="/projects"
          className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
        >
          View all projects →
        </Link>
      </p>

      <DashboardClientFilter
        clientsInScope={clientsInScope}
        selectedClient={selectedClient}
        basePath="/cad-dashboard"
      />

      <section aria-label="Portfolio metrics" className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-4">
            <p className="text-label-md text-surface-500 dark:text-surface-400 uppercase tracking-wider font-semibold mb-1">
              Portfolio Value
            </p>
            <p className="text-display-md font-bold text-surface-900 dark:text-white tabular-nums">
              ${formatPortfolioDollars(portfolioMetrics.portfolioValue)}
            </p>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-4">
            <p className="text-label-md text-surface-500 dark:text-surface-400 uppercase tracking-wider font-semibold mb-1">
              Total Active Projects
            </p>
            <p className="text-display-md font-bold text-surface-900 dark:text-white tabular-nums">
              {portfolioMetrics.totalActive}
            </p>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-4">
            <p className="text-label-md text-surface-500 dark:text-surface-400 uppercase tracking-wider font-semibold mb-1">
              Active CDA&apos;s
            </p>
            <p className="text-display-md font-bold text-jblue-600 dark:text-jblue-400 tabular-nums">
              {portfolioMetrics.activeCda}
            </p>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-4">
            <p className="text-label-md text-surface-500 dark:text-surface-400 uppercase tracking-wider font-semibold mb-1">
              Active Non-CDA
            </p>
            <p className="text-display-md font-bold text-surface-900 dark:text-white tabular-nums">
              {portfolioMetrics.activeNonCda}
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Your projects" className="mt-8">
        <div className="w-full border-b border-surface-200 dark:border-dark-border pb-2 mb-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100">
              Projects
            </h3>
            <AbsencePills projects={ptoWidgetProjects} today={today} />
          </div>
        </div>
        <DashboardProjectsTable
          rows={portfolioMetrics.projectTableRows ?? []}
          basePath="/cad-dashboard"
          clientParam={validClient}
          emptyMessage="No active projects where you are CAD."
          sortKey={sortKey}
          sortDir={sortDir}
        />
      </section>

      {portfolioMetrics.revenueRecovery != null ? (
        <section aria-label="Portfolio revenue recovery" className="mt-8">
          {portfolioMetrics.staleActuals && (
            <p className="text-body-sm text-surface-600 dark:text-surface-400 mb-3 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ring-2 shadow-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-amber-400 dark:ring-amber-500"
                title="One or more of your projects has completed weeks with planned hours but no actuals entered. Update hours in the Resourcing tab for each project."
              >
                Actuals Stale
              </span>
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
              <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">
                Portfolio revenue recovery
              </p>
              <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2 flex-wrap">
                To date
              </p>
              <RecoveryCardContent data={portfolioMetrics.revenueRecovery.toDate} />
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
              <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">
                Portfolio revenue recovery
              </p>
              <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2 flex-wrap">
                This week {formatWeekLabelShort(portfolioMetrics.revenueRecovery.thisWeek.weekStartDate)}
              </p>
              <RecoveryCardContent data={portfolioMetrics.revenueRecovery.thisWeek} />
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
              <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">
                Portfolio revenue recovery
              </p>
              <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2 flex-wrap">
                Previous 4 weeks
              </p>
              <RecoveryCardContent data={portfolioMetrics.revenueRecovery.prevFourWeeks} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <PgmPtoWidget projects={ptoWidgetProjects} today={today} />
            </div>
          </div>
        </section>
      ) : (
        <section aria-label="Upcoming PTO and holidays" className="mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <PgmPtoWidget projects={ptoWidgetProjects} today={today} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
