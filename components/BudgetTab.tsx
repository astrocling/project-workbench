"use client";

import { useState, useEffect } from "react";

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
      <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider">Budget burn (hours)</p>
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

  if (loading) return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <div className="space-y-6">
      {rollups && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 border-t-2 border-t-jblue-500">
            <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider mt-1">To date</p>
            <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
              ${formatDollars(rollups.actualDollarsToDate ?? 0)} / ${formatDollars((rollups.remainingDollarsHigh ?? 0) + (rollups.actualDollarsToDate ?? 0))}
            </p>
            <p className="text-body-sm text-surface-500 dark:text-surface-400 mt-1">
              {formatHours(rollups.actualHoursToDate ?? 0)} / {formatHours((rollups.remainingHoursHigh ?? 0) + (rollups.actualHoursToDate ?? 0))} hrs
            </p>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 border-t-2 border-t-jblue-500">
            <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider mt-1">Forecast hours</p>
            <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
              {formatHours(rollups.forecastHours ?? 0)}
              {rollups.forecastIncomplete && (
                <span className="text-amber-600 dark:text-amber-400 text-label-md font-semibold ml-1">(Incomplete)</span>
              )}
            </p>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 border-t-2 border-t-jblue-500">
            <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider mt-1">Forecast dollars</p>
            <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums mt-1">
              ${formatDollars(rollups.forecastDollars ?? 0)}
              {rollups.forecastIncomplete && (
                <span className="text-amber-600 dark:text-amber-400 text-label-md font-semibold ml-1">(Incomplete)</span>
              )}
            </p>
          </div>
        </div>
      )}

      {rollups && (
        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
          <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-3">Percent budget burn</p>
          <BudgetBurnPieChart burnPercent={rollups.burnPercentHighHours} />
        </div>
      )}

      {rollups && (() => {
        const totalBudgetHours =
          (rollups.remainingHoursHigh ?? 0) + (rollups.actualHoursToDate ?? 0);
        const forecastHours = rollups.forecastHours ?? 0;
        const remainingHours = totalBudgetHours - forecastHours;
        return (
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
            <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">Expected remaining</p>
            <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-1">
              Based on spend to date and future allocations:
            </p>
            <p className="text-display-md font-extrabold text-surface-900 dark:text-white tabular-nums">{formatHours(remainingHours)} hrs left</p>
          </div>
        );
      })()}

      {peopleSummary.length > 0 && (() => {
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

      {rollups?.missingActuals && (
        <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md text-body-sm">
          Missing actuals for some completed weeks with planned hours. Forecast marked incomplete.
        </p>
      )}

      {canEdit && (
        <form onSubmit={addLine} className="flex flex-wrap gap-2 items-end">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="h-9 w-full px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400 max-w-[12rem]"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as "SOW" | "CO" | "Other")}
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          >
            <option value="SOW">SOW</option>
            <option value="CO">CO</option>
            <option value="Other">Other</option>
          </select>
          <input
            type="number"
            min={0}
            value={newLowHours}
            onChange={(e) => setNewLowHours(e.target.value)}
            placeholder="Low hrs"
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-20 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
          <input
            type="number"
            min={0}
            value={newHighHours}
            onChange={(e) => setNewHighHours(e.target.value)}
            placeholder="High hrs"
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-20 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
          <input
            type="number"
            min={0}
            value={newLowDollars}
            onChange={(e) => setNewLowDollars(e.target.value)}
            placeholder="Low $"
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-24 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
          <input
            type="number"
            min={0}
            value={newHighDollars}
            onChange={(e) => setNewHighDollars(e.target.value)}
            placeholder="High $"
            className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-24 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
          <button
            type="submit"
            className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
