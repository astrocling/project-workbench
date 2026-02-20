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
      <nav className="flex gap-2 border-b mb-6">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`${base}?tab=${t.id}`}
            className={`px-4 py-2 -mb-px border-b-2 ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-black hover:text-black"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-4">
          <p className="text-sm text-black">
            Float last updated: {floatLastUpdated ? new Date(floatLastUpdated).toLocaleString() : "Never"}
          </p>
          <p className="text-black">Budget summary and Float freshness. See Budget tab for details.</p>
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
