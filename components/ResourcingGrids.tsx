"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAllWeeks,
  getAsOfDate,
  getWeekStartDate,
  isCompletedWeek,
  formatWeekKey,
  formatWeekShort,
  isCurrentWeek,
  isFutureWeek,
} from "@/lib/weekUtils";
import { hasPlanningMismatch, hasMissingActuals } from "@/lib/budgetCalculations";

type Assignment = { personId: string; person: { name: string }; role: { name: string } };
type PlannedRow = { projectId: string; personId: string; weekStartDate: string; hours: number };
type ActualRow = { projectId: string; personId: string; weekStartDate: string; hours: number | null };
type FloatRow = { projectId: string; personId: string; weekStartDate: string; hours: number };
type ReadyRow = { projectId: string; personId: string; ready: boolean };
type PTOImpact = { personId: string; weekStartDate: string; type: string };

export function ResourcingGrids({
  projectId,
  canEdit,
  floatLastUpdated,
}: {
  projectId: string;
  canEdit: boolean;
  floatLastUpdated: Date | null;
}) {
  const [project, setProject] = useState<{
    startDate: string;
    endDate: string | null;
    actualsLowThresholdPercent: number | null;
    actualsHighThresholdPercent: number | null;
  } | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [planned, setPlanned] = useState<PlannedRow[]>([]);
  const [actual, setActual] = useState<ActualRow[]>([]);
  const [float, setFloat] = useState<FloatRow[]>([]);
  const [readyForFloat, setReadyForFloat] = useState<ReadyRow[]>([]);
  const [ptoImpacts, setPtoImpacts] = useState<PTOImpact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingPlan, setSyncingPlan] = useState(false);
  const [backfillingFloat, setBackfillingFloat] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingPlanned, setEditingPlanned] = useState<{ personId: string; weekKey: string; str: string } | null>(null);
  const [editingActual, setEditingActual] = useState<{ personId: string; weekKey: string; str: string } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const firstWeekColRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/assignments`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/planned-hours`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/actual-hours`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/float-hours`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/ready-for-float`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/pto-impacts`).then((r) => r.json()).catch(() => []),
    ]).then(([p, a, pl, ac, fl, rf, pto]) => {
      setProject({
        startDate: p.startDate,
        endDate: p.endDate,
        actualsLowThresholdPercent: p.actualsLowThresholdPercent ?? null,
        actualsHighThresholdPercent: p.actualsHighThresholdPercent ?? null,
      });
      setAssignments(a);
      setPlanned(
        (pl ?? []).map((row: PlannedRow) => ({
          ...row,
          hours: Number(row.hours),
        }))
      );
      setActual(
        (ac ?? []).map((row: ActualRow) => ({
          ...row,
          hours: row.hours == null ? null : Number(row.hours),
        }))
      );
      setFloat(
        (fl ?? []).map((row: FloatRow) => ({
          ...row,
          hours: Number(row.hours),
        }))
      );
      setReadyForFloat(rf ?? []);
      setPtoImpacts(pto ?? []);
    }).finally(() => setLoading(false));
  }, [projectId, refreshTrigger]);

  useEffect(() => {
    if (loading || !project) return;
    const start = new Date(project.startDate);
    const end = project.endDate ? new Date(project.endDate) : new Date();
    const weeksList = getAllWeeks(start, end);
    if (weeksList.length === 0) return;
    const currentWeekStart = getWeekStartDate(new Date());
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
    const prevWeekKey = formatWeekKey(previousWeekStart);
    const prevWeekIndex = weeksList.findIndex((w) => formatWeekKey(w) === prevWeekKey);
    const index = prevWeekIndex >= 0 ? prevWeekIndex : 0;
    const el = scrollContainerRef.current;
    const col = firstWeekColRef.current;
    if (el && col) {
      el.scrollLeft = index * col.offsetWidth;
    }
  }, [loading, project?.startDate, project?.endDate]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    const col = firstWeekColRef.current;
    if (!el || !col) return;
    const snapToColumn = () => {
      const colWidth = col.offsetWidth;
      if (colWidth <= 0) return;
      const target = Math.round(el.scrollLeft / colWidth) * colWidth;
      el.scrollLeft = Math.min(target, el.scrollWidth - el.clientWidth);
    };
    const handleScrollEnd = () => snapToColumn();
    let scrollEndTimer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(handleScrollEnd, 100);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    el.addEventListener("scrollend", handleScrollEnd);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("scrollend", handleScrollEnd);
      clearTimeout(scrollEndTimer);
    };
  }, [loading]);

  if (loading || !project) return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading grids...</p>;

  const start = new Date(project.startDate);
  const end = project.endDate ? new Date(project.endDate) : new Date();
  const weeks = getAllWeeks(start, end);
  const asOf = getAsOfDate();

  const getPlanned = (personId: string, weekKey: string) => {
    const row = planned.find(
      (p) => p.personId === personId && p.weekStartDate.startsWith(weekKey)
    );
    return row == null ? 0 : Number(row.hours);
  };
  const getActual = (personId: string, weekKey: string) => {
    const row = actual.find(
      (a) => a.personId === personId && a.weekStartDate.startsWith(weekKey)
    );
    if (row == null) return null;
    return row.hours == null ? null : Number(row.hours);
  };
  const getFloat = (personId: string, weekKey: string) => {
    const normalized = (d: string) =>
      d.includes("T") ? d.slice(0, 10) : d;
    const row = float.find(
      (f) =>
        f.personId === personId &&
        normalized(String(f.weekStartDate)) === weekKey
    );
    return row == null ? 0 : Number(row.hours);
  };
  const getReady = (personId: string) =>
    readyForFloat.find((r) => r.personId === personId)?.ready ?? false;
  const hasPTO = (personId: string, weekKey: string) =>
    ptoImpacts.some(
      (x) => x.personId === personId && x.weekStartDate.startsWith(weekKey)
    );
  const weekHasAnyPTO = (weekKey: string) =>
    assignments.some((a) => hasPTO(a.personId, weekKey));

  const plannedRowTotal = (personId: string) =>
    weeks.reduce((sum, w) => sum + getPlanned(personId, formatWeekKey(w)), 0);
  const actualRowTotal = (personId: string) =>
    weeks.reduce(
      (sum, w) => sum + (getActual(personId, formatWeekKey(w)) ?? 0),
      0
    );
  const floatRowTotal = (personId: string) =>
    weeks.reduce((sum, w) => sum + getFloat(personId, formatWeekKey(w)), 0);

  const sortedAssignments = [...assignments].sort((a, b) =>
    (a.person.name || "").localeCompare(b.person.name || "", undefined, { sensitivity: "base" })
  );
  const plannedWeekTotal = (weekKey: string) =>
    assignments.reduce((sum, a) => sum + getPlanned(a.personId, weekKey), 0);
  const actualWeekTotal = (weekKey: string) =>
    assignments.reduce(
      (sum, a) => sum + (getActual(a.personId, weekKey) ?? 0),
      0
    );
  const floatWeekTotal = (weekKey: string) =>
    assignments.reduce((sum, a) => sum + getFloat(a.personId, weekKey), 0);

  const formatTotal = (n: number) => {
    const x = Number(n);
    if (Number.isNaN(x)) return "0";
    return x % 1 === 0 ? String(x) : x.toFixed(2);
  };

  const lowThresh = project.actualsLowThresholdPercent ?? 10;
  const highThresh = project.actualsHighThresholdPercent ?? 5;
  const actualsTotalVarianceClass = (weekKey: string) => {
    const weekDate = new Date(weekKey);
    if (isFutureWeek(weekDate, asOf)) return "";
    const planned = plannedWeekTotal(weekKey);
    const actual = actualWeekTotal(weekKey);
    if (actual < planned && planned > 0 && (planned - actual) / planned > lowThresh / 100) return "bg-jblue-100 dark:bg-jblue-500/15";
    if (actual > planned && (actual - planned) / (planned || 1) > highThresh / 100) return "bg-jred-100 dark:bg-jred-900/20";
    return "";
  };

  const planningFloatTotalVarianceClass = (weekKey: string) => {
    const hasAnyMismatch = assignments.some(
      (a) =>
        Math.round(getPlanned(a.personId, weekKey) * 100) !==
        Math.round(getFloat(a.personId, weekKey) * 100)
    );
    return hasAnyMismatch ? "bg-jred-100 dark:bg-jred-900/20" : "";
  };

  const colReady = "2.75rem";
  const colPerson = "9rem";
  const colRole = "6rem";
  const colTotal = "4.5rem";
  const colWeek = "4rem"; /* wide enough for 12.75 (2 digits, decimal, 2 digits) */
  const leftRole = "11.75rem";
  const leftTotal = "17.75rem";
  const stickyColsWidth = "22.25rem";
  const tableMinWidth = `calc(${stickyColsWidth} + ${weeks.length} * ${colWeek})`;
  const sticky = "sticky z-10";
  const stickyBgHead = "bg-surface-50 dark:bg-dark-raised";
  const stickyBgBody = "bg-white dark:bg-dark-surface";
  const stickyBgFoot = "bg-surface-100 dark:bg-dark-raised";
  const rowEvenBg = "bg-white dark:bg-dark-surface";
  const rowOddBg = "bg-surface-50 dark:bg-dark-raised/80";
  const stickyOpaqueBody = "resourcing-sticky-body";
  const stickyOpaqueHead = "resourcing-sticky-head";
  const stickyOpaqueFoot = "resourcing-sticky-foot";
  const stickyOpaqueEven = "resourcing-sticky-even";
  const stickyOpaqueOdd = "resourcing-sticky-odd";
  const stickyEdge = "shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.3)]";

  async function updatePlanned(personId: string, weekKey: string, hours: number) {
    if (!canEdit) return;
    await fetch(`/api/projects/${projectId}/planned-hours`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        weekStartDate: weekKey,
        hours,
      }),
    });
    setPlanned((prev) => {
      const rest = prev.filter(
        (p) => !(p.personId === personId && p.weekStartDate.startsWith(weekKey))
      );
      return [...rest, { projectId, personId, weekStartDate: weekKey, hours }];
    });
  }

  async function updateActual(personId: string, weekKey: string, hours: number | null) {
    if (!canEdit) return;
    await fetch(`/api/projects/${projectId}/actual-hours`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        weekStartDate: weekKey,
        hours,
      }),
    });
    setActual((prev) => {
      const rest = prev.filter(
        (a) => !(a.personId === personId && a.weekStartDate.startsWith(weekKey))
      );
      return hours !== null
        ? [...rest, { projectId, personId, weekStartDate: weekKey, hours }]
        : rest;
    });
  }

  async function toggleReady(personId: string, ready: boolean) {
    if (!canEdit) return;
    await fetch(`/api/projects/${projectId}/ready-for-float`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, ready }),
    });
    setReadyForFloat((prev) => {
      const rest = prev.filter((r) => r.personId !== personId);
      return [...rest, { projectId, personId, ready }];
    });
  }

  async function backfillFloat() {
    if (!canEdit || backfillingFloat) return;
    setBackfillingFloat(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/backfill-float`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.detail ?? data.error ?? "Backfill failed");
        return;
      }
      setRefreshTrigger((t) => t + 1);
    } finally {
      setBackfillingFloat(false);
    }
  }

  async function syncPlanFromFloat() {
    if (!canEdit || syncingPlan) return;
    setSyncingPlan(true);
    try {
      const payload = assignments.flatMap((a) =>
        weeks.map((w) => {
          const weekKey = formatWeekKey(w);
          return {
            personId: a.personId,
            weekStartDate: weekKey,
            hours: getFloat(a.personId, weekKey),
          };
        })
      );
      const res = await fetch(`/api/projects/${projectId}/planned-hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      const rows = Array.isArray(updated) ? updated : [updated];
      const normalize = (d: string | Date) =>
        typeof d === "string" ? (d.includes("T") ? d.slice(0, 10) : d) : (d as Date).toISOString().slice(0, 10);
      setPlanned(
        rows.map((r: { projectId: string; personId: string; weekStartDate: string | Date; hours: number }) => ({
          projectId: r.projectId,
          personId: r.personId,
          weekStartDate: normalize(r.weekStartDate),
          hours: Number(r.hours),
        }))
      );
    } finally {
      setSyncingPlan(false);
    }
  }

  const hoursInput = (
    personId: string,
    weekKey: string,
    value: number | null,
    isPlanned: boolean,
    isActual: boolean
  ) => {
    const weekDate = new Date(weekKey);
    const completed = isCompletedWeek(weekDate, asOf);
    const isCurrWeek = isCurrentWeek(weekDate);

    if (isPlanned) {
      const future = isFutureWeek(weekDate, asOf);
      const editable = future || isCurrWeek;
      const plannedVal = getPlanned(personId, weekKey);
      const floatVal = getFloat(personId, weekKey);
      const mismatch = hasPlanningMismatch(weekDate, plannedVal, floatVal, asOf);
      const isEditing = editingPlanned?.personId === personId && editingPlanned?.weekKey === weekKey;
      const displayStr = isEditing ? editingPlanned!.str : String(value ?? 0);
      return (
        <td
          key={weekKey}
          className={`relative z-0 p-1 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${mismatch ? "bg-jred-100 dark:bg-jred-900/20" : ""}`}
        >
          {editable && canEdit ? (
            <input
              type="text"
              inputMode="decimal"
              value={displayStr}
              onFocus={() => setEditingPlanned({ personId, weekKey, str: String(value ?? 0) })}
              onChange={(e) => setEditingPlanned((prev) => (prev?.personId === personId && prev?.weekKey === weekKey ? { ...prev, str: e.target.value } : prev))}
              onBlur={(e) => {
                const str = e.target.value.trim();
                const num = str === "" ? 0 : parseFloat(str);
                updatePlanned(personId, weekKey, Number.isNaN(num) ? 0 : Math.max(0, num));
                setEditingPlanned(null);
              }}
              className="w-full min-w-0 max-w-full border rounded px-1 py-0.5 text-sm text-center box-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <span className="inline-block w-full text-center tabular-nums">{value ?? 0}</span>
          )}
        </td>
      );
    }
    if (isActual) {
      const editable = completed && !isCurrWeek;
      const future = isFutureWeek(weekDate, asOf);
      const plannedVal = getPlanned(personId, weekKey);
      const missing = hasMissingActuals(
        weekDate,
        plannedVal,
        value,
        asOf
      );
      const lowThresh = project.actualsLowThresholdPercent ?? 10;
      const highThresh = project.actualsHighThresholdPercent ?? 5;
      const actualVal = value ?? 0;
      const varianceClass =
        !future && !missing
          ? actualVal < plannedVal && plannedVal > 0 && (plannedVal - actualVal) / plannedVal > lowThresh / 100
            ? "bg-jblue-100 dark:bg-jblue-500/15"
            : actualVal > plannedVal && (actualVal - plannedVal) / (plannedVal || 1) > highThresh / 100
              ? "bg-jred-100 dark:bg-jred-900/20"
              : ""
          : "";
      const isEditing = editingActual?.personId === personId && editingActual?.weekKey === weekKey;
      const displayStr = isEditing ? editingActual!.str : (value != null ? String(value) : "");
      return (
        <td
          key={weekKey}
          className={`relative z-0 p-1 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${missing ? "bg-amber-100 dark:bg-amber-900/20" : ""} ${varianceClass}`}
        >
          {editable && canEdit ? (
            <input
              type="text"
              inputMode="decimal"
              value={displayStr}
              onFocus={() => setEditingActual({ personId, weekKey, str: value != null ? String(value) : "" })}
              onChange={(e) => setEditingActual((prev) => (prev?.personId === personId && prev?.weekKey === weekKey ? { ...prev, str: e.target.value } : { personId, weekKey, str: e.target.value }))}
              onBlur={(e) => {
                const str = e.target.value.trim();
                const num = str === "" ? null : parseFloat(str);
                updateActual(personId, weekKey, num === null || !Number.isNaN(num) ? num : null);
                setEditingActual(null);
              }}
              placeholder="—"
              className="w-full min-w-0 max-w-full border rounded px-1 py-0.5 text-sm text-center box-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <span className="inline-block w-full text-center tabular-nums">{value ?? "—"}</span>
          )}
        </td>
      );
    }
    // Float (read-only)
    const pto = hasPTO(personId, weekKey);
    const plannedVal = getPlanned(personId, weekKey);
    const floatVal = value ?? 0;
    const mismatch = hasPlanningMismatch(weekDate, plannedVal, floatVal, asOf);
    return (
      <td
        key={weekKey}
        className={`relative z-0 p-1 border text-center border-surface-200 dark:border-dark-border ${pto ? "bg-jblue-50 dark:bg-jblue-500/10" : ""} ${mismatch ? "bg-jred-100 dark:bg-jred-900/20" : ""}`}
        title={pto ? "PTO/Holiday" : mismatch ? "Planned ≠ Float" : undefined}
      >
        <span className="inline-block w-full text-center tabular-nums">{value ?? 0}</span>
      </td>
    );
  };

  return (
    <div className="space-y-6">
      <div ref={scrollContainerRef} className="overflow-x-auto space-y-6">
        <div className="rounded-lg border border-surface-200 dark:border-dark-border overflow-clip shadow-card-light dark:shadow-card-dark bg-white dark:bg-dark-surface" style={{ minWidth: tableMinWidth }}>
          <table className="border-separate border-spacing-0 text-sm w-full" style={{ tableLayout: "fixed", minWidth: tableMinWidth }}>
            <colgroup>
              <col style={{ width: colReady }} />
              <col style={{ width: colPerson }} />
              <col style={{ width: colRole }} />
              <col style={{ width: colTotal }} />
              {weeks.map((w) => (
                <col key={formatWeekKey(w)} style={{ width: colWeek, minWidth: colWeek }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  colSpan={4}
                  className={`p-2 border text-left ${sticky} ${stickyOpaqueBody} ${stickyEdge} border-surface-200 dark:border-dark-border`}
                  style={{ left: 0, width: stickyColsWidth, minWidth: stickyColsWidth }}
                >
                  <h3 className="text-display-md font-bold text-surface-900 dark:text-white">1. Project Planning Grid</h3>
                </th>
                <th colSpan={weeks.length} className="p-0 border-0 bg-transparent" aria-hidden />
              </tr>
              <tr className={stickyBgHead}>
                <th className={`p-2 border text-left ${sticky} ${stickyOpaqueHead}`} style={{ left: 0 }}>Ready</th>
                <th className={`p-2 border text-left ${sticky} ${stickyOpaqueHead}`} style={{ left: colReady }}>Person</th>
                <th className={`p-2 border text-left ${sticky} ${stickyOpaqueHead}`} style={{ left: leftRole }}>Role</th>
                <th className={`p-2 text-center ${sticky} ${stickyOpaqueFoot} resourcing-total-header`} style={{ left: leftTotal }}>Total</th>
                {weeks.map((w, wi) => (
                  <th
                    key={formatWeekKey(w)}
                    ref={wi === 0 ? firstWeekColRef : undefined}
                    className="p-1 border text-center text-xs whitespace-nowrap w-16"
                    title={formatWeekKey(w)}
                  >
                    {formatWeekShort(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAssignments.map((a, idx) => {
                const rowBg = idx % 2 === 0 ? rowEvenBg : rowOddBg;
                const stickyOpaque = idx % 2 === 0 ? stickyOpaqueEven : stickyOpaqueOdd;
                return (
                <tr key={a.personId} className={rowBg}>
                  <td className={`p-1 border ${sticky} ${stickyOpaque}`} style={{ left: 0 }}>
                    {canEdit ? (
                      <input
                        type="checkbox"
                        checked={getReady(a.personId)}
                        onChange={(e) => toggleReady(a.personId, e.target.checked)}
                        className="accent-jblue-500 h-4 w-4 rounded border-surface-300 dark:border-dark-muted"
                      />
                    ) : (
                      getReady(a.personId) ? "✓" : ""
                    )}
                  </td>
                  <td className={`p-2 border ${sticky} ${stickyOpaque} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: colReady }}>{a.person.name}</td>
                  <td className={`p-2 border ${sticky} ${stickyOpaque} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: leftRole }}>{a.role.name}</td>
                  <td className={`p-2 border text-center font-medium tabular-nums ${sticky} ${stickyOpaque} ${stickyEdge} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: leftTotal }}>
                    {formatTotal(plannedRowTotal(a.personId))}
                  </td>
                  {weeks.map((w) => {
                    const k = formatWeekKey(w);
                    return hoursInput(
                      a.personId,
                      k,
                      getPlanned(a.personId, k),
                      true,
                      false
                    );
                  })}
                </tr>
              );
              })}
            </tbody>
            <tfoot>
              <tr className={`${stickyBgFoot} font-medium`}>
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: 0 }} />
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: colReady }} />
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: leftRole }}>Total</td>
                <td className={`p-2 border text-center tabular-nums ${sticky} ${stickyOpaqueFoot} ${stickyEdge}`} style={{ left: leftTotal }}>
                  {formatTotal(
                    weeks.reduce((s, w) => s + plannedWeekTotal(formatWeekKey(w)), 0)
                  )}
                </td>
                {weeks.map((w) => {
                  const k = formatWeekKey(w);
                  return (
                    <td key={k} className={`p-2 border text-center tabular-nums ${planningFloatTotalVarianceClass(k)}`}>
                      {formatTotal(plannedWeekTotal(k))}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="rounded-lg border border-surface-200 dark:border-dark-border overflow-clip shadow-card-light dark:shadow-card-dark bg-white dark:bg-dark-surface" style={{ minWidth: tableMinWidth }}>
          <table className="border-separate border-spacing-0 text-sm w-full" style={{ tableLayout: "fixed", minWidth: tableMinWidth }}>
            <colgroup>
              <col style={{ width: colReady }} />
              <col style={{ width: colPerson }} />
              <col style={{ width: colRole }} />
              <col style={{ width: colTotal }} />
              {weeks.map((w) => (
                <col key={formatWeekKey(w)} style={{ width: colWeek, minWidth: colWeek }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  colSpan={4}
                  className={`p-2 border text-left ${sticky} ${stickyOpaqueBody} ${stickyEdge} border-surface-200 dark:border-dark-border`}
                  style={{ left: 0, width: stickyColsWidth, minWidth: stickyColsWidth }}
                >
                  <h3 className="text-display-md font-bold text-surface-900 dark:text-white">2. Weekly Actuals Grid</h3>
                </th>
                <th colSpan={weeks.length} className="p-0 border-0 bg-transparent" aria-hidden />
              </tr>
              <tr className={stickyBgHead}>
                <th className={`p-2 border ${sticky} ${stickyOpaqueHead}`} style={{ left: 0 }} aria-hidden />
                <th className={`p-2 border text-left ${sticky} ${stickyOpaqueHead}`} style={{ left: colReady }}>Person</th>
                <th className={`p-2 border text-left ${sticky} ${stickyOpaqueHead}`} style={{ left: leftRole }}>Role</th>
                <th className={`p-2 text-center ${sticky} ${stickyOpaqueFoot} resourcing-total-header`} style={{ left: leftTotal }}>Total</th>
                {weeks.map((w) => (
                  <th
                    key={formatWeekKey(w)}
                    className="p-1 border text-center text-xs whitespace-nowrap w-16"
                    title={formatWeekKey(w)}
                  >
                    {formatWeekShort(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAssignments.map((a, idx) => {
                const rowBg = idx % 2 === 0 ? rowEvenBg : rowOddBg;
                const stickyOpaque = idx % 2 === 0 ? stickyOpaqueEven : stickyOpaqueOdd;
                return (
                <tr key={a.personId} className={rowBg}>
                  <td className={`p-2 border ${sticky} ${stickyOpaque}`} style={{ left: 0 }} />
                  <td className={`p-2 border ${sticky} ${stickyOpaque} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: colReady }}>{a.person.name}</td>
                  <td className={`p-2 border ${sticky} ${stickyOpaque} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: leftRole }}>{a.role.name}</td>
                  <td className={`p-2 border text-center font-medium tabular-nums ${sticky} ${stickyOpaque} ${stickyEdge} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: leftTotal }}>
                    {formatTotal(actualRowTotal(a.personId))}
                  </td>
                  {weeks.map((w) => {
                    const k = formatWeekKey(w);
                    return hoursInput(
                      a.personId,
                      k,
                      getActual(a.personId, k),
                      false,
                      true
                    );
                  })}
                </tr>
              );
              })}
            </tbody>
            <tfoot>
              <tr className={`${stickyBgFoot} font-medium`}>
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: 0 }} />
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: colReady }} />
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: leftRole }}>Total</td>
                <td className={`p-2 border text-center tabular-nums ${sticky} ${stickyOpaqueFoot} ${stickyEdge}`} style={{ left: leftTotal }}>
                  {formatTotal(
                    weeks.reduce((s, w) => s + actualWeekTotal(formatWeekKey(w)), 0)
                  )}
                </td>
                {weeks.map((w) => {
                  const k = formatWeekKey(w);
                  return (
                    <td key={k} className={`p-2 border text-center tabular-nums ${actualsTotalVarianceClass(k)}`}>
                      {formatTotal(actualWeekTotal(k))}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="rounded-lg border border-surface-200 dark:border-dark-border overflow-clip shadow-card-light dark:shadow-card-dark bg-white dark:bg-dark-surface" style={{ minWidth: tableMinWidth }}>
          <table className="border-separate border-spacing-0 text-sm w-full" style={{ tableLayout: "fixed", minWidth: tableMinWidth }}>
            <colgroup>
              <col style={{ width: colReady }} />
              <col style={{ width: colPerson }} />
              <col style={{ width: colRole }} />
              <col style={{ width: colTotal }} />
              {weeks.map((w) => (
                <col key={formatWeekKey(w)} style={{ width: colWeek, minWidth: colWeek }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  colSpan={4}
                  className={`p-2 border text-left ${sticky} ${stickyOpaqueBody} ${stickyEdge} border-surface-200 dark:border-dark-border`}
                  style={{ left: 0, width: stickyColsWidth, minWidth: stickyColsWidth }}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-display-md font-bold text-surface-900 dark:text-white">3. Float Actuals Grid</h3>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={backfillFloat}
                          disabled={backfillingFloat}
                          className="h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                          title="Import float hour data from the last CSV upload for this project"
                        >
                          {backfillingFloat ? "Backfilling…" : "Backfill float data"}
                        </button>
                        <button
                          type="button"
                          onClick={syncPlanFromFloat}
                          disabled={syncingPlan}
                          className="h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                        >
                          {syncingPlan ? "Syncing…" : "Sync plan from Float"}
                        </button>
                      </>
                    )}
                  </div>
                </th>
                <th colSpan={weeks.length} className="p-0 border-0 bg-transparent" aria-hidden />
              </tr>
              <tr className={stickyBgHead}>
                <th className={`p-2 border sticky ${sticky} ${stickyBgHead}`} style={{ left: 0 }} aria-hidden />
                <th className={`p-2 border text-left sticky ${sticky} ${stickyBgHead}`} style={{ left: colReady }}>Person</th>
                <th className={`p-2 border text-left sticky ${sticky} ${stickyBgHead}`} style={{ left: leftRole }}>Role</th>
                <th className={`p-2 text-center ${sticky} ${stickyOpaqueFoot} resourcing-total-header`} style={{ left: leftTotal }}>Total</th>
                {weeks.map((w) => {
                  const k = formatWeekKey(w);
                  const colPTO = weekHasAnyPTO(k);
                  return (
                    <th
                      key={k}
                      className={`p-1 border text-center text-xs whitespace-nowrap w-16 border-surface-200 dark:border-dark-border ${colPTO ? "bg-jblue-50 dark:bg-jblue-500/10" : ""}`}
                      title={k}
                    >
                      {formatWeekShort(w)}
                      {colPTO && " *"}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedAssignments.map((a, idx) => {
                const rowBg = idx % 2 === 0 ? rowEvenBg : rowOddBg;
                const stickyOpaque = idx % 2 === 0 ? stickyOpaqueEven : stickyOpaqueOdd;
                return (
                <tr key={a.personId} className={rowBg}>
                  <td className={`p-2 border ${sticky} ${stickyOpaque}`} style={{ left: 0 }} />
                  <td className={`p-2 border ${sticky} ${stickyOpaque} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: colReady }}>{a.person.name}</td>
                  <td className={`p-2 border ${sticky} ${stickyOpaque} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: leftRole }}>{a.role.name}</td>
                  <td className={`p-2 border text-center font-medium tabular-nums ${sticky} ${stickyOpaque} ${stickyEdge} ${getReady(a.personId) ? "resourcing-ready" : ""}`} style={{ left: leftTotal }}>
                    {formatTotal(floatRowTotal(a.personId))}
                  </td>
                  {weeks.map((w) => {
                    const k = formatWeekKey(w);
                    return hoursInput(
                      a.personId,
                      k,
                      getFloat(a.personId, k),
                      false,
                      false
                    );
                  })}
                </tr>
              );
              })}
            </tbody>
            <tfoot>
              <tr className={`${stickyBgFoot} font-medium`}>
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: 0 }} />
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: colReady }} />
                <td className={`p-2 border ${sticky} ${stickyOpaqueFoot}`} style={{ left: leftRole }}>Total</td>
                <td className={`p-2 border text-center tabular-nums ${sticky} ${stickyOpaqueFoot} ${stickyEdge}`} style={{ left: leftTotal }}>
                  {formatTotal(
                    weeks.reduce((s, w) => s + floatWeekTotal(formatWeekKey(w)), 0)
                  )}
                </td>
                {weeks.map((w) => {
                  const k = formatWeekKey(w);
                  return (
                    <td key={k} className={`p-2 border text-center tabular-nums ${planningFloatTotalVarianceClass(k)}`}>
                      {formatTotal(floatWeekTotal(k))}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
