"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BadgeAlert,
  ThumbsUp,
  TrendingUpDown,
  Rocket,
  PencilRuler,
  Pin,
  type LucideIcon,
} from "lucide-react";
import { getMonthsInRange } from "@/lib/monthUtils";

type TimelineBar = {
  id: string;
  rowIndex: number;
  label: string;
  startDate: string;
  endDate: string;
  order: number;
};

export const TIMELINE_MARKER_SHAPES = [
  { value: "BadgeAlert", label: "Badge alert" },
  { value: "ThumbsUp", label: "Thumbs up" },
  { value: "TrendingUpDown", label: "Trending up/down" },
  { value: "Rocket", label: "Rocket" },
  { value: "PencilRuler", label: "Pencil ruler" },
  { value: "Pin", label: "Pin" },
] as const;

export type TimelineMarkerShape = (typeof TIMELINE_MARKER_SHAPES)[number]["value"];

type TimelineMarker = {
  id: string;
  rowIndex: number;
  shape: string;
  label: string;
  date: string;
  order: number;
};

type TimelineData = {
  project: { startDate: string; endDate: string | null };
  bars: TimelineBar[];
  markers: TimelineMarker[];
};

function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" }).toUpperCase();
}

const MARKER_ICONS: Record<string, LucideIcon> = {
  BadgeAlert,
  ThumbsUp,
  TrendingUpDown,
  Rocket,
  PencilRuler,
  Pin,
};

function MarkerShapeIcon({ shape, className }: { shape: string; className?: string }) {
  const Icon = MARKER_ICONS[shape] ?? Pin;
  const base = "flex-shrink-0 text-jred-600 dark:text-jred-500 " + (className ?? "");
  return <Icon className={base} size={18} strokeWidth={2} aria-hidden />;
}

