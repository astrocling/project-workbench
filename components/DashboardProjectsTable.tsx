"use client";

import Link from "next/link";
import {
  getRecoveryColorClass,
  getBurnHealthClass,
  getBufferHealthClass,
} from "@/components/RevenueRecoveryShared";

export type DashboardProjectRow = {
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
};

const SORT_KEYS = [
  ["name", "Project"],
  ["clientName", "Client"],
  ["burnPercent", "Budget burn"],
  ["bufferPercent", "Buffer"],
  ["recovery4WeekPercent", "4-wk recovery"],
  ["actualsStatus", "Actuals"],
] as const;

type SortKey = (typeof SORT_KEYS)[number][0];

const ACTUALS_ORDER: Record<DashboardProjectRow["actualsStatus"], number> = {
  "up-to-date": 0,
  "1-week-behind": 1,
  "more-than-1-week-behind": 2,
};

function compare(
  a: DashboardProjectRow,
  b: DashboardProjectRow,
  key: SortKey,
  dir: "asc" | "desc"
): number {
  const mult = dir === "asc" ? 1 : -1;
  switch (key) {
    case "name":
      return mult * (a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || 0);
    case "clientName":
      return mult * (a.clientName.localeCompare(b.clientName, undefined, { sensitivity: "base" }) || 0);
    case "burnPercent": {
      const va = a.burnPercent ?? -Infinity;
      const vb = b.burnPercent ?? -Infinity;
      return mult * (va - vb);
    }
    case "bufferPercent": {
      const va = a.bufferPercent ?? -Infinity;
      const vb = b.bufferPercent ?? -Infinity;
      return mult * (va - vb);
    }
    case "recovery4WeekPercent": {
      const va = a.recovery4WeekPercent ?? -Infinity;
      const vb = b.recovery4WeekPercent ?? -Infinity;
      return mult * (va - vb);
    }
    case "actualsStatus": {
      const va = ACTUALS_ORDER[a.actualsStatus];
      const vb = ACTUALS_ORDER[b.actualsStatus];
      return mult * (va - vb);
    }
    default:
      return 0;
  }
}

function ActualsStatusLight({
  status,
}: {
  status: DashboardProjectRow["actualsStatus"];
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

type DashboardProjectsTableProps = {
  rows: DashboardProjectRow[];
  basePath: string;
  clientParam: string | undefined;
  emptyMessage: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
};

export function DashboardProjectsTable({
  rows,
  basePath,
  clientParam,
  emptyMessage,
  sortKey,
  sortDir,
}: DashboardProjectsTableProps) {
  const sorted = [...rows].sort((a, b) => compare(a, b, sortKey, sortDir));

  if (sorted.length === 0) {
    return (
      <p className="text-body-sm text-surface-500 dark:text-surface-400">
        {emptyMessage}
      </p>
    );
  }

  function sortHref(key: SortKey, nextDir: "asc" | "desc") {
    const params = new URLSearchParams();
    if (clientParam) params.set("client", clientParam);
    params.set("sort", key);
    params.set("dir", nextDir);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
      <table className="w-full text-body-sm border-collapse">
        <thead>
          <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
            {SORT_KEYS.map(([key, label]) => {
              const isActive = sortKey === key;
              const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";
              const isRight = key === "burnPercent" || key === "bufferPercent" || key === "recovery4WeekPercent";
              const isCenter = key === "actualsStatus";
              return (
                <th
                  key={key}
                  className={`px-4 py-2.5 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold ${
                    isRight ? "text-right" : isCenter ? "text-center" : "text-left"
                  }`}
                >
                  <Link
                    href={sortHref(key, nextDir)}
                    className={`inline-flex items-center gap-1 hover:text-surface-700 dark:hover:text-surface-200 ${isActive ? "text-surface-900 dark:text-white" : ""}`}
                  >
                    {label}
                    {isActive && (
                      <span className="text-xs" aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
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
  );
}
