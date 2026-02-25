"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AtRiskProject = {
  id: string;
  slug: string;
  name: string;
  clientName: string;
  status: string;
  keyRoles: { pms: string[]; pgm: string | null; cad: string | null };
  risks: string[];
};

export function AtRiskTable() {
  const [projects, setProjects] = useState<AtRiskProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects/at-risk")
      .then((r) => r.json())
      .then((data: AtRiskProject[]) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="p-8 text-center text-body-sm text-surface-700 dark:text-surface-300">
        Loading at-risk projects…
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
      <table className="w-full text-body-sm border-collapse">
        <thead>
          <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
            <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
              Name
            </th>
            <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
              Client
            </th>
            <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
              Status
            </th>
            <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
              PMs
            </th>
            <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
              PGM
            </th>
            <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
              CAD
            </th>
            <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
              Risks
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100"
            >
              <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                <Link
                  href={`/projects/${p.slug}`}
                  className="font-medium text-surface-800 dark:text-white text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200"
                >
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                {p.clientName}
              </td>
              <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                {p.status}
              </td>
              <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                {p.keyRoles.pms.join(", ") || "—"}
              </td>
              <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                {p.keyRoles.pgm ?? "—"}
              </td>
              <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                {p.keyRoles.cad ?? "—"}
              </td>
              <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                <div className="flex flex-wrap gap-1.5">
                  {p.risks.map((risk) => (
                    <span
                      key={risk}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-700"
                    >
                      {risk}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {projects.length === 0 && (
        <p className="p-8 text-center text-surface-700 dark:text-surface-300">
          No at-risk projects.
        </p>
      )}
    </div>
  );
}
