import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getCachedPortfolioMetricsForPm,
  formatPortfolioDollars,
} from "@/lib/portfolioMetrics";
import {
  RecoveryCardContent,
  formatWeekLabelShort,
} from "@/components/RevenueRecoveryShared";

const emptyMetrics = {
  totalActive: 0,
  activeCda: 0,
  activeNonCda: 0,
  portfolioValue: 0,
  revenueRecovery: null,
};

export default async function PMDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let currentPersonId: string | null = null;
  if (session.user?.id) {
    const userEmail = session.user.email ?? undefined;
    let person = userEmail
      ? await prisma.person.findFirst({
          where: { email: { equals: userEmail, mode: "insensitive" } },
        })
      : null;
    if (!person && session.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true },
      });
      const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
      if (fullName) {
        person = await prisma.person.findFirst({
          where: { name: { equals: fullName, mode: "insensitive" } },
        });
      }
    }
    currentPersonId = person?.id ?? null;
  }

  const portfolioMetrics =
    currentPersonId != null
      ? await getCachedPortfolioMetricsForPm(currentPersonId).catch(() => emptyMetrics)
      : emptyMetrics;

  return (
    <div>
      <h2 className="text-display-lg font-bold text-surface-900 dark:text-white mb-2">
        PM Dashboard
      </h2>
      <p className="text-body-md text-surface-600 dark:text-surface-300 mb-6">
        Metrics for projects you manage as PM.{" "}
        <Link
          href="/projects"
          className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
        >
          View all projects →
        </Link>
      </p>

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

        {portfolioMetrics.revenueRecovery != null && (
          <div className="mt-4">
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
          </div>
        )}
      </section>
    </div>
  );
}
