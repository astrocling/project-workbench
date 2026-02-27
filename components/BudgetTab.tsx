"use client";

import { useState, useEffect } from "react";
import { RevenueRecoveryCard } from "@/components/RevenueRecoveryCard";

function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

function formatHours(hours: number): string {
  return roundToQuarter(hours).toFixed(2).replace(/\.?0+$/, "");
}

function formatDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function BudgetBurnPieChart({ burnPercent }: { burnPercent: number | null }) {
  const size = 160;
  const r = 56;
  const stroke = 24;
  const circumference = 2 * Math.PI * r;
  const clamped = burnPercent == null ? 0 : Math.min(100, Math.max(0, burnPercent));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#E2E5EC"
            strokeWidth={stroke}
          />
          {clamped > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#1941FA"
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-title-lg font-semibold text-surface-900 dark:text-white tabular-nums"
          aria-live="polite"
        >
          {burnPercent != null ? `${burnPercent.toFixed(1)}%` : "—"}
        </div>
      </div>
      <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider">Budget burn ($)</p>
    </div>
  );
}

type BudgetLine = {
  id: string;
  type: string;
  label: string;
  lowHours: number;
  highHours: number;
  lowDollars: number;
  highDollars: number;
};

type Rollups = {
  plannedHoursToDate: number;
  actualHoursToDate: number;
  actualDollarsToDate: number;
  missingActuals: boolean;
  forecastHours: number;
  forecastDollars: number;
  forecastIncomplete: boolean;
  projectedCurrentWeekHours: number;
  projectedCurrentWeekDollars: number;
  projectedFutureWeeksHours: number;
  projectedFutureWeeksDollars: number;
  burnPercentLowHours: number | null;
  burnPercentHighHours: number | null;
  burnPercentLowDollars: number | null;
  burnPercentHighDollars: number | null;
  remainingHoursLow: number;
  remainingHoursHigh: number;
  remainingDollarsLow: number;
  remainingDollarsHigh: number;
  remainingAfterForecastHoursLow: number;
  remainingAfterForecastHoursHigh: number;
  remainingAfterForecastDollarsLow: number;
  remainingAfterForecastDollarsHigh: number;
  projectedBurnHours?: number;
  projectedBurnDollars?: number;
  remainingAfterProjectedBurnHoursHigh?: number;
  remainingAfterProjectedBurnDollarsHigh?: number;
};

type PeopleSummaryRow = {
  personName: string;
  roleName: string;
  rate: number;
  projectedHours: number;
  projectedRevenue: number;
  actualHours: number;
  actualRevenue: number;
};

