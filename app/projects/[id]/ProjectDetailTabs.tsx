"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <div>
      <nav className="flex gap-2 border-b border-surface-200 dark:border-dark-border mb-6">
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

      {tab === "overview" && (
        <div className="space-y-4">
          <p className="text-body-sm text-surface-700 dark:text-surface-200">
            Float last updated: {floatLastUpdated ? new Date(floatLastUpdated).toLocaleString() : "Never"}
          </p>
          <p className="text-body-md text-surface-700 dark:text-surface-200">Budget summary and Float freshness. See Budget tab for details.</p>
        </div>
      )}
      {tab === "resourcing" && (
        <ResourcingGrids
          projectId={projectId}
          canEdit={canEdit}
          floatLastUpdated={floatLastUpdated}
        />
      )}
      {tab === "budget" && <BudgetTab projectId={projectId} canEdit={canEdit} />}
      {tab === "rates" && <RatesTab projectId={projectId} canEdit={canEdit} />}
      {tab === "assignments" && <AssignmentsTab projectId={projectId} canEdit={canEdit} />}
    </div>
  );
}
