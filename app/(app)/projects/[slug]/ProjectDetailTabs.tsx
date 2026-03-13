"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBufferHealthClass,
  BudgetBurnDonut,
  RevenueRecoveryPieChart,
} from "@/components/RevenueRecoveryShared";

const ResourcingGrids = dynamic(() => import("@/components/ResourcingGrids").then((m) => ({ default: m.ResourcingGrids })), {
  loading: () => <div className="min-h-[200px] flex items-center justify-center text-surface-500 dark:text-surface-400">Loading…</div>,
});
const BudgetTab = dynamic(() => import("@/components/BudgetTab").then((m) => ({ default: m.BudgetTab })), {
  loading: () => <div className="min-h-[200px] flex items-center justify-center text-surface-500 dark:text-surface-400">Loading…</div>,
});
const TimelineTab = dynamic(() => import("@/components/TimelineTab").then((m) => ({ default: m.TimelineTab })), {
  loading: () => <div className="min-h-[200px] flex items-center justify-center text-surface-500 dark:text-surface-400">Loading…</div>,
});
const StatusReportsTab = dynamic(() => import("@/components/StatusReportsTab").then((m) => ({ default: m.StatusReportsTab })), {
  loading: () => <div className="min-h-[200px] flex items-center justify-center text-surface-500 dark:text-surface-400">Loading…</div>,
});
const CDATab = dynamic(() => import("@/components/CDATab").then((m) => ({ default: m.CDATab })), {
  loading: () => <div className="min-h-[200px] flex items-center justify-center text-surface-500 dark:text-surface-400">Loading…</div>,
});
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "resourcing", label: "Resourcing" },
  { id: "cda", label: "CDA" },
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "status-reports", label: "Status Reports" },
  { id: "edit", label: "Settings", hrefOnly: true },
] as const;

const OVERVIEW_RAG_CONFIG: Record<string, { label: string; className: string }> = {
  Green: {
    label: "On Track",
    className: "bg-green-500 dark:bg-green-400 ring-2 ring-green-400/50 dark:ring-green-500/50",
  },
  Amber: {
    label: "At Risk",
    className: "bg-amber-500 dark:bg-amber-400 ring-2 ring-amber-400/50 dark:ring-amber-500/50",
  },
  Red: {
    label: "Off Track",
    className: "bg-jred-500 dark:bg-jred-400 ring-2 ring-jred-400/50 dark:ring-jred-500/50",
  },
};

type InitialProject = {
  notes: string | null;
  sowLink: string | null;
  estimateLink: string | null;
  floatLink: string | null;
  metricLink: string | null;
  useSingleRate: boolean;
  singleBillRate: number | null;
  projectKeyRoles: Array<{ type: string; person: { name: string } }>;
};
type InitialAssignment = {
  personId: string;
  person: { name: string };
  role: { name: string; id: string };
  hiddenFromGrid?: boolean;
  hasUpcomingHours?: boolean;
};