export function BudgetTab({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [rollups, setRollups] = useState<Rollups | null>(null);
  const [peopleSummary, setPeopleSummary] = useState<PeopleSummaryRow[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"SOW" | "CO" | "Other">("SOW");
  const [newLowHours, setNewLowHours] = useState("");
  const [newHighHours, setNewHighHours] = useState("");
  const [newLowDollars, setNewLowDollars] = useState("");
  const [newHighDollars, setNewHighDollars] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    fetch(`/api/projects/${projectId}/budget`)
      .then((r) => r.json())
      .then((d) => {
        setBudgetLines(d.budgetLines ?? []);
        setRollups(d.rollups ?? null);
        setPeopleSummary(d.peopleSummary ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newType,
        label: newLabel,
        lowHours: parseFloat(newLowHours) || 0,
        highHours: parseFloat(newHighHours) || 0,
        lowDollars: parseFloat(newLowDollars) || 0,
        highDollars: parseFloat(newHighDollars) || 0,
      }),
    });
    if (res.ok) {
      const line = await res.json();
      setBudgetLines((prev) => [...prev, line]);
      setNewLabel("");
      setNewLowHours("");
      setNewHighHours("");
      setNewLowDollars("");
      setNewHighDollars("");
      load();
    }
  }

  async function deleteLine(lineId: string) {
    if (!canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/budget`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId }),
    });
    if (res.ok) {
      setBudgetLines((prev) => prev.filter((bl) => bl.id !== lineId));
      load();
    }
  }

  if (loading) return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  const actualsStalePill = (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ring-2 shadow-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-amber-400 dark:ring-amber-500">
      Actuals Stale
    </span>
  );
  const missingActuals = rollups?.missingActuals ?? false;

  return (
    <div className="space-y-10">
      {/* Budget section: first two cards + expected remaining */}
      <section className="space-y-4">
        <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2 flex items-center gap-2 flex-wrap">
          Budget
          {missingActuals && actualsStalePill}
        </h2>
        {rollups && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 border-t-2 border-t-jblue-500">
              <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider mt-1">To date</p>
              <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                ${formatDollars(rollups.actualDollarsToDate ?? 0)} / ${formatDollars((rollups.remainingDollarsHigh ?? 0) + (rollups.actualDollarsToDate ?? 0))}
              </p>
              <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                {formatHours(rollups.actualHoursToDate ?? 0)} / {formatHours((rollups.remainingHoursHigh ?? 0) + (rollups.actualHoursToDate ?? 0))} hrs
              </p>
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
              <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-3">% Budget Burn</p>
              <BudgetBurnPieChart burnPercent={rollups.burnPercentHighDollars} />
            </div>
            {(() => {
              const totalBudgetHours =
                (rollups.remainingHoursHigh ?? 0) + (rollups.actualHoursToDate ?? 0);
              const totalBudgetDollars =
                (rollups.remainingDollarsHigh ?? 0) + (rollups.actualDollarsToDate ?? 0);
              const projectedBurnHours = rollups.projectedBurnHours ?? 0;
              const projectedBurnDollars = rollups.projectedBurnDollars ?? 0;
              const remainingHours = rollups.remainingAfterProjectedBurnHoursHigh ?? totalBudgetHours - projectedBurnHours;
              const remainingDollars = rollups.remainingAfterProjectedBurnDollarsHigh ?? totalBudgetDollars - projectedBurnDollars;
              const bufferPercentHours =
                totalBudgetHours > 0 ? (remainingHours / totalBudgetHours) * 100 : null;
              const isLowBuffer =
                bufferPercentHours != null && (bufferPercentHours < 5 || bufferPercentHours < 0);
              return (
                <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
                  <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-3">Expected remaining</p>
                  <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider mt-1">Projected burn</p>
                  <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                    ${formatDollars(projectedBurnDollars)}
                  </p>
                  <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                    {formatHours(projectedBurnHours)} hrs
                  </p>
                  <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider mt-4">Projected remaining</p>
                  <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                    ${formatDollars(remainingDollars)}
                  </p>
                  <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                    {formatHours(remainingHours)} hrs
                  </p>
                  <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider mt-4">Buffer</p>
                  <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
                    {bufferPercentHours != null ? `${bufferPercentHours.toFixed(1)}%` : "—"}
                  </p>
                  {isLowBuffer && (
                    <p className="text-body-sm font-semibold text-amber-600 dark:text-amber-400 mt-2">
                      {bufferPercentHours != null && bufferPercentHours < 0 ? "Over budget" : "Low buffer"}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* Revenue Recovery section: 3 cards + horizontal chart */}
      <section className="space-y-4">
        <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2 flex items-center gap-2 flex-wrap">
          Revenue Recovery
          {missingActuals && actualsStalePill}
        </h2>
        <RevenueRecoveryCard projectId={projectId} />
      </section>

      {/* People section */}
      {peopleSummary.length > 0 && (
      <section className="space-y-4">
        <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2 flex items-center gap-2 flex-wrap">
          People
          {missingActuals && actualsStalePill}
        </h2>
        {(() => {
        const totals = peopleSummary.reduce(
          (acc, row) => ({
            projectedHours: acc.projectedHours + row.projectedHours,
            projectedRevenue: acc.projectedRevenue + row.projectedRevenue,
            actualHours: acc.actualHours + row.actualHours,
            actualRevenue: acc.actualRevenue + row.actualRevenue,
          }),
          { projectedHours: 0, projectedRevenue: 0, actualHours: 0, actualRevenue: 0 }
        );
        return (
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-hidden">
            <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 p-5 pb-2">People on project</p>
            <table className="w-full text-body-sm border-collapse">
              <thead>
                <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                  <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Person</th>
                  <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Role</th>
                  <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Rate</th>
                  <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Projected hrs</th>
                  <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Projected revenue</th>
                  <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Actual hrs</th>
                  <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Actual revenue</th>
                </tr>
              </thead>
              <tbody>
                {peopleSummary.map((row, i) => (
                  <tr key={i} className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100">
                    <td className="px-4 py-3 font-medium text-surface-800 dark:text-white">{row.personName}</td>
                    <td className="px-4 py-3 text-surface-700 dark:text-surface-200">{row.roleName}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(row.rate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">{formatHours(row.projectedHours)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(row.projectedRevenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">{formatHours(row.actualHours)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(row.actualRevenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-surface-200 dark:border-dark-border bg-surface-100 dark:bg-dark-raised font-medium">
                  <td className="px-4 py-3 text-surface-800 dark:text-surface-100" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">{formatHours(totals.projectedHours)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(totals.projectedRevenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">{formatHours(totals.actualHours)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(totals.actualRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}
      </section>
      )}

      {/* Contract section: contract chart + adding interface */}
      <section className="space-y-4">
        <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
          Contract
        </h2>
        {canEdit && (
        <form onSubmit={addLine} className="flex flex-wrap gap-2 items-end">
          <input
            required
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="h-9 w-full px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400 max-w-[12rem]"
          />
          <select
            required
            value={newType}
            onChange={(e) => setNewType(e.target.value as "SOW" | "CO" | "Other")}
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          >
            <option value="SOW">SOW</option>
            <option value="CO">CO</option>
            <option value="Other">Other</option>
          </select>
          <input
            required
            type="number"
            min={0}
            step="any"
            value={newLowHours}
            onChange={(e) => setNewLowHours(e.target.value)}
            placeholder="Low hrs"
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-20 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
          <input
            required
            type="number"
            min={0}
            step="any"
            value={newHighHours}
            onChange={(e) => setNewHighHours(e.target.value)}
            placeholder="High hrs"
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-20 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
          <input
            required
            type="number"
            min={0}
            step="any"
            value={newLowDollars}
            onChange={(e) => setNewLowDollars(e.target.value)}
            placeholder="Low $"
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-24 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
          <input
            required
            type="number"
            min={0}
            step="any"
            value={newHighDollars}
            onChange={(e) => setNewHighDollars(e.target.value)}
            placeholder="High $"
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-24 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
          >
            Add
          </button>
        </form>
      )}

      <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
        <table className="w-full text-body-sm border-collapse">
          <thead>
            <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
              <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Type</th>
              <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Label</th>
              <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Low Hrs</th>
              <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">High Hrs</th>
              <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Low $</th>
              <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">High $</th>
              {canEdit && <th className="w-10 px-2 py-3" aria-label="Delete row" />}
            </tr>
          </thead>
          <tbody>
            {budgetLines.map((bl) => (
              <tr key={bl.id} className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100">
                <td className="px-4 py-3 text-surface-700 dark:text-surface-200">{bl.type}</td>
                <td className="px-4 py-3 font-medium text-surface-800 dark:text-white">{bl.label}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">{formatHours(Number(bl.lowHours))}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">{formatHours(Number(bl.highHours))}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(Number(bl.lowDollars))}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(Number(bl.highDollars))}</td>
                {canEdit && (
                  <td className="px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => deleteLine(bl.id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={`Delete ${bl.label || "contract"}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
                        <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-surface-200 dark:border-dark-border bg-surface-100 dark:bg-dark-raised font-medium">
              <td className="px-4 py-3 text-surface-800 dark:text-surface-100" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">{formatHours(budgetLines.reduce((s, bl) => s + Number(bl.lowHours), 0))}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">{formatHours(budgetLines.reduce((s, bl) => s + Number(bl.highHours), 0))}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(budgetLines.reduce((s, bl) => s + Number(bl.lowDollars), 0))}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">${formatDollars(budgetLines.reduce((s, bl) => s + Number(bl.highDollars), 0))}</td>
              {canEdit && <td className="px-2 py-3" />}
            </tr>
          </tfoot>
        </table>
      </div>
      </section>
    </div>
  );
}
