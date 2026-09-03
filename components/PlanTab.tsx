"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { LocalTime } from "@/components/LocalTime";
import { PlanGridGantt } from "@/components/plan/PlanGridGantt";
import { expandYmdRange } from "@/lib/plan/businessDays";
import type { PlanJson } from "@/lib/plan/serialize";

const INPUT_CLASS =
  "mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100";

type PlanResponse = {
  plan: PlanJson | null;
  project: { startDate: string; endDate: string | null };
  dateMismatch?: boolean;
};

function planDurationDays(kickoff: string, end: string): number {
  return expandYmdRange(kickoff, end).length;
}

const REPORT_DEFAULT_BTN =
  "px-2.5 py-1 text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";
const REPORT_DEFAULT_BTN_PRESSED =
  "bg-surface-800 text-white dark:bg-surface-200 dark:text-surface-900";
const REPORT_DEFAULT_BTN_IDLE =
  "bg-white text-surface-700 hover:bg-surface-100 dark:bg-dark-surface dark:text-surface-300 dark:hover:bg-dark-raised";

export function PlanTab({
  projectId,
  projectSlug,
  planReportDefault,
  canEdit,
}: {
  projectId: string;
  projectSlug: string;
  planReportDefault: "timeline" | "plan";
  canEdit: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [kickoffDate, setKickoffDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  const [assumptionsText, setAssumptionsText] = useState("");
  const [assumptionsSaving, setAssumptionsSaving] = useState(false);
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [pendingReportDefault, setPendingReportDefault] = useState<"timeline" | "plan" | null>(
    null
  );

  const apiBase = `/api/projects/${projectId}/plan`;
  const displayReportDefault = pendingReportDefault ?? planReportDefault;

  useEffect(() => {
    setPendingReportDefault(null);
  }, [planReportDefault]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(apiBase)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load plan");
        return r.json() as Promise<PlanResponse>;
      })
      .then((json) => {
        setData(json);
        if (json.plan) {
          setKickoffDate(json.plan.kickoffDate);
          setEndDate(json.plan.endDate);
          setAssumptionsText(json.plan.assumptions.join("\n"));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateBlank() {
    if (!canEdit) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to create plan");
        return;
      }
      load();
    } finally {
      setCreating(false);
    }
  }

  async function saveHeaderDates() {
    if (!canEdit || !data?.plan) return;
    if (kickoffDate === data.plan.kickoffDate && endDate === data.plan.endDate) return;
    setHeaderSaving(true);
    setHeaderError(null);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kickoffDate, endDate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHeaderError(json.error ?? "Failed to update dates");
        setKickoffDate(data.plan.kickoffDate);
        setEndDate(data.plan.endDate);
        return;
      }
      load();
    } finally {
      setHeaderSaving(false);
    }
  }

  async function saveAssumptions() {
    if (!canEdit || !data?.plan) return;
    const assumptions = assumptionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (assumptions.join("\n") === data.plan.assumptions.join("\n")) return;
    setAssumptionsSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumptions }),
      });
      if (res.ok) load();
    } finally {
      setAssumptionsSaving(false);
    }
  }

  async function saveDefault(value: "timeline" | "plan") {
    if (!canEdit || value === displayReportDefault || defaultSaving) return;
    setPendingReportDefault(value);
    setDefaultSaving(true);
    setDefaultError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planReportDefault: value }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPendingReportDefault(null);
        setDefaultError(json.error ?? "Could not save report default. Try again.");
        return;
      }
      router.refresh();
    } finally {
      setDefaultSaving(false);
    }
  }

  if (loading) {
    return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading plan…</p>;
  }
  if (error && !data) {
    return <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>;
  }
  if (!data) return null;

  const plan = data.plan;

  if (!plan) {
    return (
      <div className="space-y-6">
        <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
          Project Plan
        </h2>
        <div className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface p-8 text-center space-y-4">
          <p className="text-body-sm text-surface-700 dark:text-surface-300">
            No plan yet. Start from a blank plan using your project dates, or use guided setup when
            available.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="relative group">
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-500 dark:text-surface-500 cursor-not-allowed"
              >
                Guided setup
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded bg-surface-800 dark:bg-surface-700 text-white text-label-sm px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Coming soon
              </span>
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={handleCreateBlank}
                disabled={creating}
                className="px-4 py-2 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Start from blank"}
              </button>
            )}
          </div>
          {error && <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  const durationDays = planDurationDays(plan.kickoffDate, plan.endDate);

  return (
    <div className="space-y-6">
      <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
        Project Plan
      </h2>

      {data.dateMismatch && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-body-sm text-surface-800 dark:text-surface-200">
          <AlertTriangle
            className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
            size={18}
            aria-hidden
          />
          <div>
            <p className="font-semibold">Plan dates differ from project dates</p>
            <p className="mt-1">
              Project: {data.project.startDate.slice(0, 10)}
              {data.project.endDate ? ` – ${data.project.endDate.slice(0, 10)}` : " (no end date)"}.
              Plan: {plan.kickoffDate} – {plan.endDate}.
            </p>
          </div>
        </div>
      )}

      {(plan.updatedByName || plan.updatedAt) && (
        <p className="text-body-sm text-surface-600 dark:text-surface-400">
          {plan.updatedByName ? (
            <>
              Last updated by <span className="font-medium">{plan.updatedByName}</span> on{" "}
            </>
          ) : (
            <>Last updated on </>
          )}
          <LocalTime isoDate={plan.updatedAt} />
        </p>
      )}

      <section className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
              Kickoff date
            </label>
            {canEdit ? (
              <input
                type="date"
                value={kickoffDate}
                onChange={(e) => setKickoffDate(e.target.value)}
                onBlur={saveHeaderDates}
                disabled={headerSaving}
                className={`${INPUT_CLASS} w-auto`}
              />
            ) : (
              <p className="text-body-sm text-surface-800 dark:text-surface-100 mt-1">
                {plan.kickoffDate}
              </p>
            )}
          </div>
          <div>
            <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
              End date
            </label>
            {canEdit ? (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onBlur={saveHeaderDates}
                disabled={headerSaving}
                className={`${INPUT_CLASS} w-auto`}
              />
            ) : (
              <p className="text-body-sm text-surface-800 dark:text-surface-100 mt-1">
                {plan.endDate}
              </p>
            )}
          </div>
          <div>
            <span className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
              Duration
            </span>
            <p className="text-body-sm text-surface-800 dark:text-surface-100 mt-1 tabular-nums">
              {durationDays} day{durationDays === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {headerError && (
          <p className="mt-2 text-body-sm text-red-600 dark:text-red-400">{headerError}</p>
        )}
      </section>

      {canEdit && (
        <section className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4 space-y-2">
          <p className="text-body-sm font-medium text-surface-800 dark:text-surface-100">
            New status reports use
          </p>
          <div
            className="inline-flex rounded-md border border-surface-300 dark:border-dark-muted overflow-hidden"
            aria-label="Default schedule source for new status reports"
          >
            <button
              type="button"
              disabled={defaultSaving}
              aria-pressed={displayReportDefault === "timeline"}
              onClick={() => saveDefault("timeline")}
              className={`${REPORT_DEFAULT_BTN} ${
                displayReportDefault === "timeline"
                  ? REPORT_DEFAULT_BTN_PRESSED
                  : REPORT_DEFAULT_BTN_IDLE
              }`}
            >
              Project timeline
            </button>
            <button
              type="button"
              disabled={defaultSaving}
              aria-pressed={displayReportDefault === "plan"}
              onClick={() => saveDefault("plan")}
              className={`${REPORT_DEFAULT_BTN} ${
                displayReportDefault === "plan" ? REPORT_DEFAULT_BTN_PRESSED : REPORT_DEFAULT_BTN_IDLE
              }`}
            >
              Project Plan
            </button>
          </div>
          <p className="text-body-sm text-surface-600 dark:text-surface-400">
            Changing this does not rewrite saved reports.{" "}
            <Link
              href={`/projects/${projectSlug}?tab=status-reports`}
              className="text-jblue-600 dark:text-jblue-400 font-medium hover:underline"
            >
              Status Reports
            </Link>{" "}
            still use the Timeline tab unless a report chooses Project Plan.
          </p>
          {defaultError && (
            <p className="text-body-sm text-red-600 dark:text-red-400">{defaultError}</p>
          )}
        </section>
      )}

      <PlanGridGantt plan={plan} canEdit={canEdit} apiBase={apiBase} onMutated={load} />

      <section className="space-y-2">
        <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100">
          Assumptions & notes
        </h3>
        <p className="text-body-sm text-surface-600 dark:text-surface-400">
          Date judgment calls and caveats worth surfacing - the reasoning behind the plan, not buried in it. One per line.
        </p>
        {canEdit ? (
          <>
            <textarea
              value={assumptionsText}
              onChange={(e) => setAssumptionsText(e.target.value)}
              onBlur={saveAssumptions}
              rows={5}
              placeholder={"Client feedback assumed within 2 business days\nDesign review assumed the week of Mar 10\nLaunch pushed to Mon Apr 6 - Apr 3 is a holiday"}
              disabled={assumptionsSaving}
              className={`${INPUT_CLASS} h-auto py-2`}
            />
            {assumptionsSaving && (
              <p className="text-body-sm text-surface-500 dark:text-surface-400">Saving…</p>
            )}
            <p className="text-body-sm text-surface-600 dark:text-surface-400">
              Guided setup will fill this in automatically in a future release.
            </p>
          </>
        ) : plan.assumptions.length > 0 ? (
          <ul className="list-disc list-inside text-body-sm text-surface-700 dark:text-surface-300 space-y-1">
            {plan.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-surface-600 dark:text-surface-400">
            No assumptions or notes recorded.
          </p>
        )}
      </section>
    </div>
  );
}