export function TimelineTab({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddBar, setShowAddBar] = useState(false);
  const [addBarRow, setAddBarRow] = useState(1);
  const [addBarLabel, setAddBarLabel] = useState("");
  const [addBarStart, setAddBarStart] = useState("");
  const [addBarEnd, setAddBarEnd] = useState("");
  const [barSaving, setBarSaving] = useState(false);
  const [barError, setBarError] = useState<string | null>(null);

  const [editingBarId, setEditingBarId] = useState<string | null>(null);
  const [editBarRow, setEditBarRow] = useState(1);
  const [editBarLabel, setEditBarLabel] = useState("");
  const [editBarStart, setEditBarStart] = useState("");
  const [editBarEnd, setEditBarEnd] = useState("");

  const [showAddMarker, setShowAddMarker] = useState(false);
  const [addMarkerRow, setAddMarkerRow] = useState(1);
  const [addMarkerShape, setAddMarkerShape] = useState<TimelineMarkerShape>("Pin");
  const [addMarkerLabel, setAddMarkerLabel] = useState("");
  const [addMarkerDate, setAddMarkerDate] = useState("");
  const [markerSaving, setMarkerSaving] = useState(false);
  const [markerError, setMarkerError] = useState<string | null>(null);

  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editMarkerRow, setEditMarkerRow] = useState(1);
  const [editMarkerShape, setEditMarkerShape] = useState<TimelineMarkerShape>("Pin");
  const [editMarkerLabel, setEditMarkerLabel] = useState("");
  const [editMarkerDate, setEditMarkerDate] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/projects/${projectId}/timeline`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load timeline");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const projectStart = data?.project?.startDate ? new Date(data.project.startDate).getTime() : 0;
  const projectEnd = data?.project?.endDate ? new Date(data.project.endDate).getTime() : 0;
  const totalMs = projectEnd > projectStart ? projectEnd - projectStart : 0;
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = totalMs / dayMs;
  const totalWeeks = totalDays / 7;

  function positionPercent(dateStr: string): number {
    const t = new Date(dateStr).getTime();
    if (totalWeeks <= 0) return 0;
    const weeksFromStart = (t - projectStart) / dayMs / 7;
    return Math.max(0, Math.min(100, (weeksFromStart / totalWeeks) * 100));
  }

  function widthPercent(startStr: string, endStr: string): number {
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    if (totalWeeks <= 0) return 0;
    const weeksSpan = (e - s) / dayMs / 7;
    return Math.max(0, Math.min(100, (weeksSpan / totalWeeks) * 100));
  }

  async function handleAddBar(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !data) return;
    setBarSaving(true);
    setBarError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/timeline/bars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: addBarRow,
          label: addBarLabel.trim(),
          startDate: addBarStart,
          endDate: addBarEnd,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBarError(json.error ?? "Failed to add bar");
        return;
      }
      setData((prev) =>
        prev ? { ...prev, bars: [...prev.bars, json].sort((a, b) => a.rowIndex - b.rowIndex || a.startDate.localeCompare(b.startDate)) } : prev
      );
      setAddBarLabel("");
      setAddBarStart("");
      setAddBarEnd("");
      setShowAddBar(false);
    } finally {
      setBarSaving(false);
    }
  }

  async function handleUpdateBar(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !editingBarId) return;
    setBarSaving(true);
    setBarError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/timeline/bars/${editingBarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: editBarRow,
          label: editBarLabel.trim(),
          startDate: editBarStart,
          endDate: editBarEnd,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBarError(json.error ?? "Failed to update bar");
        return;
      }
      setData((prev) =>
        prev ? { ...prev, bars: prev.bars.map((b) => (b.id === editingBarId ? json : b)) } : prev
      );
      setEditingBarId(null);
    } finally {
      setBarSaving(false);
    }
  }

  async function handleDeleteBar(barId: string) {
    if (!canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/timeline/bars/${barId}`, { method: "DELETE" });
    if (res.ok) {
      setData((prev) => (prev ? { ...prev, bars: prev.bars.filter((b) => b.id !== barId) } : prev));
    }
  }

  async function handleAddMarker(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !data) return;
    setMarkerSaving(true);
    setMarkerError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/timeline/markers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: addMarkerLabel.trim(),
          date: addMarkerDate,
          rowIndex: addMarkerRow,
          shape: addMarkerShape,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMarkerError(json.error ?? "Failed to add marker");
        return;
      }
      setData((prev) =>
        prev ? { ...prev, markers: [...prev.markers, json].sort((a, b) => a.date.localeCompare(b.date)) } : prev
      );
      setAddMarkerLabel("");
      setAddMarkerDate("");
      setShowAddMarker(false);
    } finally {
      setMarkerSaving(false);
    }
  }

  async function handleUpdateMarker(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !editingMarkerId) return;
    setMarkerSaving(true);
    setMarkerError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/timeline/markers/${editingMarkerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editMarkerLabel.trim(),
          date: editMarkerDate,
          rowIndex: editMarkerRow,
          shape: editMarkerShape,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMarkerError(json.error ?? "Failed to update marker");
        return;
      }
      setData((prev) =>
        prev ? { ...prev, markers: prev.markers.map((m) => (m.id === editingMarkerId ? json : m)) } : prev
      );
      setEditingMarkerId(null);
    } finally {
      setMarkerSaving(false);
    }
  }

  async function handleDeleteMarker(markerId: string) {
    if (!canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/timeline/markers/${markerId}`, { method: "DELETE" });
    if (res.ok) {
      setData((prev) => (prev ? { ...prev, markers: prev.markers.filter((m) => m.id !== markerId) } : prev));
    }
  }

  if (loading) return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading timeline...</p>;
  if (error) return <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!data) return null;

  const hasEndDate = !!data.project.endDate;
  if (!hasEndDate) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-body-sm text-surface-800 dark:text-surface-200">
        <p className="font-semibold">Set project dates to use the timeline</p>
        <p className="mt-1">Add a start date and end date in <strong>Settings</strong> (Details) to define the timeline range.</p>
      </div>
    );
  }

  const months = getMonthsInRange(
    new Date(data.project.startDate),
    new Date(data.project.endDate!)
  );

  const barsByRow: TimelineBar[][] = [[], [], [], []];
  for (const bar of data.bars) {
    if (bar.rowIndex >= 1 && bar.rowIndex <= 4) {
      barsByRow[bar.rowIndex - 1].push(bar);
    }
  }
  for (const row of barsByRow) {
    row.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.order - b.order);
  }

  // Weeks in each month (within project range); use for column proportions and boundary positions
  const { weeksInMonths, monthWidthsPct, monthBoundaryPositions } = (() => {
    if (totalWeeks <= 0) {
      const eq = 100 / months.length;
      return {
        weeksInMonths: months.map(() => 1),
        monthWidthsPct: months.map(() => eq),
        monthBoundaryPositions: months.slice(0, -1).map((_, i) => ((i + 1) * eq)),
      };
    }
    const weeksInMonths = months.map(({ monthKey }) => {
      const [y, m] = monthKey.split("-").map(Number);
      const monthStart = new Date(Date.UTC(y, m - 1, 1)).getTime();
      const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).getTime();
      const overlapStart = Math.max(projectStart, monthStart);
      const overlapEnd = Math.min(projectEnd, monthEnd);
      const daysOverlap = Math.max(0, (overlapEnd - overlapStart) / dayMs);
      return daysOverlap / 7;
    });
    const sumWeeks = weeksInMonths.reduce((a, b) => a + b, 0);
    if (sumWeeks <= 0) {
      const eq = 100 / months.length;
      return {
        weeksInMonths: months.map(() => 1),
        monthWidthsPct: months.map(() => eq),
        monthBoundaryPositions: months.slice(0, -1).map((_, i) => ((i + 1) * eq)),
      };
    }
    const monthWidthsPct = weeksInMonths.map((w) => (w / sumWeeks) * 100);
    const monthBoundaryPositions = monthWidthsPct.slice(0, -1).reduce<number[]>((acc, w) => {
      acc.push((acc.length ? acc[acc.length - 1]! : 0) + w);
      return acc;
    }, []);
    return { weeksInMonths, monthWidthsPct, monthBoundaryPositions };
  })();

  return (
    <div className="space-y-6">
      <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
        High Level Timeline
      </h2>

      <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-x-auto">
        <div className="min-w-[600px] p-4">
          {/* Month header: column widths proportional to weeks in each month (fr = fraction of total) */}
          <div
            className="grid gap-0 border-b-2 border-surface-300 dark:border-dark-muted w-full"
            style={{ gridTemplateColumns: weeksInMonths.map((w) => `${w}fr`).join(" ") }}
          >
            {months.map(({ monthKey }, i) => (
              <div
                key={monthKey}
                className={`text-white text-center py-2 text-label-sm font-bold uppercase tracking-wide px-1 ${i < months.length - 1 ? "border-r border-white/40" : ""}`}
                style={{ backgroundColor: "#040966" }}
              >
                {getMonthLabel(monthKey)}
              </div>
            ))}
          </div>

          {/* Track area: grid lines behind, then bars/markers on top */}
          <div className="relative">
            {/* Vertical lines at month boundaries (behind content) */}
            {monthBoundaryPositions.map((leftPct, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-surface-300 dark:bg-dark-muted pointer-events-none"
                style={{ left: `${leftPct}%`, zIndex: 0 }}
                aria-hidden
              />
            ))}

            {/* 4 bar rows — each row has bars + markers (with shape and label below) */}
            {[1, 2, 3, 4].map((rowNum) => {
              const markersInRow = data.markers.filter((m) => (m.rowIndex ?? 1) === rowNum);
              return (
                <div
                  key={rowNum}
                  className="relative flex items-center border-b border-surface-200 dark:border-dark-border min-h-[52px]"
                  style={{ zIndex: 1 }}
                >
                  <div className="absolute inset-0">
                    {barsByRow[rowNum - 1].map((bar) => (
                      <div
                        key={bar.id}
                        className="absolute top-2 bottom-2 flex items-center rounded px-2 bg-jblue-500 dark:bg-jblue-600 text-white text-body-sm font-medium truncate"
                        style={{
                          left: `${positionPercent(bar.startDate)}%`,
                          width: `${widthPercent(bar.startDate, bar.endDate)}%`,
                          minWidth: "4px",
                        }}
                        title={`${bar.label} (${bar.startDate} – ${bar.endDate})`}
                      >
                        {bar.label}
                      </div>
                    ))}
                    {markersInRow.map((marker) => (
                      <div
                        key={marker.id}
                        className="absolute top-1 flex flex-col items-center pointer-events-none"
                        style={{ left: `${positionPercent(marker.date)}%`, transform: "translateX(-50%)" }}
                        title={`${marker.label} (${marker.date})`}
                      >
                        <MarkerShapeIcon shape={marker.shape ?? "Pin"} />
                        <span className="text-[10px] font-medium text-surface-700 dark:text-surface-300 mt-1 bg-white/90 dark:bg-dark-raised px-1 rounded text-center break-words">
                          {marker.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="space-y-6">
          {/* Bars: add / edit / delete */}
          <section>
            <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-3">Timeline bars</h3>
            {showAddBar ? (
              <form onSubmit={handleAddBar} className="bg-surface-50 dark:bg-dark-raised rounded-lg p-4 space-y-3 max-w-md">
                <div>
                  <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Row (1–4)</label>
                  <select
                    value={addBarRow}
                    onChange={(e) => setAddBarRow(Number(e.target.value))}
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>Row {n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Label</label>
                  <input
                    type="text"
                    value={addBarLabel}
                    onChange={(e) => setAddBarLabel(e.target.value)}
                    required
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    placeholder="e.g. Design, Development"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Start date</label>
                    <input
                      type="date"
                      value={addBarStart}
                      onChange={(e) => setAddBarStart(e.target.value)}
                      required
                      min={data.project.startDate}
                      max={data.project.endDate!}
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    />
                  </div>
                  <div>
                    <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">End date</label>
                    <input
                      type="date"
                      value={addBarEnd}
                      onChange={(e) => setAddBarEnd(e.target.value)}
                      required
                      min={data.project.startDate}
                      max={data.project.endDate!}
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    />
                  </div>
                </div>
                {barError && <p className="text-body-sm text-red-600 dark:text-red-400">{barError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={barSaving}
                    className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50"
                  >
                    {barSaving ? "Adding…" : "Add bar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddBar(false); setBarError(null); }}
                    className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-800 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-dark-border"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddBar(true)}
                className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600"
              >
                Add bar
              </button>
            )}

            {editingBarId && (() => {
              const bar = data.bars.find((b) => b.id === editingBarId);
              if (!bar) return null;
              return (
                <form onSubmit={handleUpdateBar} className="mt-4 bg-surface-50 dark:bg-dark-raised rounded-lg p-4 space-y-3 max-w-md">
                  <div>
                    <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Row (1–4)</label>
                    <select
                      value={editBarRow}
                      onChange={(e) => setEditBarRow(Number(e.target.value))}
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>Row {n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Label</label>
                    <input
                      type="text"
                      value={editBarLabel}
                      onChange={(e) => setEditBarLabel(e.target.value)}
                      required
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Start date</label>
                      <input
                        type="date"
                        value={editBarStart}
                        onChange={(e) => setEditBarStart(e.target.value)}
                        required
                        min={data.project.startDate}
                        max={data.project.endDate!}
                        className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                      />
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">End date</label>
                      <input
                        type="date"
                        value={editBarEnd}
                        onChange={(e) => setEditBarEnd(e.target.value)}
                        required
                        min={data.project.startDate}
                        max={data.project.endDate!}
                        className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                      />
                    </div>
                  </div>
                  {barError && <p className="text-body-sm text-red-600 dark:text-red-400">{barError}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={barSaving} className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50">
                      Save
                    </button>
                    <button type="button" onClick={() => { setEditingBarId(null); setBarError(null); }} className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-800 dark:text-surface-200">
                      Cancel
                    </button>
                  </div>
                </form>
              );
            })()}

            <ul className="mt-3 space-y-1 text-body-sm">
              {data.bars.map((bar) => (
                <li key={bar.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-surface-700 dark:text-surface-300">
                    Row {bar.rowIndex}: <strong>{bar.label}</strong> ({bar.startDate} – {bar.endDate})
                  </span>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBarId(bar.id);
                          setEditBarRow(bar.rowIndex);
                          setEditBarLabel(bar.label);
                          setEditBarStart(bar.startDate);
                          setEditBarEnd(bar.endDate);
                          setBarError(null);
                        }}
                        className="text-jblue-600 dark:text-jblue-400 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBar(bar.id)}
                        className="text-red-600 dark:text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Markers: add / edit / delete */}
          <section>
            <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-3">Markers</h3>
            {showAddMarker ? (
              <form onSubmit={handleAddMarker} className="bg-surface-50 dark:bg-dark-raised rounded-lg p-4 space-y-3 max-w-md">
                <div>
                  <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Row (1–4)</label>
                  <select
                    value={addMarkerRow}
                    onChange={(e) => setAddMarkerRow(Number(e.target.value))}
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>Row {n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Shape</label>
                  <select
                    value={addMarkerShape}
                    onChange={(e) => setAddMarkerShape(e.target.value as TimelineMarkerShape)}
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                  >
                    {TIMELINE_MARKER_SHAPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Label</label>
                  <input
                    type="text"
                    value={addMarkerLabel}
                    onChange={(e) => setAddMarkerLabel(e.target.value)}
                    required
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    placeholder="e.g. Designs Approved 8/22"
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Date</label>
                  <input
                    type="date"
                    value={addMarkerDate}
                    onChange={(e) => setAddMarkerDate(e.target.value)}
                    required
                    min={data.project.startDate}
                    max={data.project.endDate!}
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                  />
                </div>
                {markerError && <p className="text-body-sm text-red-600 dark:text-red-400">{markerError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={markerSaving}
                    className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50"
                  >
                    {markerSaving ? "Adding…" : "Add marker"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddMarker(false); setMarkerError(null); }}
                    className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-800 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-dark-border"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddMarker(true)}
                className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600"
              >
                Add marker
              </button>
            )}

            {editingMarkerId && (() => {
              const marker = data.markers.find((m) => m.id === editingMarkerId);
              if (!marker) return null;
              return (
                <form onSubmit={handleUpdateMarker} className="mt-4 bg-surface-50 dark:bg-dark-raised rounded-lg p-4 space-y-3 max-w-md">
                  <div>
                    <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Row (1–4)</label>
                    <select
                      value={editMarkerRow}
                      onChange={(e) => setEditMarkerRow(Number(e.target.value))}
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>Row {n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Shape</label>
                    <select
                      value={editMarkerShape}
                      onChange={(e) => setEditMarkerShape(e.target.value as TimelineMarkerShape)}
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    >
                      {TIMELINE_MARKER_SHAPES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Label</label>
                    <input
                      type="text"
                      value={editMarkerLabel}
                      onChange={(e) => setEditMarkerLabel(e.target.value)}
                      required
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    />
                  </div>
                  <div>
                    <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">Date</label>
                    <input
                      type="date"
                      value={editMarkerDate}
                      onChange={(e) => setEditMarkerDate(e.target.value)}
                      required
                      min={data.project.startDate}
                      max={data.project.endDate!}
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                    />
                  </div>
                  {markerError && <p className="text-body-sm text-red-600 dark:text-red-400">{markerError}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={markerSaving} className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50">
                      Save
                    </button>
                    <button type="button" onClick={() => { setEditingMarkerId(null); setMarkerError(null); }} className="px-3 py-1.5 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-800 dark:text-surface-200">
                      Cancel
                    </button>
                  </div>
                </form>
              );
            })()}

            <ul className="mt-3 space-y-1 text-body-sm">
              {data.markers.map((marker) => (
                <li key={marker.id} className="flex items-center gap-2 flex-wrap">
                  <MarkerShapeIcon shape={marker.shape ?? "Pin"} className="mt-0.5" />
                  <span className="text-surface-700 dark:text-surface-300">
                    Row {marker.rowIndex ?? 1}, <strong>{marker.label}</strong> ({marker.date})
                  </span>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMarkerId(marker.id);
                          setEditMarkerRow(marker.rowIndex ?? 1);
                          setEditMarkerShape((marker.shape as TimelineMarkerShape) ?? "Pin");
                          setEditMarkerLabel(marker.label);
                          setEditMarkerDate(marker.date);
                          setMarkerError(null);
                        }}
                        className="text-jblue-600 dark:text-jblue-400 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMarker(marker.id)}
                        className="text-red-600 dark:text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <p className="text-body-sm text-surface-500 dark:text-surface-400">
        This timeline is included in status reports when you create or export a report.
      </p>
    </div>
  );
}
