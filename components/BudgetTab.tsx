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
            stroke="#e5e7eb"
            strokeWidth={stroke}
          />
          {clamped > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#2563eb"
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-black"
          aria-live="polite"
        >
          {burnPercent != null ? `${burnPercent.toFixed(1)}%` : "—"}
        </div>
      </div>
      <p className="text-xs text-black">Budget burn (hours)</p>
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

  if (loading) return <p className="text-black">Loading...</p>;

  return (
    <div className="space-y-6">
      {rollups && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-black">To date</p>
            <p className="font-medium text-black">
              {formatHours(rollups.actualHoursToDate ?? 0)} / {formatHours(rollups.plannedHoursToDate ?? 0)} hrs
            </p>
            <p className="text-sm text-black">
              ${formatDollars(rollups.actualDollarsToDate ?? 0)} / ${formatDollars(rollups.forecastDollars ?? 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-black">Forecast hours</p>
            <p className="font-medium">
              {formatHours(rollups.forecastHours ?? 0)}
              {rollups.forecastIncomplete && (
                <span className="text-amber-600 text-xs ml-1">(Incomplete)</span>
              )}
            </p>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-black">Forecast dollars</p>
            <p className="font-medium">
              ${formatDollars(rollups.forecastDollars ?? 0)}
              {rollups.forecastIncomplete && (
                <span className="text-amber-600 text-xs ml-1">(Incomplete)</span>
              )}
            </p>
          </div>
        </div>
      )}

      {rollups && (
        <div className="bg-white p-4 rounded border">
          <p className="text-sm font-medium text-black mb-3">Percent budget burn</p>
          <BudgetBurnPieChart burnPercent={rollups.burnPercentHighHours} />
        </div>
      )}

      {rollups && (() => {
        const totalBudgetHours =
          (rollups.remainingHoursHigh ?? 0) + (rollups.actualHoursToDate ?? 0);
        const forecastHours = rollups.forecastHours ?? 0;
        const remainingHours = totalBudgetHours - forecastHours;
        return (
          <div className="bg-white p-4 rounded border">
            <p className="text-sm font-medium text-black mb-2">Expected remaining</p>
            <p className="text-black text-sm mb-1">
              Based on spend to date and future allocations:
            </p>
            <p className="font-medium text-black">{formatHours(remainingHours)} hrs left</p>
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
          <div className="bg-white rounded border overflow-hidden">
            <p className="text-sm font-medium text-black p-4 pb-2">People on project</p>
            <table className="w-full text-sm border-t">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2">Person</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-right p-2">Rate</th>
                  <th className="text-right p-2">Projected hrs</th>
                  <th className="text-right p-2">Projected revenue</th>
                  <th className="text-right p-2">Actual hrs</th>
                  <th className="text-right p-2">Actual revenue</th>
                </tr>
              </thead>
              <tbody>
                {peopleSummary.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 text-black">{row.personName}</td>
                    <td className="p-2 text-black">{row.roleName}</td>
                    <td className="p-2 text-right text-black">${formatDollars(row.rate)}</td>
                    <td className="p-2 text-right text-black">{formatHours(row.projectedHours)}</td>
                    <td className="p-2 text-right text-black">${formatDollars(row.projectedRevenue)}</td>
                    <td className="p-2 text-right text-black">{formatHours(row.actualHours)}</td>
                    <td className="p-2 text-right text-black">${formatDollars(row.actualRevenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50 font-medium">
                  <td className="p-2 text-black" colSpan={3}>Total</td>
                  <td className="p-2 text-right text-black">{formatHours(totals.projectedHours)}</td>
                  <td className="p-2 text-right text-black">${formatDollars(totals.projectedRevenue)}</td>
                  <td className="p-2 text-right text-black">{formatHours(totals.actualHours)}</td>
                  <td className="p-2 text-right text-black">${formatDollars(totals.actualRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {rollups?.missingActuals && (
        <p className="text-amber-700 bg-amber-50 p-2 rounded text-sm">
          Missing actuals for some completed weeks with planned hours. Forecast marked incomplete.
        </p>
      )}

      {canEdit && (
        <form onSubmit={addLine} className="flex flex-wrap gap-2 items-end">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="border rounded px-2 py-1"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as "SOW" | "CO" | "Other")}
            className="border rounded px-2 py-1"
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
            className="border rounded px-2 py-1 w-20"
          />
          <input
            type="number"
            min={0}
            value={newHighHours}
            onChange={(e) => setNewHighHours(e.target.value)}
            placeholder="High hrs"
            className="border rounded px-2 py-1 w-20"
          />
          <input
            type="number"
            min={0}
            value={newLowDollars}
            onChange={(e) => setNewLowDollars(e.target.value)}
            placeholder="Low $"
            className="border rounded px-2 py-1 w-24"
          />
          <input
            type="number"
            min={0}
            value={newHighDollars}
            onChange={(e) => setNewHighDollars(e.target.value)}
            placeholder="High $"
            className="border rounded px-2 py-1 w-24"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add
          </button>
        </form>
      )}

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">Label</th>
            <th className="text-right p-2">Low Hrs</th>
            <th className="text-right p-2">High Hrs</th>
            <th className="text-right p-2">Low $</th>
            <th className="text-right p-2">High $</th>
          </tr>
        </thead>
        <tbody>
          {budgetLines.map((bl) => (
            <tr key={bl.id} className="border-t">
              <td className="p-2">{bl.type}</td>
              <td className="p-2">{bl.label}</td>
              <td className="p-2 text-right">{formatHours(Number(bl.lowHours))}</td>
              <td className="p-2 text-right">{formatHours(Number(bl.highHours))}</td>
              <td className="p-2 text-right">${formatDollars(Number(bl.lowDollars))}</td>
              <td className="p-2 text-right">${formatDollars(Number(bl.highDollars))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
