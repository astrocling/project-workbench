"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { getMonthKeysForWeek } from "@/lib/monthUtils";
import { hasPlanningMismatch, hasMissingActuals } from "@/lib/budgetCalculations";
import { Toggle } from "@/components/Toggle";

/** Round to nearest 0.25 for resourcing hours. */
function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

type Assignment = { personId: string; person: { name: string }; role: { name: string } };
type PlannedRow = { projectId: string; personId: string; weekStartDate: string; hours: number };
type ActualRow = { projectId: string; personId: string; weekStartDate: string; hours: number | null };
type ActualMonthSplitRow = { projectId: string; personId: string; weekStartDate: string; monthKey: string; hours: number };
type FloatRow = { projectId: string; personId: string; weekStartDate: string; hours: number };
type ReadyRow = { projectId: string; personId: string; ready: boolean };

type GridCommentType = "Planned" | "Actual";
function commentKey(personId: string, weekKey: string, gridType: GridCommentType): string {
  return `${personId}|${weekKey}|${gridType}`;
}

export function ResourcingGrids({
  projectId,
  canEdit,
  floatLastUpdated,
  onActualsUpdated,
}: {
  projectId: string;
  canEdit: boolean;
  floatLastUpdated: Date | null;
  onActualsUpdated?: () => void;
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
  const [loading, setLoading] = useState(true);
  const [syncingPlan, setSyncingPlan] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingPlanned, setEditingPlanned] = useState<{ personId: string; weekKey: string; str: string } | null>(null);
  const [editingActual, setEditingActual] = useState<{ personId: string; weekKey: string; monthKey?: string; str: string } | null>(null);
  const [actualMonthSplits, setActualMonthSplits] = useState<ActualMonthSplitRow[]>([]);
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [openCommentCell, setOpenCommentCell] = useState<{
    personId: string;
    weekKey: string;
    gridType: GridCommentType;
  } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentPopoverAnchor, setCommentPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const [expandedSplitCells, setExpandedSplitCells] = useState<Set<string>>(new Set());
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const firstWeekColRef = useRef<HTMLTableCellElement>(null);

  const splitCellKey = (personId: string, weekKey: string) => `${personId}|${weekKey}`;
  const setSplitCellExpanded = (personId: string, weekKey: string, expanded: boolean) => {
    const key = splitCellKey(personId, weekKey);
    setExpandedSplitCells((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  useEffect(() => {
    if (!projectId) return;
    const parseJson = (r: Response) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      return r.json();
    };
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(parseJson),
      fetch(`/api/projects/${projectId}/assignments`).then(parseJson),
      fetch(`/api/projects/${projectId}/planned-hours`).then(parseJson),
      fetch(`/api/projects/${projectId}/actual-hours`).then(parseJson),
      fetch(`/api/projects/${projectId}/float-hours`).then(parseJson),
      fetch(`/api/projects/${projectId}/ready-for-float`).then(parseJson),
      fetch(`/api/projects/${projectId}/cell-comments`).then(parseJson),
    ]).then(([p, a, pl, ac, fl, rf, commentsRes]) => {
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
      const acData = Array.isArray(ac) ? { rows: ac as ActualRow[], monthSplits: [] as ActualMonthSplitRow[] } : (ac ?? { rows: [], monthSplits: [] });
      const rows = (acData.rows ?? []).map((row: ActualRow) => ({
        ...row,
        weekStartDate: typeof row.weekStartDate === "string" ? (row.weekStartDate.includes("T") ? row.weekStartDate.slice(0, 10) : row.weekStartDate) : (row.weekStartDate as Date).toISOString().slice(0, 10),
        hours: row.hours == null ? null : Number(row.hours),
      }));
      setActual(rows);
      const splits = (acData.monthSplits ?? []).map((m: ActualMonthSplitRow & { weekStartDate?: Date }) => ({
        projectId: m.projectId,
        personId: m.personId,
        weekStartDate: typeof m.weekStartDate === "string" ? (m.weekStartDate.includes("T") ? m.weekStartDate.slice(0, 10) : m.weekStartDate) : (m.weekStartDate as Date).toISOString().slice(0, 10),
        monthKey: m.monthKey,
        hours: Number(m.hours),
      }));
      setActualMonthSplits(splits);
      setFloat(
        (fl ?? []).map((row: FloatRow) => ({
          ...row,
          hours: Number(row.hours),
        }))
      );
      setReadyForFloat(rf ?? []);
      const commentMap = new Map<string, string>();
      (commentsRes ?? []).forEach((row: { personId: string; weekStartDate: string | Date; gridType: GridCommentType; comment: string }) => {
        const week = typeof row.weekStartDate === "string"
          ? (row.weekStartDate.includes("T") ? row.weekStartDate.slice(0, 10) : row.weekStartDate)
          : (row.weekStartDate as Date).toISOString().slice(0, 10);
        commentMap.set(commentKey(row.personId, week, row.gridType), row.comment ?? "");
      });
      setComments(commentMap);
    }).catch((err) => {
      console.error("ResourcingGrids fetch error:", err);
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

  const closeCommentPopover = useCallback(() => {
    setOpenCommentCell(null);
    setCommentPopoverAnchor(null);
  }, []);

  useEffect(() => {
    if (!openCommentCell) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCommentPopover();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [openCommentCell, closeCommentPopover]);

  useEffect(() => {
    if (openCommentCell && commentTextareaRef.current) {
      commentTextareaRef.current.focus();
    }
  }, [openCommentCell]);

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
  const getActualByMonth = (personId: string, weekKey: string, monthKey: string): number | null => {
    const norm = (d: string) => (d.includes("T") ? d.slice(0, 10) : d);
    const split = actualMonthSplits.find(
      (s) => s.personId === personId && norm(s.weekStartDate) === weekKey && s.monthKey === monthKey
    );
    return split != null ? split.hours : null;
  };

  const getActual = (personId: string, weekKey: string): number | null => {
    const monthKeys = getMonthKeysForWeek(new Date(weekKey));
    if (monthKeys.length === 2) {
      const s1 = getActualByMonth(personId, weekKey, monthKeys[0]!);
      const s2 = getActualByMonth(personId, weekKey, monthKeys[1]!);
      const hasAny = s1 != null || s2 != null;
      if (hasAny) return (s1 ?? 0) + (s2 ?? 0);
    }
    const row = actual.find(
      (a) => a.personId === personId && (a.weekStartDate.startsWith(weekKey) || (a.weekStartDate.includes("T") ? a.weekStartDate.slice(0, 10) : a.weekStartDate) === weekKey)
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

  const getComment = (personId: string, weekKey: string, gridType: GridCommentType): string =>
    comments.get(commentKey(personId, weekKey, gridType)) ?? "";

  async function saveCellComment(
    personId: string,
    weekKey: string,
    gridType: GridCommentType,
    comment: string
  ) {
    if (!canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/cell-comments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, weekStartDate: weekKey, gridType, comment }),
    });
    if (!res.ok) return;
    const key = commentKey(personId, weekKey, gridType);
    setComments((prev) => {
      const next = new Map(prev);
      if (comment.trim() === "") next.delete(key);
      else next.set(key, comment.trim());
      return next;
    });
  }

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

  const colReady = "4rem"; /* wide enough for "Ready" header */
  const colPerson = "9rem";
  const colRole = "6rem";
  const colTotal = "4.5rem";
  const colWeek = "4rem"; /* wide enough for 12.75 (2 digits, decimal, 2 digits) */
  const leftRole = "13rem";
  const leftTotal = "19rem";
  const stickyColsWidth = "23.5rem";
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
    const res = await fetch(`/api/projects/${projectId}/actual-hours`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        weekStartDate: weekKey,
        hours,
      }),
    });
    if (res.ok) onActualsUpdated?.();
    setActual((prev) => {
      const rest = prev.filter(
        (a) => !(a.personId === personId && (a.weekStartDate.startsWith(weekKey) || (a.weekStartDate.includes("T") ? a.weekStartDate.slice(0, 10) : a.weekStartDate) === weekKey))
      );
      return hours !== null
        ? [...rest, { projectId, personId, weekStartDate: weekKey, hours }]
        : rest;
    });
    setActualMonthSplits((prev) =>
      prev.filter((s) => !(s.personId === personId && (s.weekStartDate === weekKey || (s.weekStartDate as string).slice(0, 10) === weekKey)))
    );
  }

  async function updateActualSplit(
    personId: string,
    weekKey: string,
    parts: { monthKey: string; hours: number }[]
  ) {
    if (!canEdit || parts.length !== 2) return;
    const res = await fetch(`/api/projects/${projectId}/actual-hours`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        weekStartDate: weekKey,
        parts: parts.map((p) => ({ monthKey: p.monthKey, hours: roundToQuarter(p.hours) })),
      }),
    });
    if (!res.ok) return;
    onActualsUpdated?.();
    const total = parts[0].hours + parts[1].hours;
    setActual((prev) => {
      const rest = prev.filter(
        (a) => !(a.personId === personId && (a.weekStartDate.startsWith(weekKey) || (a.weekStartDate.includes("T") ? a.weekStartDate.slice(0, 10) : a.weekStartDate) === weekKey))
      );
      return [...rest, { projectId, personId, weekStartDate: weekKey, hours: total }];
    });
    setActualMonthSplits((prev) => {
      const rest = prev.filter(
        (s) => !(s.personId === personId && ((s.weekStartDate as string).slice?.(0, 10) ?? s.weekStartDate) === weekKey)
      );
      return [
        ...rest,
        { projectId, personId, weekStartDate: weekKey, monthKey: parts[0].monthKey, hours: parts[0].hours },
        { projectId, personId, weekStartDate: weekKey, monthKey: parts[1].monthKey, hours: parts[1].hours },
      ];
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
            hours: roundToQuarter(getFloat(a.personId, weekKey)),
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
      const cellComment = getComment(personId, weekKey, "Planned");
      const hasComment = cellComment.length > 0;
      return (
        <td
          key={weekKey}
          className={`relative z-0 p-1 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${mismatch ? "bg-jred-100 dark:bg-jred-900/20" : ""}`}
        >
          <div className="group relative min-h-[1.5rem]">
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
                  const clamped = Number.isNaN(num) ? 0 : Math.max(0, num);
                  updatePlanned(personId, weekKey, roundToQuarter(clamped));
                  setEditingPlanned(null);
                }}
                className="w-full min-w-0 max-w-full border rounded px-1 py-0.5 text-sm text-center box-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ) : (
              <span className="inline-block w-full text-center tabular-nums">{value ?? 0}</span>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setCommentPopoverAnchor({ x: rect.left, y: rect.bottom });
                  setOpenCommentCell({ personId, weekKey, gridType: "Planned" });
                  setCommentDraft(cellComment);
                }}
                className={`absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-sm text-surface-500 hover:bg-surface-200 dark:hover:bg-dark-raised ${!hasComment ? "opacity-0 group-hover:opacity-100" : ""}`}
                aria-label={hasComment ? "Edit comment" : "Add comment"}
                title={hasComment ? "Edit comment" : "Add comment"}
              >
                {hasComment ? (
                  <span
                    className="inline-block w-0 h-0 border-t-[6px] border-t-surface-500 border-l-[6px] border-l-transparent"
                    aria-hidden
                  />
                ) : (
                  <span className="text-[10px] font-medium leading-none">+</span>
                )}
              </button>
            )}
          </div>
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
      const cellComment = getComment(personId, weekKey, "Actual");
      const hasComment = cellComment.length > 0;
      return (
        <td
          key={weekKey}
          className={`relative z-0 p-1 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${missing ? "bg-amber-100 dark:bg-amber-900/20" : ""} ${varianceClass}`}
        >
          <div className="group relative min-h-[1.5rem]">
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
                  if (num === null) {
                    updateActual(personId, weekKey, null);
                  } else {
                    const clamped = Number.isNaN(num) ? 0 : Math.max(0, num);
                    updateActual(personId, weekKey, roundToQuarter(clamped));
                  }
                  setEditingActual(null);
                }}
                placeholder="—"
                className="w-full min-w-0 max-w-full border rounded px-1 py-0.5 text-sm text-center box-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ) : (
              <span className="inline-block w-full text-center tabular-nums">{value ?? "—"}</span>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setCommentPopoverAnchor({ x: rect.left, y: rect.bottom });
                  setOpenCommentCell({ personId, weekKey, gridType: "Actual" });
                  setCommentDraft(cellComment);
                }}
                className={`absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-sm text-surface-500 hover:bg-surface-200 dark:hover:bg-dark-raised ${!hasComment ? "opacity-0 group-hover:opacity-100" : ""}`}
                aria-label={hasComment ? "Edit comment" : "Add comment"}
                title={hasComment ? "Edit comment" : "Add comment"}
              >
                {hasComment ? (
                  <span
                    className="inline-block w-0 h-0 border-t-[6px] border-t-surface-500 border-l-[6px] border-l-transparent"
                    aria-hidden
                  />
                ) : (
                  <span className="text-[10px] font-medium leading-none">+</span>
                )}
              </button>
            )}
          </div>
        </td>
      );
    }
    // Float (read-only)
    const plannedVal = getPlanned(personId, weekKey);
    const floatVal = value ?? 0;
    const mismatch = hasPlanningMismatch(weekDate, plannedVal, floatVal, asOf);
    return (
      <td
        key={weekKey}
        className={`relative z-0 p-1 border text-center border-surface-200 dark:border-dark-border ${mismatch ? "bg-jred-100 dark:bg-jred-900/20" : ""}`}
        title={mismatch ? "Planned ≠ Float" : undefined}
      >
        <span className="inline-block w-full text-center tabular-nums">{value ?? 0}</span>
      </td>
    );
  };

  /** Short month label from monthKey (e.g. "2024-12" -> "12", "2025-01" -> "1"). */
  const monthKeyToShortLabel = (monthKey: string) => {
    const [, m] = monthKey.split("-");
    return m ?? monthKey;
  };

  /** Rolled-up (collapsed) actuals cell for a week that spans two months. Shows week total + expand control. */
  const actualsRolledUpCell = (
    personId: string,
    weekKey: string,
    monthKeys: [string, string],
    onExpand: () => void
  ) => {
    const weekDate = new Date(weekKey);
    const val1 = getActualByMonth(personId, weekKey, monthKeys[0]!);
    const val2 = getActualByMonth(personId, weekKey, monthKeys[1]!);
    const weekTotal = (val1 ?? 0) + (val2 ?? 0);
    const plannedVal = getPlanned(personId, weekKey);
    const missing = hasMissingActuals(weekDate, plannedVal, weekTotal > 0 ? weekTotal : null, asOf);
    const lowThresh = project.actualsLowThresholdPercent ?? 10;
    const highThresh = project.actualsHighThresholdPercent ?? 5;
    const varianceClass =
      !isFutureWeek(weekDate, asOf) && !missing
        ? weekTotal < plannedVal && plannedVal > 0 && (plannedVal - weekTotal) / plannedVal > lowThresh / 100
          ? "bg-jblue-100 dark:bg-jblue-500/15"
          : weekTotal > plannedVal && (weekTotal - plannedVal) / (plannedVal || 1) > highThresh / 100
            ? "bg-jred-100 dark:bg-jred-900/20"
            : ""
        : "";
    const cellComment = getComment(personId, weekKey, "Actual");
    const hasComment = cellComment.length > 0;
    return (
      <td
        key={weekKey}
        className={`relative z-0 p-1 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${missing ? "bg-amber-100 dark:bg-amber-900/20" : ""} ${varianceClass}`}
      >
        <div className="group relative flex items-center justify-center gap-1 min-h-[1.5rem]">
          <span className="tabular-nums">{weekTotal > 0 ? weekTotal : "—"}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onExpand();
            }}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded border border-transparent text-surface-500 hover:bg-surface-200 hover:text-surface-700 dark:hover:bg-dark-raised dark:hover:text-surface-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400"
            aria-label="Split by month"
            title="Split by month"
          >
            <span className="inline-block w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[5px] border-l-current" aria-hidden />
          </button>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setCommentPopoverAnchor({ x: rect.left, y: rect.bottom });
              setOpenCommentCell({ personId, weekKey, gridType: "Actual" });
              setCommentDraft(cellComment);
            }}
            className={`absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-sm text-surface-500 hover:bg-surface-200 dark:hover:bg-dark-raised ${!hasComment ? "opacity-0 group-hover:opacity-100" : ""}`}
            aria-label={hasComment ? "Edit comment" : "Add comment"}
            title={hasComment ? "Edit comment" : "Add comment"}
          >
            {hasComment ? (
              <span className="inline-block w-0 h-0 border-t-[6px] border-t-surface-500 border-l-[6px] border-l-transparent" aria-hidden />
            ) : (
              <span className="text-[10px] font-medium leading-none">+</span>
            )}
          </button>
        )}
      </td>
    );
  };

  const actualsSplitCell = (
    personId: string,
    weekKey: string,
    monthKeys: [string, string],
    onCollapse?: () => void
  ) => {
    const weekDate = new Date(weekKey);
    const completed = isCompletedWeek(weekDate, asOf);
    const isCurrWeek = isCurrentWeek(weekDate);
    const editable = completed && !isCurrWeek && canEdit;
    const val1 = getActualByMonth(personId, weekKey, monthKeys[0]!);
    const val2 = getActualByMonth(personId, weekKey, monthKeys[1]!);
    const weekTotal = (val1 ?? 0) + (val2 ?? 0);
    const plannedVal = getPlanned(personId, weekKey);
    const missing = hasMissingActuals(weekDate, plannedVal, weekTotal > 0 ? weekTotal : null, asOf);
    const lowThresh = project.actualsLowThresholdPercent ?? 10;
    const highThresh = project.actualsHighThresholdPercent ?? 5;
    const varianceClass =
      !isFutureWeek(weekDate, asOf) && !missing
        ? weekTotal < plannedVal && plannedVal > 0 && (plannedVal - weekTotal) / plannedVal > lowThresh / 100
          ? "bg-jblue-100 dark:bg-jblue-500/15"
          : weekTotal > plannedVal && (weekTotal - plannedVal) / (plannedVal || 1) > highThresh / 100
            ? "bg-jred-100 dark:bg-jred-900/20"
            : ""
        : "";
    const cellComment = getComment(personId, weekKey, "Actual");
    const hasComment = cellComment.length > 0;
    const isEditing1 = editingActual?.personId === personId && editingActual?.weekKey === weekKey && editingActual?.monthKey === monthKeys[0];
    const isEditing2 = editingActual?.personId === personId && editingActual?.weekKey === weekKey && editingActual?.monthKey === monthKeys[1];
    const display1 = isEditing1 ? editingActual!.str : (val1 != null ? String(val1) : "");
    const display2 = isEditing2 ? editingActual!.str : (val2 != null ? String(val2) : "");
    const handleBlur1 = (e: React.FocusEvent<HTMLInputElement>) => {
      const str = e.target.value.trim();
      const num = str === "" ? 0 : parseFloat(str);
      const h1 = Number.isNaN(num) ? 0 : Math.max(0, num);
      const h2 = val2 ?? 0;
      updateActualSplit(personId, weekKey, [
        { monthKey: monthKeys[0]!, hours: roundToQuarter(h1) },
        { monthKey: monthKeys[1]!, hours: roundToQuarter(h2) },
      ]);
      setEditingActual(null);
    };
    const handleBlur2 = (e: React.FocusEvent<HTMLInputElement>) => {
      const str = e.target.value.trim();
      const num = str === "" ? 0 : parseFloat(str);
      const h2 = Number.isNaN(num) ? 0 : Math.max(0, num);
      const h1 = val1 ?? 0;
      updateActualSplit(personId, weekKey, [
        { monthKey: monthKeys[0]!, hours: roundToQuarter(h1) },
        { monthKey: monthKeys[1]!, hours: roundToQuarter(h2) },
      ]);
      setEditingActual(null);
    };
    return (
      <td
        key={weekKey}
        className={`relative z-0 p-0.5 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${missing ? "bg-amber-100 dark:bg-amber-900/20" : ""} ${varianceClass}`}
      >
        <div className="group relative flex flex-col gap-0.5 min-h-[2rem]">
          {onCollapse && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCollapse();
                }}
                className="shrink-0 w-5 h-4 flex items-center justify-center rounded border border-transparent text-surface-500 hover:bg-surface-200 dark:hover:bg-dark-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400"
                aria-label="Roll up"
                title="Roll up"
              >
                <span className="inline-block w-0 h-0 border-t-[5px] border-t-current border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent" aria-hidden style={{ transform: "rotate(-90deg)" }} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] text-surface-500 dark:text-surface-400 w-3 shrink-0" title={monthKeys[0]}>
              {monthKeyToShortLabel(monthKeys[0]!)}
            </span>
            {editable ? (
              <input
                type="text"
                inputMode="decimal"
                value={display1}
                onFocus={() => setEditingActual({ personId, weekKey, monthKey: monthKeys[0], str: val1 != null ? String(val1) : "" })}
                onChange={(e) => setEditingActual((prev) => (prev?.personId === personId && prev?.weekKey === weekKey && prev?.monthKey === monthKeys[0] ? { ...prev, str: e.target.value } : { personId, weekKey, monthKey: monthKeys[0], str: e.target.value }))}
                onBlur={handleBlur1}
                placeholder="—"
                className="flex-1 min-w-0 border rounded px-0.5 py-0.5 text-xs text-center box-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ) : (
              <span className="flex-1 text-xs tabular-nums">{val1 ?? "—"}</span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] text-surface-500 dark:text-surface-400 w-3 shrink-0" title={monthKeys[1]}>
              {monthKeyToShortLabel(monthKeys[1]!)}
            </span>
            {editable ? (
              <input
                type="text"
                inputMode="decimal"
                value={display2}
                onFocus={() => setEditingActual({ personId, weekKey, monthKey: monthKeys[1], str: val2 != null ? String(val2) : "" })}
                onChange={(e) => setEditingActual((prev) => (prev?.personId === personId && prev?.weekKey === weekKey && prev?.monthKey === monthKeys[1] ? { ...prev, str: e.target.value } : { personId, weekKey, monthKey: monthKeys[1], str: e.target.value }))}
                onBlur={handleBlur2}
                placeholder="—"
                className="flex-1 min-w-0 border rounded px-0.5 py-0.5 text-xs text-center box-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ) : (
              <span className="flex-1 text-xs tabular-nums">{val2 ?? "—"}</span>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setCommentPopoverAnchor({ x: rect.left, y: rect.bottom });
              setOpenCommentCell({ personId, weekKey, gridType: "Actual" });
              setCommentDraft(cellComment);
            }}
            className={`absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-sm text-surface-500 hover:bg-surface-200 dark:hover:bg-dark-raised ${!hasComment ? "opacity-0 group-hover:opacity-100" : ""}`}
            aria-label={hasComment ? "Edit comment" : "Add comment"}
            title={hasComment ? "Edit comment" : "Add comment"}
          >
            {hasComment ? (
              <span className="inline-block w-0 h-0 border-t-[6px] border-t-surface-500 border-l-[6px] border-l-transparent" aria-hidden />
            ) : (
              <span className="text-[10px] font-medium leading-none">+</span>
            )}
          </button>
        )}
      </td>
    );
  };

  return (
    <div className="space-y-6">
      <div ref={scrollContainerRef} className="overflow-x-auto overscroll-x-contain space-y-6">
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
                <th className={`p-2 border text-center ${sticky} ${stickyOpaqueHead}`} style={{ left: 0 }}>Ready</th>
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
                  <td className={`p-1 border text-center ${sticky} ${stickyOpaque}`} style={{ left: 0 }}>
                    {canEdit ? (
                      <Toggle
                        size="sm"
                        checked={getReady(a.personId)}
                        onChange={(ready) => toggleReady(a.personId, ready)}
                        aria-label={`${a.person.name} ready for float`}
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
                    const monthKeys = getMonthKeysForWeek(w);
                    if (monthKeys.length === 2) {
                      const expanded = expandedSplitCells.has(splitCellKey(a.personId, k));
                      if (expanded) {
                        return actualsSplitCell(a.personId, k, monthKeys as [string, string], () =>
                          setSplitCellExpanded(a.personId, k, false)
                        );
                      }
                      return actualsRolledUpCell(a.personId, k, monthKeys as [string, string], () =>
                        setSplitCellExpanded(a.personId, k, true)
                      );
                    }
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
                      <button
                          type="button"
                          onClick={syncPlanFromFloat}
                          disabled={syncingPlan}
                          className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                        >
                          {syncingPlan ? "Syncing…" : "Sync plan from Float"}
                        </button>
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
                  return (
                    <th
                      key={k}
                      className="p-1 border text-center text-xs whitespace-nowrap w-16 border-surface-200 dark:border-dark-border"
                      title={k}
                    >
                      {formatWeekShort(w)}
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

      {openCommentCell && commentPopoverAnchor && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-50 min-w-[220px] max-w-[320px] rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-card-light dark:shadow-card-dark p-3"
            style={{ left: commentPopoverAnchor.x, top: commentPopoverAnchor.y + 4 }}
            role="dialog"
            aria-label="Comment for this cell"
          >
            <label htmlFor="cell-comment-textarea" className="sr-only">
              Comment for this cell
            </label>
            <textarea
              id="cell-comment-textarea"
              ref={commentTextareaRef}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={3}
              className="w-full text-body-sm border border-surface-200 dark:border-dark-border rounded px-2 py-1.5 bg-white dark:bg-dark-surface text-surface-900 dark:text-surface-100 resize-y min-h-[4rem]"
              placeholder="Add a comment…"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  saveCellComment(openCommentCell.personId, openCommentCell.weekKey, openCommentCell.gridType, commentDraft.trim());
                  closeCommentPopover();
                }}
                className="h-8 px-3 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white text-body-sm font-medium"
              >
                Save
              </button>
              <button
                type="button"
                onClick={closeCommentPopover}
                className="h-8 px-3 rounded-md border border-surface-300 dark:border-dark-muted text-surface-700 dark:text-surface-200 text-body-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  saveCellComment(openCommentCell.personId, openCommentCell.weekKey, openCommentCell.gridType, "");
                  closeCommentPopover();
                }}
                className="h-8 px-3 rounded-md border border-surface-300 dark:border-dark-muted text-surface-600 dark:text-surface-400 text-body-sm"
              >
                Clear
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
