"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ResourcingGrids } from "@/components/ResourcingGrids";
import { BudgetTab } from "@/components/BudgetTab";
import { RatesTab } from "@/components/RatesTab";
import { AssignmentsTab } from "@/components/AssignmentsTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "resourcing", label: "Resourcing" },
  { id: "budget", label: "Budget" },
  { id: "rates", label: "Rates" },
  { id: "assignments", label: "Assignments" },
] as const;

export function ProjectDetailTabs({
  projectId,
  tab,
  canEdit,
  floatLastUpdated,
}: {
  projectId: string;
  tab: string;
  canEdit: boolean;
  floatLastUpdated: Date | null;
}) {
  const pathname = usePathname();
  const base = pathname;

  const [budgetStatus, setBudgetStatus] = useState<{
    lastWeekWithActuals: string | null;
    missingActuals: boolean;
  } | null>(null);

  const refetchBudgetStatus = useCallback(() => {
    fetch(`/api/projects/${projectId}/budget`)
      .then((r) => r.json())
      .then((d) => {
        setBudgetStatus({
          lastWeekWithActuals: d.lastWeekWithActuals ?? null,
          missingActuals: d.rollups?.missingActuals ?? false,
        });
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (tab !== "budget" && tab !== "resourcing" && tab !== "overview") {
      setBudgetStatus(null);
      return;
    }
    refetchBudgetStatus();
  }, [tab, projectId, refetchBudgetStatus]);

  const freshnessWarning =
    floatLastUpdated && (() => {
      const elapsed = (Date.now() - new Date(floatLastUpdated).getTime()) / (60 * 60 * 1000);
      if (elapsed > 24) return { strong: true };
      if (elapsed > 6) return { strong: false };
      return null;
    })();

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-8 -mt-6 px-8 pt-6 pb-4 mb-6 bg-surface-50 dark:bg-dark-bg border-b border-surface-200 dark:border-dark-border">
        <Link
          href="/projects"
          className="block text-label-md text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 mb-3"
        >
          ← Projects
        </Link>
        <nav className="flex gap-2 mb-3">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`${base}?tab=${t.id}`}
              className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
                tab === t.id
                  ? "border-jblue-500 text-jblue-600 dark:text-jblue-400 font-semibold"
                  : "border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-raised rounded-t-md"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {tab === "budget" && budgetStatus && (
          <p className="text-body-sm text-surface-700 dark:text-surface-200 flex items-center gap-3 flex-wrap">
            <span>
              Actuals through week of{" "}
              {budgetStatus.lastWeekWithActuals
                ? new Date(budgetStatus.lastWeekWithActuals + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </span>
            {budgetStatus.missingActuals && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ring-2 shadow-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-amber-400 dark:ring-amber-500">
                Actuals Stale
              </span>
            )}
          </p>
        )}
        {tab !== "budget" && (
          <div className="space-y-1">
            <p className="text-body-sm text-surface-700 dark:text-surface-200 flex items-center gap-3 flex-wrap">
          <span>Float last updated: {floatLastUpdated ? new Date(floatLastUpdated).toLocaleString() : "Never"}</span>
          {freshnessWarning && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ring-2 shadow-md ${
                freshnessWarning.strong
                  ? "bg-jred-100 text-jred-700 dark:bg-jred-900/30 dark:text-jred-400 ring-jred-400 dark:ring-jred-500"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-amber-400 dark:ring-amber-500"
              }`}
            >
              Float Stale
            </span>
          )}
          {tab === "resourcing" && budgetStatus?.missingActuals && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ring-2 shadow-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-amber-400 dark:ring-amber-500">
                  Actuals Stale
                </span>
              )}
            </p>
            {tab === "overview" && (
          <p className="text-body-sm text-surface-700 dark:text-surface-200 flex items-center gap-3 flex-wrap">
            <span>
              Actuals through week of{" "}
              {budgetStatus?.lastWeekWithActuals
                ? new Date(budgetStatus.lastWeekWithActuals + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </span>
            {budgetStatus?.missingActuals && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ring-2 shadow-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-amber-400 dark:ring-amber-500">
                Actuals Stale
              </span>
            )}
            </p>
            )}
          </div>
        )}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <p className="text-body-md text-surface-700 dark:text-surface-200">Budget summary and Float freshness. See Budget tab for details.</p>
        </div>
      )}
      {tab === "resourcing" && (
        <ResourcingGrids
          projectId={projectId}
          canEdit={canEdit}
          floatLastUpdated={floatLastUpdated}
          onActualsUpdated={refetchBudgetStatus}
        />
      )}
      {tab === "budget" && <BudgetTab projectId={projectId} canEdit={canEdit} />}
      {tab === "rates" && <RatesTab projectId={projectId} canEdit={canEdit} />}
      {tab === "assignments" && <AssignmentsTab projectId={projectId} canEdit={canEdit} />}
    </div>
  );
}
