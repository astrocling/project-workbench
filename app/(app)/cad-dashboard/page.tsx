import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCachedPortfolioMetricsForCad,
  formatPortfolioDollars,
} from "@/lib/portfolioMetrics";
import { getDashboardContext } from "@/lib/dashboardContext";
import {
  RecoveryCardContent,
  formatWeekLabelShort,
  getRecoveryColorClass,
  getBurnHealthClass,
  getBufferHealthClass,
} from "@/components/RevenueRecoveryShared";
import { DashboardClientFilter } from "@/components/DashboardClientFilter";

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
    recovery4WeekPercent: number | null;
    actualsStatus: "up-to-date" | "1-week-behind" | "more-than-1-week-behind";
    recoveryToDatePercent?: number | null;
  }>,
};

export default async function CADDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { personId: currentPersonId } = await getDashboardContext(session);
  const { client: clientParam } = await searchParams;

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
        <h3 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2 mb-4">
          Projects
        </h3>
        {!portfolioMetrics.projectTableRows?.length ? (
          <p className="text-body-sm text-surface-500 dark:text-surface-400">
            No active projects where you are CAD.
          </p>
        ) : (
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
            <table className="w-full text-body-sm border-collapse">
              <thead>
                <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                  <th className="text-left px-4 py-2.5 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                    Project
                  </th>
                  <th className="text-left px-4 py-2.5 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                    Client
                  </th>
                  <th className="text-right px-4 py-2.5 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                    Budget burn
                  </th>
                  <th className="text-right px-4 py-2.5 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                    Buffer
                  </th>
                  <th className="text-right px-4 py-2.5 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                    4-wk recovery
                  </th>
                  <th className="text-center px-4 py-2.5 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                    Actuals
                  </th>
                </tr>
              </thead>
              <tbody>
                {portfolioMetrics.projectTableRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-surface-50/50 dark:hover:bg-dark-raised/50"
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/projects/${row.slug}`}
                          className="font-medium text-jblue-600 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-300"
                        >
                          {row.name}
                        </Link>
                        {row.cdaEnabled && (
                          <span
                            title="CDA tab enabled"
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-jblue-100 text-jblue-700 dark:bg-jblue-900/30 dark:text-jblue-300"
                          >
                            CDA
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-surface-600 dark:text-surface-400">
                      {row.clientName}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums font-medium ${getBurnHealthClass(row.burnPercent)}`}
                    >
                      {row.burnPercent != null
                        ? `${row.burnPercent.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums font-medium ${getBufferHealthClass(row.bufferPercent)}`}
                    >
                      {row.bufferPercent != null ? (
                        <>
                          {row.bufferPercent.toFixed(1)}%
                          {row.bufferPercent < 0 && (
                            <span className="text-label-sm ml-1">(Over)</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums font-medium ${getRecoveryColorClass(row.recovery4WeekPercent)}`}
                    >
                      {row.recovery4WeekPercent != null
                        ? `${row.recovery4WeekPercent.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <ActualsStatusLight status={row.actualsStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {portfolioMetrics.revenueRecovery != null && (
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
          </div>
        </section>
      )}
    </div>
  );
}

function ActualsStatusLight({
  status,
}: {
  status: "up-to-date" | "1-week-behind" | "more-than-1-week-behind";
}) {
  const config = {
    "up-to-date": {
      label: "Up to date",
      className:
        "bg-green-500 dark:bg-green-400 ring-2 ring-green-400/50 dark:ring-green-500/50",
    },
    "1-week-behind": {
      label: "1 week behind",
      className:
        "bg-amber-500 dark:bg-amber-400 ring-2 ring-amber-400/50 dark:ring-amber-500/50",
    },
    "more-than-1-week-behind": {
      label: "More than 1 week behind",
      className:
        "bg-jred-500 dark:bg-jred-400 ring-2 ring-jred-400/50 dark:ring-jred-500/50",
    },
  };
  const { label, className } = config[status];
  return (
    <span
      title={label}
      className={`inline-block w-3 h-3 rounded-full ${className}`}
      aria-label={label}
    />
  );
}