export function ProjectDetailTabs({
  projectId,
  projectSlug,
  tab,
  canEdit,
  floatLastUpdated,
  cdaEnabled = false,
  initialProject,
  initialAssignments,
  initialMissingRateRoleNames,
  initialBudgetStatus,
  initialBudgetData,
}: {
  projectId: string;
  projectSlug: string;
  tab: string;
  canEdit: boolean;
  floatLastUpdated: Date | null;
  cdaEnabled?: boolean;
  initialProject?: InitialProject;
  initialAssignments?: InitialAssignment[];
  initialMissingRateRoleNames?: string[];
  initialBudgetStatus?: {
    lastWeekWithActuals: string | null;
    missingActuals: boolean;
    rollups: Record<string, unknown> | null;
  };
  initialBudgetData?: {
    budgetLines: Array<{ id: string; type: string; label: string; lowHours: number; highHours: number; lowDollars: number; highDollars: number }>;
    rollups: unknown;
    lastWeekWithActuals: string | null;
    peopleSummary: Array<{ personName: string; roleName: string; rate: number; projectedHours: number; projectedRevenue: number; actualHours: number; actualRevenue: number }>;
  };
}) {
  const pathname = usePathname();
  const base = pathname;

  const [budgetStatus, setBudgetStatus] = useState<{
    lastWeekWithActuals: string | null;
    missingActuals: boolean;
    rollups: Record<string, unknown> | null;
  } | null>(initialBudgetStatus ?? null);

  const [revenueRecoveryToDate, setRevenueRecoveryToDate] = useState<number | null>(null);
  const [revenueRecoveryData, setRevenueRecoveryData] = useState<{
    weeks: Array<{ weekStartDate: string; forecastDollars?: number; actualDollars?: number; recoveryPercent?: number | null }>;
    monthly: Array<{
      monthKey: string;
      monthLabel: string;
      forecastDollars: number;
      actualDollars: number;
      recoveryPercent: number | null;
      overallRecoveryPercent: number | null;
    }>;
  } | null>(null);
  const [statusReports, setStatusReports] = useState<
    Array<{
      id: string;
      reportDate: string;
      ragOverall: string | null;
      variation?: string;
      updatedAt?: string;
    }>
  >([]);

  const [teamMembers, setTeamMembers] = useState<
    Array<{
      personId: string;
      person: { name: string };
      role: { name: string };
      hiddenFromGrid?: boolean;
      hasUpcomingHours?: boolean;
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

  const [overviewLoading, setOverviewLoading] = useState(true);
  const overviewPrefetched = useRef(false);

  const [missingRateRoleNames, setMissingRateRoleNames] = useState<string[] | null>(null);
  const RATES_ALERT_TABS = ["overview", "resourcing", "budget", "status-reports", "cda"] as const;

  useEffect(() => {
    if (!RATES_ALERT_TABS.includes(tab as (typeof RATES_ALERT_TABS)[number])) {
      setMissingRateRoleNames(null);
      return;
    }
    if (initialMissingRateRoleNames != null) {
      setMissingRateRoleNames(initialMissingRateRoleNames);
      return;
    }
    let cancelled = false;
    setMissingRateRoleNames(null);
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/assignments`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/rates`).then((r) => r.json()),
      fetch("/api/roles").then((r) => r.json()),
    ])
      .then(([p, a, r, rolesList]) => {
        if (cancelled) return;
        const assignments = Array.isArray(a) ? a : [];
        const rates = Array.isArray(r) ? r : [];
        const roles = Array.isArray(rolesList) ? rolesList : [];
        const rateByRole = new Map(rates.map((x: { roleId: string }) => [x.roleId, x]));
        const resourcedRoleIds = new Set(assignments.map((a: { roleId: string }) => a.roleId));
        const hasSingleRate =
          p?.useSingleRate === true && p?.singleBillRate != null;
        const missingIds = hasSingleRate
          ? []
          : [...resourcedRoleIds].filter((id) => !rateByRole.has(id));
        const names = missingIds
          .map((id) => roles.find((role: { id: string; name: string }) => role.id === id)?.name)
          .filter(Boolean) as string[];
        setMissingRateRoleNames(names);
      })
      .catch(() => {
        if (!cancelled) setMissingRateRoleNames(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, tab, initialMissingRateRoleNames]);

  const prefetchOverview = useCallback(() => {
    if (overviewPrefetched.current || tab === "overview") return;
    overviewPrefetched.current = true;
    fetch(`/api/projects/${projectId}/revenue-recovery`).catch(() => {});
    fetch(`/api/projects/${projectId}/status-reports?limit=6&page=1`).catch(() => {});
    fetch(`/api/projects/${projectId}/assignments`).catch(() => {});
    fetch(`/api/projects/${projectId}`).catch(() => {});
  }, [projectId, tab]);

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
    if (tab === "overview") overviewPrefetched.current = false;
  }, [tab]);

  useEffect(() => {
    if (tab !== "overview") {
      setOverviewLoading(false);
      setRevenueRecoveryToDate(null);
      setRevenueRecoveryData(null);
      setStatusReports([]);
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
    setOverviewLoading(true);
    if (initialProject && initialAssignments) {
      setTeamMembers(initialAssignments);
      setProjectNotes(initialProject.notes ?? null);
      setSowLink(initialProject.sowLink ?? null);
      setEstimateLink(initialProject.estimateLink ?? null);
      setFloatLink(initialProject.floatLink ?? null);
      setMetricLink(initialProject.metricLink ?? null);
      setProjectNotesDirty(false);
      const keyRoles = initialProject.projectKeyRoles ?? [];
      const pm = keyRoles
        .filter((kr) => kr.type === "PM")
        .map((kr) => kr.person?.name)
        .filter(Boolean);
      const pgm = keyRoles.find((kr) => kr.type === "PGM")?.person?.name ?? null;
      const ad = keyRoles.find((kr) => kr.type === "CAD")?.person?.name ?? null;
      setKeyRoleNames({ pm, pgm, ad });
      Promise.all([
        fetch(`/api/projects/${projectId}/revenue-recovery`).then((r) => r.json()),
        fetch(`/api/projects/${projectId}/status-reports?limit=6&page=1`).then((r) => r.json()),
      ])
        .then(([revenue, reportsPayload]) => {
          setRevenueRecoveryToDate(revenue?.toDate?.recoveryPercent ?? null);
          setRevenueRecoveryData(
            revenue?.monthly != null && revenue?.weeks != null
              ? { weeks: revenue.weeks, monthly: revenue.monthly }
              : null
          );
          const list = reportsPayload?.reports ?? (Array.isArray(reportsPayload) ? reportsPayload : []);
          setStatusReports(
            list.slice(0, 6).map((r: { id: string; reportDate: string; ragOverall: string | null; variation?: string; updatedAt?: string }) => ({
              id: r.id,
              reportDate: r.reportDate,
              ragOverall: r.ragOverall ?? null,
              variation: r.variation,
              updatedAt: r.updatedAt,
            }))
          );
        })
        .catch(() => {})
        .finally(() => setOverviewLoading(false));
      return;
    }
    Promise.allSettled([
      fetch(`/api/projects/${projectId}/revenue-recovery`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/status-reports?limit=6&page=1`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/assignments`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
    ]).then(([revenueRes, reportsRes, assignmentsRes, projectRes]) => {
      const revenue = revenueRes.status === "fulfilled" ? revenueRes.value : null;
      const reportsPayload = reportsRes.status === "fulfilled" ? reportsRes.value : null;
      const assignments = assignmentsRes.status === "fulfilled" ? assignmentsRes.value : [];
      const p = projectRes.status === "fulfilled" ? projectRes.value : null;
      setRevenueRecoveryToDate(revenue?.toDate?.recoveryPercent ?? null);
      setRevenueRecoveryData(
        revenue?.monthly != null && revenue?.weeks != null
          ? { weeks: revenue.weeks, monthly: revenue.monthly }
          : null
      );
      const list = reportsPayload?.reports ?? (Array.isArray(reportsPayload) ? reportsPayload : []);
      setStatusReports(
        list.slice(0, 6).map((r: { id: string; reportDate: string; ragOverall: string | null; variation?: string; updatedAt?: string }) => ({
          id: r.id,
          reportDate: r.reportDate,
          ragOverall: r.ragOverall ?? null,
          variation: r.variation,
          updatedAt: r.updatedAt,
        }))
      );
      setTeamMembers(Array.isArray(assignments) ? assignments : []);
      if (p) {
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
      } else {
        setProjectNotes(null);
        setSowLink(null);
        setEstimateLink(null);
        setFloatLink(null);
        setMetricLink(null);
        setKeyRoleNames({ pm: [], pgm: null, ad: null });
      }
      setOverviewLoading(false);
    });
  }, [tab, projectId, initialProject, initialAssignments]);

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
    if (initialBudgetStatus == null) refetchBudgetStatus();
  }, [projectId, refetchBudgetStatus, initialBudgetStatus]);

  const freshnessWarning =
    floatLastUpdated && (() => {
      const elapsed = (Date.now() - new Date(floatLastUpdated).getTime()) / (60 * 60 * 1000);
      if (elapsed > 24) return { strong: true };
      if (elapsed > 6) return { strong: false };
      return null;
    })();

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-8 -mt-6 px-8 pt-6 pb-4 mb-6 bg-surface-50 dark:bg-dark-bg border-b border-surface-200 dark:border-dark-border">
        <nav className="flex gap-2 mb-3">
          {TABS.filter((t) => (t.id !== "edit" || canEdit) && (t.id !== "cda" || cdaEnabled)).map((t) => {
            const href = "hrefOnly" in t && t.hrefOnly ? `/projects/${projectSlug}/edit` : `${base}?tab=${t.id}`;
            const isActive = "hrefOnly" in t && t.hrefOnly ? false : tab === t.id;
            const isOverview = t.id === "overview";
            return (
              <Link
                key={t.id}
                href={href}
                onMouseEnter={isOverview ? prefetchOverview : undefined}
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
          {tab !== "status-reports" && (
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
          )}
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

      {RATES_ALERT_TABS.includes(tab as (typeof RATES_ALERT_TABS)[number]) &&
        missingRateRoleNames &&
        missingRateRoleNames.length > 0 && (
          <div
            className="rounded-md border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 text-body-sm text-amber-800 dark:text-amber-400 mb-6"
            role="alert"
          >
            <p className="font-medium">
              Roles on this project without a bill rate
            </p>
            <p className="mt-1">
              The following roles are assigned on this project but have no rate
              set: <strong>{missingRateRoleNames.join(", ")}</strong>.{" "}
              <Link
                href={`/projects/${projectSlug}/edit`}
                className="text-amber-700 dark:text-amber-300 font-semibold underline hover:no-underline"
              >
                Add rates in Project Settings
              </Link>
              .
            </p>
          </div>
        )}

      {tab === "overview" &&
        !overviewLoading &&
        (() => {
          const hiddenWithUpcoming = teamMembers.filter(
            (a) => a.hiddenFromGrid && a.hasUpcomingHours
          );
          return (
            hiddenWithUpcoming.length > 0 && (
              <div
                className="rounded-md border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 text-body-sm text-amber-800 dark:text-amber-400 mb-6"
                role="alert"
              >
                <p className="font-medium">
                  Hidden from resourcing grid but have future allocations
                </p>
                <p className="mt-1">
                  The following people are hidden from the resourcing grid but
                  have hours in upcoming weeks:{" "}
                  <strong>
                    {hiddenWithUpcoming.map((a) => a.person.name).join(", ")}
                  </strong>
                  .{" "}
                  <Link
                    href={`/projects/${projectSlug}/edit`}
                    className="text-amber-700 dark:text-amber-300 font-semibold underline hover:no-underline"
                  >
                    Manage in Settings → Assignments
                  </Link>
                  .
                </p>
              </div>
            )
          );
        })()}

      {tab === "overview" && overviewLoading && (
        <div className="space-y-6" aria-busy="true" aria-label="Loading overview">
          <div className="flex flex-wrap gap-3">
            <div className="h-4 w-24 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
            <div className="h-4 w-20 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
            <div className="h-4 w-16 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
          </div>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-28 bg-surface-200 dark:bg-dark-raised rounded-md animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border p-5">
                <div className="h-4 w-32 bg-surface-200 dark:bg-dark-raised rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="h-5 w-32 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
              <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border p-4 h-48">
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-4 bg-surface-100 dark:bg-dark-raised rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-5 w-28 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
              <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border p-4 h-48">
                <div className="h-full min-h-[200px] bg-surface-100 dark:bg-dark-raised rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === "overview" && !overviewLoading && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark px-4 py-3">
            <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider mb-2">
              Key roles
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-body-sm text-surface-700 dark:text-surface-200">
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
          </div>
          <div className="flex flex-wrap gap-3">
            {sowLink ? (
              <a
                href={sowLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Open SOW
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-surface-200 dark:bg-dark-raised text-surface-500 dark:text-surface-400 font-semibold text-body-sm cursor-not-allowed select-none"
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
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Open Estimate
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-surface-200 dark:bg-dark-raised text-surface-500 dark:text-surface-400 font-semibold text-body-sm cursor-not-allowed select-none"
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
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Open Float
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-surface-200 dark:bg-dark-raised text-surface-500 dark:text-surface-400 font-semibold text-body-sm cursor-not-allowed select-none"
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
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Open Metric
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-surface-200 dark:bg-dark-raised text-surface-500 dark:text-surface-400 font-semibold text-body-sm cursor-not-allowed select-none"
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
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 border-t-2 border-t-jblue-500 flex flex-col items-center">
              <BudgetBurnDonut
                burnPercent={
                  budgetStatus?.rollups != null &&
                  (budgetStatus.rollups.burnPercentHighHours as number) != null
                    ? Number(budgetStatus.rollups.burnPercentHighHours)
                    : null
                }
                size={120}
                label="Overall budget burn"
              />
              {budgetStatus?.rollups != null && (budgetStatus.rollups.actualsStatus as string) != null && (
                <p className="text-body-sm text-surface-500 dark:text-surface-400 mt-1 text-center">
                  Actuals:{" "}
                  {(budgetStatus.rollups.actualsStatus as string) === "up-to-date"
                    ? "Up to date"
                    : (budgetStatus.rollups.actualsStatus as string) === "1-week-behind"
                      ? "1 week behind"
                      : "More than 1 week behind"}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 flex flex-col items-center">
              <RevenueRecoveryPieChart recoveryPercent={revenueRecoveryToDate} label="Revenue recovery to date" />
            </div>
            {(() => {
              const weeks = revenueRecoveryData?.weeks ?? [];
              const prevFour = weeks.reduce(
                (acc, w) => {
                  const r = w as { forecastDollars?: number; actualDollars?: number };
                  return {
                    f: acc.f + (r.forecastDollars ?? 0),
                    a: acc.a + (r.actualDollars ?? 0),
                  };
                },
                { f: 0, a: 0 }
              );
              const fourWeekRecovery =
                prevFour.f > 0 ? (prevFour.a / prevFour.f) * 100 : null;
              return (
                <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 flex flex-col items-center">
                  <RevenueRecoveryPieChart recoveryPercent={fourWeekRecovery} label="4-week revenue recovery" />
                </div>
              );
            })()}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                (bufferPercent < 7 || bufferPercent < 0);
              return (
                <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5">
                  <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider">
                    Buffer %
                  </p>
                  <p className={`text-display-md font-extrabold tabular-nums mt-1 ${getBufferHealthClass(bufferPercent)}`}>
                    {bufferPercent != null ? `${bufferPercent.toFixed(1)}%` : "—"}
                  </p>
                  {isLowBuffer && (
                    <p className={`text-body-sm font-semibold mt-2 ${bufferPercent != null && bufferPercent < 0 ? "text-jred-600 dark:text-jred-400" : "text-orange-600 dark:text-orange-400"}`}>
                      {bufferPercent != null && bufferPercent < 0
                        ? "Over budget"
                        : "Low buffer"}
                    </p>
                  )}
                </div>
              );
            })()}
            {(() => {
              const latest = statusReports[0];
              const reportDate = latest?.reportDate
                ? new Date(latest.reportDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null;
              const twoWeeksAgo = new Date();
              twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
              const isStale =
                latest?.reportDate != null && new Date(latest.reportDate) < twoWeeksAgo;
              const rag = latest?.ragOverall ?? null;
              return (
                <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5">
                  <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider">
                    Latest status report
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {rag != null && OVERVIEW_RAG_CONFIG[rag] ? (
                      <span
                        title={`Status: ${OVERVIEW_RAG_CONFIG[rag].label}`}
                        className={`inline-block w-4 h-4 rounded-full flex-shrink-0 ${OVERVIEW_RAG_CONFIG[rag].className}`}
                        aria-label={`Status: ${OVERVIEW_RAG_CONFIG[rag].label}`}
                      />
                    ) : (
                      <span
                        title="No status report"
                        className="inline-block w-4 h-4 rounded-full flex-shrink-0 bg-surface-300 dark:bg-dark-muted"
                        aria-label="No status report"
                      />
                    )}
                    <span className="text-display-sm font-semibold text-surface-900 dark:text-white">
                      {rag != null ? OVERVIEW_RAG_CONFIG[rag]?.label ?? rag : "No report"}
                    </span>
                    {reportDate != null && (
                      <span className="text-body-sm text-surface-500 dark:text-surface-400">
                        {reportDate}
                        {isStale && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400" title="Report older than 2 weeks">
                            (stale)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {statusReports.length > 0 ? (
                    <Link
                      href={`/projects/${projectSlug}/status-reports`}
                      className="text-body-sm font-medium text-jblue-600 dark:text-jblue-400 hover:underline mt-2 inline-block"
                    >
                      View all status reports →
                    </Link>
                  ) : (
                    <Link
                      href={`/projects/${projectSlug}/status-reports`}
                      className="text-body-sm font-medium text-jblue-600 dark:text-jblue-400 hover:underline mt-2 inline-block"
                    >
                      Create your first report →
                    </Link>
                  )}
                </div>
              );
            })()}
          </div>
          {statusReports.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
                Status report history
              </h2>
              <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <p className="text-body-sm text-surface-500 dark:text-surface-400">
                    Green = On Track · Amber = At Risk · Red = Off Track
                  </p>
                  <Link
                    href={`/projects/${projectSlug}/status-reports`}
                    className="text-body-sm font-medium text-jblue-600 dark:text-jblue-400 hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Status reports in chronological order, newest first"
                >
                  {statusReports.map((r, i) => {
                    const date = new Date(r.reportDate);
                    const dateShort = date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                    const dateFull = date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const ragConfig = r.ragOverall ? OVERVIEW_RAG_CONFIG[r.ragOverall] : undefined;
                    const ragLabel = ragConfig?.label ?? (r.ragOverall ?? "No status");
                    const toneClasses =
                      r.ragOverall === "Green"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/40"
                        : r.ragOverall === "Amber"
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/40"
                          : r.ragOverall === "Red"
                            ? "bg-red-50 dark:bg-red-900/25 border-jred-200 dark:border-jred-500/40"
                            : "bg-surface-50 dark:bg-dark-raised border-surface-200 dark:border-dark-border";
                    return (
                      <Link
                        key={r.id}
                        href={`/projects/${projectSlug}/status-reports/${r.id}/view`}
                        className={`group relative flex flex-col justify-center min-w-[120px] max-w-[180px] px-3 py-2 rounded-md border text-left transition-colors ${toneClasses}`}
                        aria-label={`View status report for ${dateFull}, ${ragLabel}`}
                        title={`${dateFull}: ${ragLabel}${r.variation ? ` · ${r.variation}` : ""}`}
                      >
                        <div className="flex items-center gap-1">
                          {ragConfig ? (
                            <span
                              className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${ragConfig.className}`}
                              aria-hidden
                            />
                          ) : (
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 bg-surface-300 dark:bg-dark-muted"
                              aria-hidden
                            />
                          )}
                          <span
                            className={`text-body-sm font-medium text-surface-800 dark:text-surface-100 truncate ${
                              i === 0 ? "font-semibold" : ""
                            }`}
                          >
                            {dateShort}
                          </span>
                        </div>
                        <span className="mt-0.5 text-[0.75rem] text-surface-500 dark:text-surface-400 truncate">
                          {ragLabel}
                          {r.variation ? ` · ${r.variation}` : ""}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
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
                        className="px-4 py-3 flex flex-col gap-0.5 text-body-sm text-surface-700 dark:text-surface-200"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-surface-800 dark:text-surface-100">
                            {a.person.name}
                          </span>
                          <span className="text-surface-500 dark:text-surface-400">
                            {a.role.name}
                          </span>
                        </div>
                        {a.hiddenFromGrid && a.hasUpcomingHours && (
                          <span className="text-body-sm text-amber-600 dark:text-amber-400 font-medium">
                            Hidden from grid · Has upcoming hours
                          </span>
                        )}
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
      {tab === "budget" && <BudgetTab projectId={projectId} canEdit={canEdit} initialBudgetData={initialBudgetData} />}
      {tab === "timeline" && <TimelineTab projectId={projectId} canEdit={canEdit} />}
      {tab === "status-reports" && <StatusReportsTab projectId={projectId} projectSlug={projectSlug} canEdit={canEdit} cdaEnabled={cdaEnabled} initialBudgetData={initialBudgetData} />}
      {tab === "cda" && cdaEnabled && <CDATab projectId={projectId} canEdit={canEdit} initialBudgetData={initialBudgetData} />}
    </div>
  );
}
