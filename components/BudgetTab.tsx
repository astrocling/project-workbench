"use client";

import { useState, useEffect } from "react";

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
  burnPercentLowHours: number | null;
  burnPercentHighHours: number | null;
  burnPercentLowDollars: number | null;
  burnPercentHighDollars: number | null;
  remainingHoursLow: number;
  remainingHoursHigh: number;
  remainingDollarsLow: number;
  remainingDollarsHigh: number;
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
            <p className="text-sm text-black">Planned to date</p>
            <p className="font-medium">{rollups.plannedHoursToDate.toFixed(1)} hrs</p>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-black">Actual to date</p>
            <p className="font-medium">{rollups.actualHoursToDate.toFixed(1)} hrs</p>
            <p className="text-sm text-black">${rollups.actualDollarsToDate.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-black">Forecast hours</p>
            <p className="font-medium">
              {rollups.forecastHours.toFixed(1)}
              {rollups.forecastIncomplete && (
                <span className="text-amber-600 text-xs ml-1">(Incomplete)</span>
              )}
            </p>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-black">Forecast dollars</p>
            <p className="font-medium">
              ${rollups.forecastDollars.toLocaleString()}
              {rollups.forecastIncomplete && (
                <span className="text-amber-600 text-xs ml-1">(Incomplete)</span>
              )}
            </p>
          </div>
        </div>
      )}

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
              <td className="p-2 text-right">{Number(bl.lowHours).toFixed(1)}</td>
              <td className="p-2 text-right">{Number(bl.highHours).toFixed(1)}</td>
              <td className="p-2 text-right">${Number(bl.lowDollars).toLocaleString()}</td>
              <td className="p-2 text-right">${Number(bl.highDollars).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
