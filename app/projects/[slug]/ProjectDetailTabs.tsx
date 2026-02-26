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
  { id: "edit", label: "Settings", hrefOnly: true },
] as const;

export function ProjectDetailTabs({
  projectId,
  projectSlug,
  tab,
  canEdit,
  floatLastUpdated,
}: {
  projectId: string;
  projectSlug: string;
  tab: string;
  canEdit: boolean;
  floatLastUpdated: Date | null;
}) {
  const pathname = usePathname();
  const base = pathname;

  const [budgetStatus, setBudgetStatus] = useState<{
    lastWeekWithActuals: string | null;
    missingActuals: boolean;
    rollups: Record<string, unknown> | null;
  } | null>(null);

  const [revenueRecoveryToDate, setRevenueRecoveryToDate] = useState<number | null>(null);

  const [teamMembers, setTeamMembers] = useState<
    Array<{
      personId: string;
      person: { name: string };
      role: { name: string };
    }>
  >([]);

  const [projectNotes, setProjectNotes] = useState<string | null>(null);
  const [projectNotesDirty, setProjectNotesDirty] = useState(false);
  const [projectNotesSaving, setProjectNotesSaving] = useState(false);
  const [sowLink, setSowLink] = useState<string | null>(null);
  const [estimateLink, setEstimateLink] = useState<string | null>(null);
  const [floatLink, setFloatLink] = useState<string | null>(null);
  const [metricLink, setMetricLink] = useState<string | null>(null);
  const [keyRoleNames, setKeyRoleNames] = useState<{
    pm: string[];
    pgm: string | null;
    ad: string | null;
  }>({ pm: [], pgm: null, ad: null });

  const refetchBudgetStatus = useCallback(() => {
    fetch(`/api/projects/${projectId}/budget`)
      .then((r) => r.json())
      .then((d) => {
        setBudgetStatus({
          lastWeekWithActuals: d.lastWeekWithActuals ?? null,
          missingActuals: d.rollups?.missingActuals ?? false,
          rollups: d.rollups ?? null,
        });
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (tab !== "overview") {
      setRevenueRecoveryToDate(null);
      setTeamMembers([]);
      setProjectNotes(null);
      setProjectNotesDirty(false);
      setSowLink(null);
      setEstimateLink(null);
      setFloatLink(null);
      setMetricLink(null);
      setKeyRoleNames({ pm: [], pgm: null, ad: null });
      return;
    }
    fetch(`/api/projects/${projectId}/revenue-recovery`)
      .then((r) => r.json())
      .then((d) => setRevenueRecoveryToDate(d.toDate?.recoveryPercent ?? null))
      .catch(() => setRevenueRecoveryToDate(null));
    fetch(`/api/projects/${projectId}/assignments`)
      .then((r) => r.json())
      .then((a) => setTeamMembers(Array.isArray(a) ? a : []))
      .catch(() => setTeamMembers([]));
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((p) => {
        setProjectNotes(p.notes ?? null);
        setSowLink(p.sowLink ?? null);
        setEstimateLink(p.estimateLink ?? null);
        setFloatLink(p.floatLink ?? null);
        setMetricLink(p.metricLink ?? null);
        setProjectNotesDirty(false);
        const keyRoles = p.projectKeyRoles ?? [];
        const pm = keyRoles
          .filter((kr: { type: string }) => kr.type === "PM")
          .map((kr: { person?: { name?: string } }) => kr.person?.name)
          .filter(Boolean);
        const pgm = keyRoles.find((kr: { type: string }) => kr.type === "PGM")?.person?.name ?? null;
        const ad = keyRoles.find((kr: { type: string }) => kr.type === "CAD")?.person?.name ?? null;
        setKeyRoleNames({ pm, pgm, ad });
      })
      .catch(() => {
        setProjectNotes(null);
        setSowLink(null);
        setEstimateLink(null);
        setFloatLink(null);
        setMetricLink(null);
        setKeyRoleNames({ pm: [], pgm: null, ad: null });
      });
  }, [tab, projectId]);

  const saveProjectNotes = useCallback(() => {
    if (!projectNotesDirty || projectNotesSaving) return;
    setProjectNotesSaving(true);
    fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: projectNotes ?? "" }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((p) => {
        setProjectNotes(p.notes ?? null);
        setProjectNotesDirty(false);
      })
      .finally(() => setProjectNotesSaving(false));
  }, [projectId, projectNotes, projectNotesDirty, projectNotesSaving]);

  useEffect(() => {
    refetchBudgetStatus();
  }, [projectId, refetchBudgetStatus]);

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
          {TABS.filter((t) => t.id !== "edit" || canEdit).map((t) => {
            const href = "hrefOnly" in t && t.hrefOnly ? `/projects/${projectSlug}/edit` : `${base}?tab=${t.id}`;
            const isActive = "hrefOnly" in t && t.hrefOnly ? false : tab === t.id;
            return (
              <Link
                key={t.id}
                href={href}
                className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
                  isActive
                    ? "border-jblue-500 text-jblue-600 dark:text-jblue-400 font-semibold"
                    : "border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-raised rounded-t-md"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="text-body-sm text-surface-700 dark:text-surface-200 space-y-1">
          <p className="flex items-center gap-3 flex-wrap">
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
          </p>
          <p className="flex items-center gap-3 flex-wrap">
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
        </div>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-surface-700 dark:text-surface-200">
            <span>
              <span className="font-semibold text-surface-800 dark:text-surface-100">PM:</span>{" "}
              {keyRoleNames.pm.length > 0 ? keyRoleNames.pm.join(", ") : "—"}
            </span>
            <span>
              <span className="font-semibold text-surface-800 dark:text-surface-100">PGM:</span>{" "}
              {keyRoleNames.pgm ?? "—"}
            </span>
            <span>
              <span className="font-semibold text-surface-800 dark:text-surface-100">AD:</span>{" "}
              {keyRoleNames.ad ?? "—"}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {sowLink ? (
              <a
                href={sowLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Open SOW
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-surface-200 dark:bg-dark-raised text-surface-500 dark:text-surface-400 font-semibold text-body-sm cursor-not-allowed select-none"
                aria-disabled="true"
              >
                Open SOW
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            )}
            {estimateLink ? (
              <a
                href={estimateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Open Estimate
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-surface-200 dark:bg-dark-raised text-surface-500 dark:text-surface-400 font-semibold text-body-sm cursor-not-allowed select-none"
                aria-disabled="true"
              >
                Open Estimate
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            )}
            {floatLink ? (
              <a
                href={floatLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Open Float
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-surface-200 dark:bg-dark-raised text-surface-500 dark:text-surface-400 font-semibold text-body-sm cursor-not-allowed select-none"
                aria-disabled="true"
              >
                Open Float
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            )}
            {metricLink ? (
              <a
                href={metricLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Open Metric
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-surface-200 dark:bg-dark-raised text-surface-500 dark:text-surface-400 font-semibold text-body-sm cursor-not-allowed select-none"
                aria-disabled="true"
              >
                Open Metric
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 border-t-2 border-t-jblue-500">
              <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider">
                Overall budget burn
              </p>
              <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                {budgetStatus?.rollups != null &&
                (budgetStatus.rollups.burnPercentHighHours as number) != null
                  ? `${Number(budgetStatus.rollups.burnPercentHighHours).toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            {(() => {
              const rollups = budgetStatus?.rollups;
              const remainingHoursHigh = Number(rollups?.remainingHoursHigh) ?? 0;
              const actualHoursToDate = Number(rollups?.actualHoursToDate) ?? 0;
              const totalBudgetHours = remainingHoursHigh + actualHoursToDate;
              const remainingAfterProjected =
                Number(rollups?.remainingAfterProjectedBurnHoursHigh) ?? 0;
              const bufferPercent =
                totalBudgetHours > 0
                  ? (remainingAfterProjected / totalBudgetHours) * 100
                  : null;
              const isLowBuffer =
                bufferPercent != null &&
                (bufferPercent < 5 || bufferPercent < 0);
              return (
                <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5">
                  <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider">
                    Buffer %
                  </p>
                  <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                    {bufferPercent != null ? `${bufferPercent.toFixed(1)}%` : "—"}
                  </p>
                  {isLowBuffer && (
                    <p className="text-body-sm font-semibold text-amber-600 dark:text-amber-400 mt-2">
                      {bufferPercent != null && bufferPercent < 0
                        ? "Over budget"
                        : "Low buffer"}
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5">
              <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider">
                Revenue recovery to date
              </p>
              <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                {revenueRecoveryToDate != null
                  ? `${revenueRecoveryToDate.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="space-y-3">
              <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
                Team members
              </h2>
              <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-hidden">
                {teamMembers.length === 0 ? (
                  <p className="p-4 text-body-sm text-surface-500 dark:text-surface-400">
                    No team members assigned. Add people on the Assignments tab.
                  </p>
                ) : (
                  <ul className="divide-y divide-surface-100 dark:divide-dark-border">
                    {teamMembers.map((a) => (
                      <li
                        key={a.personId}
                        className="px-4 py-3 flex items-center justify-between gap-4 text-body-sm text-surface-700 dark:text-surface-200"
                      >
                        <span className="font-medium text-surface-800 dark:text-surface-100">
                          {a.person.name}
                        </span>
                        <span className="text-surface-500 dark:text-surface-400">
                          {a.role.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            <section className="space-y-3">
              <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
                Project notes
              </h2>
              <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-hidden">
                {canEdit ? (
                  <div className="p-4">
                    <textarea
                      value={projectNotes ?? ""}
                      onChange={(e) => {
                        setProjectNotes(e.target.value);
                        setProjectNotesDirty(true);
                      }}
                      onBlur={saveProjectNotes}
                      placeholder="Add project notes…"
                      rows={10}
                      className="w-full text-body-sm text-surface-800 dark:text-surface-100 bg-transparent border-0 resize-y focus:ring-0 focus:outline-none placeholder:text-surface-400 dark:placeholder:text-surface-500 min-h-[200px]"
                    />
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-100 dark:border-dark-border">
                      {projectNotesDirty && (
                        <span className="text-body-sm text-surface-500 dark:text-surface-400">
                          Unsaved changes
                        </span>
                      )}
                      {projectNotesSaving && (
                        <span className="text-body-sm text-surface-500 dark:text-surface-400">
                          Saving…
                        </span>
                      )}
                      {projectNotesDirty && !projectNotesSaving && (
                        <button
                          type="button"
                          onClick={saveProjectNotes}
                          className="text-body-sm font-medium text-jblue-600 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-300"
                        >
                          Save notes
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-body-sm text-surface-700 dark:text-surface-200 whitespace-pre-wrap min-h-[200px]">
                      {projectNotes?.trim() || "No notes."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
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
