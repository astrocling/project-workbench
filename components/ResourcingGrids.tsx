"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { getMonthKeysForWeek, isPastLastUtcDayOfMonthInWeek } from "@/lib/monthUtils";
import {
  hasPlanningMismatch,
  hasMissingActuals,
  hasMissingActualsSplitWeek,
} from "@/lib/budgetCalculations";
import { Toggle } from "@/components/Toggle";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

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

/** Matches app/api/projects/[id]/resourcing/route.ts ptoHolidayByWeek entries */
type PtoHolidayEntry = {
  personId: string;
  type: "PTO" | "HOLIDAY";
  hours: number | null;
  label: string | null;
  isPartial: boolean;
};
type PtoHolidayByWeek = Record<string, PtoHolidayEntry[]>;

/** Distinct holiday labels for a week across all people (banner row / column dot). */
function getHolidaysForWeek(
  ptoHolidayByWeek: PtoHolidayByWeek,
  weekKey: string
): { label: string }[] {
  const list = ptoHolidayByWeek[weekKey] ?? [];
  const seen = new Set<string>();
  const out: { label: string }[] = [];
  for (const e of list) {
    if (e.type !== "HOLIDAY") continue;
    const label = e.label != null && e.label.trim() !== "" ? e.label.trim() : "Holiday";
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label });
  }
  return out;
}

/** Distinct holiday labels for one person in a week (cell border + cell tooltip). */
function getHolidaysForPersonWeek(
  ptoHolidayByWeek: PtoHolidayByWeek,
  weekKey: string,
  personId: string
): { label: string }[] {
  const list = ptoHolidayByWeek[weekKey] ?? [];
  const seen = new Set<string>();
  const out: { label: string }[] = [];
  for (const e of list) {
    if (e.type !== "HOLIDAY" || e.personId !== personId) continue;
    const label = e.label != null && e.label.trim() !== "" ? e.label.trim() : "Holiday";
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label });
  }
  return out;
}

function getPtoForWeek(
  ptoHolidayByWeek: PtoHolidayByWeek,
  weekKey: string,
  personId?: string
): PtoHolidayEntry[] {
  const list = ptoHolidayByWeek[weekKey] ?? [];
  const pto = list.filter((e) => e.type === "PTO");
  if (personId === undefined) return pto;
  return pto.filter((e) => e.personId === personId);
}

function firstNameFromDisplayName(name: string): string {
  const t = name.trim();
  if (!t) return "Person";
  return t.split(/\s+/)[0] ?? t;
}

function formatWeekOfTitle(weekKey: string): string {
  const d = new Date(weekKey + "T00:00:00.000Z");
  return `Week of ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

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
  const [weekRange, setWeekRange] = useState<{ fromWeek: string; toWeek: string } | null>(null);
  const [editingPlanned, setEditingPlanned] = useState<{ personId: string; weekKey: string; str: string } | null>(null);
  const [editingActual, setEditingActual] = useState<{ personId: string; weekKey: string; monthKey?: string; str: string } | null>(null);
  const [actualMonthSplits, setActualMonthSplits] = useState<ActualMonthSplitRow[]>([]);
  const [ptoHolidayByWeek, setPtoHolidayByWeek] = useState<PtoHolidayByWeek>({});
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [openCommentCell, setOpenCommentCell] = useState<{
    personId: string;
    weekKey: string;
    gridType: GridCommentType;
  } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentPopoverAnchor, setCommentPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const [expandedSplitCells, setExpandedSplitCells] = useState<Set<string>>(new Set());
  const [actualsCollapsed, setActualsCollapsed] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const firstWeekColRef = useRef<HTMLTableCellElement>(null);
  const [scrollState, setScrollState] = useState({
    scrollable: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

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
    const qs =
      weekRange != null
        ? `?fromWeek=${encodeURIComponent(weekRange.fromWeek)}&toWeek=${encodeURIComponent(weekRange.toWeek)}`
        : "";
    fetch(`/api/projects/${projectId}/resourcing${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((data: {
        range?: { fromWeek: string; toWeek: string };
        project?: { startDate: string; endDate: string | null; actualsLowThresholdPercent: number | null; actualsHighThresholdPercent: number | null };
        assignments?: Assignment[];
        plannedHours?: PlannedRow[];
        actualHours?: ActualRow[];
        monthSplits?: ActualMonthSplitRow[];
        floatHours?: FloatRow[];
        readyForFloat?: ReadyRow[];
        cellComments?: Array<{ personId: string; weekStartDate: string; gridType: GridCommentType; comment: string }>;
        ptoHolidayByWeek?: PtoHolidayByWeek;
      }) => {
        if (data.range?.fromWeek && data.range?.toWeek) {
          setWeekRange((prev) =>
            prev?.fromWeek === data.range!.fromWeek && prev?.toWeek === data.range!.toWeek
              ? prev
              : { fromWeek: data.range!.fromWeek, toWeek: data.range!.toWeek }
          );
        }
        if (data.project) {
          setProject({
            startDate: data.project.startDate,
            endDate: data.project.endDate ?? null,
            actualsLowThresholdPercent: data.project.actualsLowThresholdPercent ?? null,
            actualsHighThresholdPercent: data.project.actualsHighThresholdPercent ?? null,
          });
        }
        setAssignments(data.assignments ?? []);
        setPlanned((data.plannedHours ?? []).map((row) => ({ ...row, hours: Number(row.hours) })));
        setActual((data.actualHours ?? []).map((row) => ({ ...row, hours: row.hours != null ? Number(row.hours) : null })));
        const splits = (data.monthSplits ?? []).map((m) => ({
          projectId: m.projectId,
          personId: m.personId,
          weekStartDate:
            typeof m.weekStartDate === "string"
              ? m.weekStartDate.includes("T")
                ? m.weekStartDate.slice(0, 10)
                : m.weekStartDate
              : (m.weekStartDate as Date).toISOString().slice(0, 10),
          monthKey: m.monthKey,
          hours: Number(m.hours),
        }));
        setActualMonthSplits(splits);
        setFloat((data.floatHours ?? []).map((row) => ({ ...row, hours: Number(row.hours) })));
        setReadyForFloat(data.readyForFloat ?? []);
        const commentMap = new Map<string, string>();
        (data.cellComments ?? []).forEach((row) => {
          const week = typeof row.weekStartDate === "string" ? row.weekStartDate.slice(0, 10) : row.weekStartDate;
          commentMap.set(commentKey(row.personId, week, row.gridType), row.comment ?? "");
        });
        setComments(commentMap);
        setPtoHolidayByWeek(data.ptoHolidayByWeek ?? {});
      })
      .catch((err) => {
        console.error("ResourcingGrids fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, [projectId, refreshTrigger, weekRange?.fromWeek, weekRange?.toWeek]);

  useEffect(() => {
    if (loading || !project) return;
    const start = weekRange?.fromWeek
      ? new Date(weekRange.fromWeek + "T00:00:00.000Z")
      : new Date(project.startDate);
    const end = weekRange?.toWeek
      ? new Date(weekRange.toWeek + "T00:00:00.000Z")
      : project.endDate
        ? new Date(project.endDate)
        : new Date();
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
  }, [loading, project?.startDate, project?.endDate, weekRange?.fromWeek, weekRange?.toWeek]);

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

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollable = el.scrollWidth > el.clientWidth;
    const canScrollLeft = el.scrollLeft > 0;
    const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    setScrollState((prev) =>
      prev.scrollable !== scrollable || prev.canScrollLeft !== canScrollLeft || prev.canScrollRight !== canScrollRight
        ? { scrollable, canScrollLeft, canScrollRight }
        : prev
    );
  }, []);

  useEffect(() => {
    if (loading) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [loading, updateScrollState]);

  const scrollHorizontal = useCallback((direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.8;
    el.scrollLeft += direction === "left" ? -step : step;
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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

  const allPersonIdsForRollup = useMemo(() => {
    const s = new Set<string>();
    planned.forEach((p) => s.add(p.personId));
    actual.forEach((p) => s.add(p.personId));
    float.forEach((p) => s.add(p.personId));
    return s;
  }, [planned, actual, float]);

  if (loading || !project) return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading grids...</p>;

  const start = weekRange?.fromWeek
    ? new Date(weekRange.fromWeek + "T00:00:00.000Z")
    : new Date(project.startDate);
  const end = weekRange?.toWeek
    ? new Date(weekRange.toWeek + "T00:00:00.000Z")
    : project.endDate
      ? new Date(project.endDate)
      : new Date();
  const weeks = getAllWeeks(start, end);
  const asOf = getAsOfDate();
  /** Subtle column highlight for the calendar week containing today (see `.resourcing-current-week` in globals.css). */
  const currentWeekColClass = (w: Date) => (isCurrentWeek(w) ? "resourcing-current-week" : "");

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

  /** True if an ActualHoursMonthSplit row exists for this person/week/month (used for stale; avoids treating coerced 0 as entered). */
  const hasMonthSplitRow = (personId: string, weekKey: string, monthKey: string) => {
    const norm = (d: string) => (d.includes("T") ? d.slice(0, 10) : d);
    return actualMonthSplits.some(
      (s) => s.personId === personId && norm(s.weekStartDate) === weekKey && s.monthKey === monthKey
    );
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
  const hasAnySplitWeekColumn = weeks.some((w) => getMonthKeysForWeek(w).length === 2);
  const expandAllSplitWeeks = () => {
    const next = new Set<string>();
    for (const a of sortedAssignments) {
      for (const w of weeks) {
        if (getMonthKeysForWeek(w).length === 2) {
          next.add(splitCellKey(a.personId, formatWeekKey(w)));
        }
      }
    }
    setExpandedSplitCells(next);
  };
  const collapseAllSplitWeeks = () => setExpandedSplitCells(new Set());
  const splitWeekBulkState = (() => {
    if (!hasAnySplitWeekColumn || sortedAssignments.length === 0) {
      return { allExpanded: false, noneExpanded: true };
    }
    let total = 0;
    let expanded = 0;
    for (const a of sortedAssignments) {
      for (const w of weeks) {
        if (getMonthKeysForWeek(w).length === 2) {
          total++;
          if (expandedSplitCells.has(splitCellKey(a.personId, formatWeekKey(w)))) expanded++;
        }
      }
    }
    return {
      allExpanded: total > 0 && expanded === total,
      noneExpanded: expanded === 0,
    };
  })();

  const plannedWeekTotal = (weekKey: string) =>
    Array.from(allPersonIdsForRollup).reduce((sum, pid) => sum + getPlanned(pid, weekKey), 0);
  const actualWeekTotal = (weekKey: string) =>
    Array.from(allPersonIdsForRollup).reduce(
      (sum, pid) => sum + (getActual(pid, weekKey) ?? 0),
      0
    );
  const floatWeekTotal = (weekKey: string) =>
    Array.from(allPersonIdsForRollup).reduce((sum, pid) => sum + getFloat(pid, weekKey), 0);

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
  /** Extra space so the last week column and its right border are not clipped when scrolled to the end. */
  const gridCardEndPadding = "4px";
  const tableWrapperMinWidth = `calc(${tableMinWidth} + ${gridCardEndPadding})`;
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

  const canLoadEarlier =
    weekRange?.fromWeek != null
      ? new Date(weekRange.fromWeek + "T00:00:00.000Z") >
        getWeekStartDate(new Date(project.startDate))
      : false;
  const canLoadLater =
    weekRange?.toWeek != null && project.endDate != null
      ? new Date(weekRange.toWeek + "T00:00:00.000Z") <
        getWeekStartDate(new Date(project.endDate))
      : false;
  const showRangeControls = weekRange != null && (canLoadEarlier || canLoadLater);

  const shiftRange = (dir: "earlier" | "later") => {
    if (!weekRange) return;
    const from = getWeekStartDate(new Date(weekRange.fromWeek + "T00:00:00.000Z"));
    const to = getWeekStartDate(new Date(weekRange.toWeek + "T00:00:00.000Z"));
    const stepWeeks = 12;
    const addWeeks = (d: Date, n: number) => {
      const x = new Date(d);
      x.setUTCDate(x.getUTCDate() + n * 7);
      return x;
    };
    const projectStart = getWeekStartDate(new Date(project.startDate));
    const projectEnd = project.endDate ? getWeekStartDate(new Date(project.endDate)) : to;
    const nextFrom = dir === "earlier" ? addWeeks(from, -stepWeeks) : from;
    const nextTo = dir === "later" ? addWeeks(to, stepWeeks) : to;
    const clampedFrom = nextFrom < projectStart ? projectStart : nextFrom;
    const clampedTo = nextTo > projectEnd ? projectEnd : nextTo;
    setWeekRange({ fromWeek: formatWeekKey(clampedFrom), toWeek: formatWeekKey(clampedTo) });
    setLoading(true);
  };

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
    parts: { monthKey: string; hours: number | null }[]
  ) {
    if (!canEdit || parts.length < 1 || parts.length > 2) return;
    const res = await fetch(`/api/projects/${projectId}/actual-hours`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        weekStartDate: weekKey,
        parts: parts.map((p) => ({
          monthKey: p.monthKey,
          hours: p.hours === null ? null : roundToQuarter(p.hours),
        })),
      }),
    });
    if (!res.ok) return;
    onActualsUpdated?.();
    const data = (await res.json()) as { hours?: unknown } | null;
    const numericParts = parts.filter((p): p is { monthKey: string; hours: number } => p.hours !== null);
    const totalFromFallback =
      numericParts.length === 0 ? null : numericParts.reduce((s, p) => s + p.hours, 0);
    let totalFromApi: number | null;
    if (data != null && "hours" in data && data.hours === null) {
      totalFromApi = null;
    } else if (data != null && data.hours != null && !Number.isNaN(Number(data.hours))) {
      totalFromApi = Number(data.hours);
    } else {
      totalFromApi = totalFromFallback;
    }
    setActual((prev) => {
      const rest = prev.filter(
        (a) => !(a.personId === personId && (a.weekStartDate.startsWith(weekKey) || (a.weekStartDate.includes("T") ? a.weekStartDate.slice(0, 10) : a.weekStartDate) === weekKey))
      );
      if (totalFromApi === null) return rest;
      return [...rest, { projectId, personId, weekStartDate: weekKey, hours: totalFromApi }];
    });
    const normWeek = (d: string) => (d.includes("T") ? d.slice(0, 10) : d);
    setActualMonthSplits((prev) => {
      const prevForWeek = prev.filter(
        (s) => s.personId === personId && normWeek(String(s.weekStartDate)) === weekKey
      );
      const rest = prev.filter(
        (s) => !(s.personId === personId && normWeek(String(s.weekStartDate)) === weekKey)
      );
      const byMonth = new Map(prevForWeek.map((s) => [s.monthKey, s] as const));
      for (const p of parts) {
        if (p.hours === null) {
          byMonth.delete(p.monthKey);
        } else {
          byMonth.set(p.monthKey, {
            projectId,
            personId,
            weekStartDate: weekKey,
            monthKey: p.monthKey,
            hours: roundToQuarter(p.hours),
          });
        }
      }
      return [...rest, ...Array.from(byMonth.values())];
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
      const editableWeeks = weeks.filter((w) => !isCompletedWeek(w, asOf));
      const payload = assignments.flatMap((a) =>
        editableWeeks.map((w) => {
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
      const updatedKeys = new Set(
        rows.map((r: { personId: string; weekStartDate: string | Date }) =>
          `${r.personId}|${normalize(r.weekStartDate)}`
        )
      );
      setPlanned((prev) => {
        const fromPrev = prev.filter(
          (p) => !updatedKeys.has(`${p.personId}|${p.weekStartDate.slice(0, 10)}`)
        );
        const fromRes = rows.map(
          (r: { projectId?: string; personId: string; weekStartDate: string | Date; hours: number }) => ({
            projectId: r.projectId ?? projectId,
            personId: r.personId,
            weekStartDate: normalize(r.weekStartDate),
            hours: Number(r.hours),
          })
        );
        return [...fromPrev, ...fromRes];
      });
    } finally {
      setSyncingPlan(false);
    }
  }

  /** Actuals grid only: focus split half (frame 0 | 1) or single-week input in the same column. */
  const focusActualGridInput = (row: number, col: number, frame: 0 | 1): boolean => {
    const split = document.querySelector<HTMLInputElement>(
      `input[data-resourcing-grid="actual"][data-resourcing-row="${row}"][data-resourcing-col="${col}"][data-resourcing-split-frame="${frame}"]`
    );
    if (split) {
      split.focus();
      return true;
    }
    const single = document.querySelector<HTMLInputElement>(
      `input[data-resourcing-grid="actual"][data-resourcing-row="${row}"][data-resourcing-col="${col}"]:not([data-resourcing-split-frame])`
    );
    if (single) {
      single.focus();
      return true;
    }
    return false;
  };

  const handlePlannedGridArrowNav = (e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const nextRow = e.key === "ArrowDown" ? row + 1 : row - 1;
    if (nextRow < 0) return;
    const target = document.querySelector<HTMLInputElement>(
      `input[data-resourcing-grid="planned"][data-resourcing-row="${nextRow}"][data-resourcing-col="${col}"]`
    );
    if (target) {
      e.preventDefault();
      target.focus();
    }
  };

  const handleActualGridArrowNav = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const nextRow = e.key === "ArrowDown" ? row + 1 : row - 1;
    if (nextRow < 0) return;
    const raw = e.currentTarget.getAttribute("data-resourcing-split-frame");
    const frame: 0 | 1 = raw === "1" ? 1 : 0;
    if (focusActualGridInput(nextRow, col, frame)) e.preventDefault();
  };

  const hoursInput = (
    personId: string,
    weekKey: string,
    value: number | null,
    isPlanned: boolean,
    isActual: boolean,
    rowIndex?: number,
    colIndex?: number,
    gridType?: "planned" | "actual"
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
      const personHolidays = getHolidaysForPersonWeek(ptoHolidayByWeek, weekKey, personId);
      const ptoEntries = getPtoForWeek(ptoHolidayByWeek, weekKey, personId);
      const personNameForPto =
        assignments.find((x) => x.personId === personId)?.person.name ?? "Unknown";
      const hasPersonHoliday = personHolidays.length > 0;
      const hasPersonPto = ptoEntries.length > 0;
      const shellBorder =
        hasPersonPto && hasPersonHoliday
          ? "border-[1.5px] border-dashed border-jred-300 dark:border-jred-500 border-t-2 border-t-solid border-t-jblue-500 dark:border-t-jblue-400"
          : hasPersonPto
            ? "border-[1.5px] border-dashed border-jred-300 dark:border-jred-500"
            : hasPersonHoliday
              ? "border border-surface-200 dark:border-dark-border border-t-2 border-t-jblue-500 dark:border-t-jblue-400"
              : "border border-surface-200 dark:border-dark-border";
      const showIndicatorTooltip = hasPersonHoliday || hasPersonPto;
      return (
        <td
          key={weekKey}
          className={`relative z-0 p-1 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${mismatch ? "bg-jred-100 dark:bg-jred-900/20" : ""} ${isCurrWeek ? "resourcing-current-week" : ""}`}
        >
          <div className="group relative min-h-[1.5rem]">
            <div className={showIndicatorTooltip ? "group/input-tip relative" : "relative"}>
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
                  onKeyDown={
                    gridType === "planned" && rowIndex != null && colIndex != null
                      ? (e) => handlePlannedGridArrowNav(e, rowIndex, colIndex)
                      : undefined
                  }
                  {...(gridType != null && rowIndex != null && colIndex != null
                    ? {
                        "data-resourcing-grid": gridType,
                        "data-resourcing-row": rowIndex,
                        "data-resourcing-col": colIndex,
                      }
                    : {})}
                  className={`w-full min-w-0 max-w-full rounded px-1 py-0.5 text-sm text-center box-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${shellBorder}`}
                />
              ) : (
                <span
                  className={`inline-block w-full text-center tabular-nums rounded px-1 py-0.5 ${shellBorder}`}
                >
                  {value ?? 0}
                </span>
              )}
              {showIndicatorTooltip ? (
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-max max-w-[16rem] -translate-x-1/2 rounded border border-surface-200 bg-white px-2 py-1.5 text-left text-xs text-surface-800 shadow-md group-hover/input-tip:block dark:border-dark-border dark:bg-dark-surface dark:text-surface-200"
                  role="tooltip"
                >
                  <div className="mb-1 font-medium text-surface-900 dark:text-white">
                    {formatWeekOfTitle(weekKey)}
                  </div>
                  {hasPersonHoliday ? (
                    <ul className="space-y-0.5">
                      {personHolidays.map((h) => (
                        <li key={h.label} className="flex items-start gap-1.5">
                          <span
                            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-jblue-500 dark:bg-jblue-400"
                            aria-hidden
                          />
                          <span>{h.label}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {hasPersonHoliday && hasPersonPto ? (
                    <div className="my-1 border-t border-surface-200 dark:border-dark-border" />
                  ) : null}
                  {hasPersonPto ? (
                    <div className="flex items-start gap-1.5">
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-jred-400 dark:bg-jred-500"
                        aria-hidden
                      />
                      <span>{`${firstNameFromDisplayName(personNameForPto)} on PTO`}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {canEdit && (
              <button
                type="button"
                tabIndex={-1}
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
          className={`relative z-0 p-1 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${missing ? "bg-amber-100 dark:bg-amber-900/20" : ""} ${varianceClass} ${isCurrWeek ? "resourcing-current-week" : ""}`}
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
                onKeyDown={
                  gridType === "actual" && rowIndex != null && colIndex != null
                    ? (e) => handleActualGridArrowNav(e, rowIndex, colIndex)
                    : undefined
                }
                {...(gridType != null && rowIndex != null && colIndex != null
                  ? {
                      "data-resourcing-grid": gridType,
                      "data-resourcing-row": rowIndex,
                      "data-resourcing-col": colIndex,
                    }
                  : {})}
                placeholder="—"
                className="w-full min-w-0 max-w-full border rounded px-1 py-0.5 text-sm text-center box-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ) : (
              <span className="inline-block w-full text-center tabular-nums">{value ?? "—"}</span>
            )}
            {canEdit && (
              <button
                type="button"
                tabIndex={-1}
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
        className={`relative z-0 p-1 border text-center border-surface-200 dark:border-dark-border ${mismatch ? "bg-jred-100 dark:bg-jred-900/20" : ""} ${isCurrWeek ? "resourcing-current-week" : ""}`}
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
    const isCurrWeek = isCurrentWeek(weekDate);
    const val1 = getActualByMonth(personId, weekKey, monthKeys[0]!);
    const val2 = getActualByMonth(personId, weekKey, monthKeys[1]!);
    const weekTotal = (val1 ?? 0) + (val2 ?? 0);
    const plannedVal = getPlanned(personId, weekKey);
    const missing = hasMissingActualsSplitWeek(
      weekDate,
      plannedVal,
      val1,
      val2,
      monthKeys[0]!,
      monthKeys[1]!,
      asOf,
      undefined,
      {
        hasRowFirst: hasMonthSplitRow(personId, weekKey, monthKeys[0]!),
        hasRowSecond: hasMonthSplitRow(personId, weekKey, monthKeys[1]!),
      }
    );
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
        className={`relative z-0 p-1 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${missing ? "bg-amber-100 dark:bg-amber-900/20" : ""} ${varianceClass} ${isCurrWeek ? "resourcing-current-week" : ""}`}
      >
        <div className="group relative flex items-center justify-center gap-1 min-h-[1.5rem]">
          <span className="tabular-nums">{val1 != null || val2 != null ? weekTotal : "—"}</span>
          <button
            type="button"
            tabIndex={-1}
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
            tabIndex={-1}
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
    rowIndex: number,
    colIndex: number,
    onCollapse?: () => void
  ) => {
    const weekDate = new Date(weekKey);
    const completed = isCompletedWeek(weekDate, asOf);
    const isCurrWeek = isCurrentWeek(weekDate);
    /** First month: editable after that calendar month ends (UTC), for completed weeks or the current week (isFutureWeek is true for the in-progress week because asOf is end of previous Sunday). Second month: same as non-split actuals (completed week, not current). */
    const editableFirst =
      canEdit &&
      (!isFutureWeek(weekDate, asOf) || isCurrentWeek(weekDate)) &&
      isPastLastUtcDayOfMonthInWeek(weekDate, monthKeys[0]!);
    const editableSecond = canEdit && completed && !isCurrWeek;
    const val1 = getActualByMonth(personId, weekKey, monthKeys[0]!);
    const val2 = getActualByMonth(personId, weekKey, monthKeys[1]!);
    const weekTotal = (val1 ?? 0) + (val2 ?? 0);
    const plannedVal = getPlanned(personId, weekKey);
    const missing = hasMissingActualsSplitWeek(
      weekDate,
      plannedVal,
      val1,
      val2,
      monthKeys[0]!,
      monthKeys[1]!,
      asOf,
      undefined,
      {
        hasRowFirst: hasMonthSplitRow(personId, weekKey, monthKeys[0]!),
        hasRowSecond: hasMonthSplitRow(personId, weekKey, monthKeys[1]!),
      }
    );
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
      const q1: number | null =
        str === ""
          ? null
          : (() => {
              const num = parseFloat(str);
              const h1 = Number.isNaN(num) ? 0 : Math.max(0, num);
              return roundToQuarter(h1);
            })();
      if (val2 == null) {
        void updateActualSplit(personId, weekKey, [{ monthKey: monthKeys[0]!, hours: q1 }]);
      } else {
        void updateActualSplit(personId, weekKey, [
          { monthKey: monthKeys[0]!, hours: q1 },
          { monthKey: monthKeys[1]!, hours: roundToQuarter(val2) },
        ]);
      }
      setEditingActual(null);
    };
    const handleBlur2 = (e: React.FocusEvent<HTMLInputElement>) => {
      const str = e.target.value.trim();
      const q2: number | null =
        str === ""
          ? null
          : (() => {
              const num = parseFloat(str);
              const h2 = Number.isNaN(num) ? 0 : Math.max(0, num);
              return roundToQuarter(h2);
            })();
      if (val1 == null) {
        void updateActualSplit(personId, weekKey, [{ monthKey: monthKeys[1]!, hours: q2 }]);
      } else {
        void updateActualSplit(personId, weekKey, [
          { monthKey: monthKeys[0]!, hours: roundToQuarter(val1) },
          { monthKey: monthKeys[1]!, hours: q2 },
        ]);
      }
      setEditingActual(null);
    };
    return (
      <td
        key={weekKey}
        className={`relative z-0 p-0.5 border overflow-hidden min-w-0 text-center border-surface-200 dark:border-dark-border ${missing ? "bg-amber-100 dark:bg-amber-900/20" : ""} ${varianceClass} ${isCurrWeek ? "resourcing-current-week" : ""}`}
      >
        <div className="group relative flex flex-col gap-0.5 min-h-[2rem]">
          {onCollapse && (
            <div className="flex justify-center">
              <button
                type="button"
                tabIndex={-1}
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
            {editableFirst ? (
              <input
                type="text"
                inputMode="decimal"
                value={display1}
                onFocus={() => setEditingActual({ personId, weekKey, monthKey: monthKeys[0], str: val1 != null ? String(val1) : "" })}
                onChange={(e) => setEditingActual((prev) => (prev?.personId === personId && prev?.weekKey === weekKey && prev?.monthKey === monthKeys[0] ? { ...prev, str: e.target.value } : { personId, weekKey, monthKey: monthKeys[0], str: e.target.value }))}
                onBlur={handleBlur1}
                onKeyDown={(e) => handleActualGridArrowNav(e, rowIndex, colIndex)}
                data-resourcing-grid="actual"
                data-resourcing-row={rowIndex}
                data-resourcing-col={colIndex}
                data-resourcing-split-frame="0"
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
            {editableSecond ? (
              <input
                type="text"
                inputMode="decimal"
                value={display2}
                onFocus={() => setEditingActual({ personId, weekKey, monthKey: monthKeys[1], str: val2 != null ? String(val2) : "" })}
                onChange={(e) => setEditingActual((prev) => (prev?.personId === personId && prev?.weekKey === weekKey && prev?.monthKey === monthKeys[1] ? { ...prev, str: e.target.value } : { personId, weekKey, monthKey: monthKeys[1], str: e.target.value }))}
                onBlur={handleBlur2}
                onKeyDown={(e) => handleActualGridArrowNav(e, rowIndex, colIndex)}
                data-resourcing-grid="actual"
                data-resourcing-row={rowIndex}
                data-resourcing-col={colIndex}
                data-resourcing-split-frame="1"
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
            tabIndex={-1}
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
      {showRangeControls && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-body-sm text-surface-600 dark:text-surface-300">
            Showing weeks <span className="font-medium tabular-nums">{weekRange.fromWeek}</span> →{" "}
            <span className="font-medium tabular-nums">{weekRange.toWeek}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftRange("earlier")}
              disabled={!canLoadEarlier}
              className="inline-flex h-9 items-center justify-center rounded border border-surface-200 bg-white px-3 text-surface-700 shadow-sm transition hover:bg-surface-50 hover:text-surface-900 disabled:pointer-events-none disabled:opacity-50 dark:border-dark-border dark:bg-dark-surface dark:text-surface-200 dark:hover:bg-dark-raised dark:hover:text-white"
            >
              Load earlier weeks
            </button>
            <button
              type="button"
              onClick={() => shiftRange("later")}
              disabled={!canLoadLater}
              className="inline-flex h-9 items-center justify-center rounded border border-surface-200 bg-white px-3 text-surface-700 shadow-sm transition hover:bg-surface-50 hover:text-surface-900 disabled:pointer-events-none disabled:opacity-50 dark:border-dark-border dark:bg-dark-surface dark:text-surface-200 dark:hover:bg-dark-raised dark:hover:text-white"
            >
              Load later weeks
            </button>
          </div>
        </div>
      )}
      {scrollState.scrollable && (
        <div className="flex items-center gap-2" role="group" aria-label="Scroll weeks">
          <button
            type="button"
            aria-label="Scroll left"
            disabled={!scrollState.canScrollLeft}
            onClick={() => scrollHorizontal("left")}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-surface-200 bg-white text-surface-700 shadow-sm transition hover:bg-surface-50 hover:text-surface-900 disabled:pointer-events-none disabled:opacity-50 dark:border-dark-border dark:bg-dark-surface dark:text-surface-200 dark:hover:bg-dark-raised dark:hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            disabled={!scrollState.canScrollRight}
            onClick={() => scrollHorizontal("right")}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-surface-200 bg-white text-surface-700 shadow-sm transition hover:bg-surface-50 hover:text-surface-900 disabled:pointer-events-none disabled:opacity-50 dark:border-dark-border dark:bg-dark-surface dark:text-surface-200 dark:hover:bg-dark-raised dark:hover:text-white"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}
      <div ref={scrollContainerRef} className="overflow-x-auto overscroll-x-contain">
        <div
          className={`inline-block align-top ${actualsCollapsed ? "space-y-2" : "space-y-6"}`}
          style={{ paddingRight: "2rem", minWidth: tableWrapperMinWidth }}
        >
        <div className="rounded-lg border border-surface-200 dark:border-dark-border overflow-clip shadow-card-light dark:shadow-card-dark bg-white dark:bg-dark-surface" style={{ minWidth: tableWrapperMinWidth, paddingRight: gridCardEndPadding }}>
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
                <th
                  colSpan={4}
                  className={`p-1 border text-left text-xs text-surface-600 dark:text-surface-400 ${sticky} ${stickyOpaqueHead} ${stickyEdge} border-surface-200 dark:border-dark-border`}
                  style={{ left: 0, width: stickyColsWidth, minWidth: stickyColsWidth }}
                >
                  Holiday
                </th>
                {weeks.map((w) => {
                  const wk = formatWeekKey(w);
                  const holidays = getHolidaysForWeek(ptoHolidayByWeek, wk);
                  return (
                    <th
                      key={`hol-${wk}`}
                      className={`p-1 border text-center align-middle w-16 border-surface-200 dark:border-dark-border ${currentWeekColClass(w)}`}
                    >
                      {holidays.length > 0 ? (
                        <div className="group/hol-tip relative flex min-h-[1.25rem] items-center justify-center py-0.5">
                          <div className="relative inline-flex">
                            <span className="inline-flex h-4 shrink-0 items-center justify-center rounded-full bg-jblue-500 px-2 text-[8px] font-bold uppercase leading-none tracking-wide text-white dark:bg-jblue-400">
                              HOL
                            </span>
                            <div
                              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-max max-w-[14rem] -translate-x-1/2 rounded border border-surface-200 bg-white px-2 py-1.5 text-left text-xs text-surface-800 shadow-md group-hover/hol-tip:block dark:border-dark-border dark:bg-dark-surface dark:text-surface-200"
                              role="tooltip"
                            >
                              <ul className="space-y-1">
                                {holidays.map((h) => (
                                  <li key={h.label} className="flex items-center gap-1.5">
                                    <span
                                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-jblue-500 dark:bg-jblue-400"
                                      aria-hidden
                                    />
                                    {h.label}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
              <tr className={stickyBgHead}>
                <th
                  colSpan={4}
                  className={`p-1 border text-left text-xs text-surface-600 dark:text-surface-400 ${sticky} ${stickyOpaqueHead} ${stickyEdge} border-surface-200 dark:border-dark-border`}
                  style={{ left: 0, width: stickyColsWidth, minWidth: stickyColsWidth }}
                >
                  PTO
                </th>
                {weeks.map((w) => {
                  const wk = formatWeekKey(w);
                  const ptoEntries = getPtoForWeek(ptoHolidayByWeek, wk);
                  const byPerson = new Map<string, PtoHolidayEntry[]>();
                  for (const e of ptoEntries) {
                    const arr = byPerson.get(e.personId) ?? [];
                    arr.push(e);
                    byPerson.set(e.personId, arr);
                  }
                  const peopleWithPto = [...byPerson.entries()]
                    .map(([pid, ents]) => {
                      const name =
                        sortedAssignments.find((x) => x.personId === pid)?.person.name ?? pid;
                      return { personId: pid, name, entries: ents };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
                  const hasPto = peopleWithPto.length > 0;
                  return (
                    <th
                      key={`pto-${wk}`}
                      className={`p-1 border text-center align-middle text-xs whitespace-nowrap w-16 border-surface-200 dark:border-dark-border ${currentWeekColClass(w)}`}
                    >
                      {hasPto ? (
                        <div className="group/pto-tip relative flex min-h-[1.25rem] items-center justify-center py-0.5">
                          <div className="relative inline-flex">
                            <span className="inline-flex h-4 shrink-0 items-center justify-center rounded-full border border-jred-300 bg-jred-50 px-2 text-[8px] font-bold uppercase leading-none tracking-wide text-jred-900 dark:border-jred-600 dark:bg-jred-900/30 dark:text-jred-100">
                              PTO
                            </span>
                            <div
                              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-max max-w-[14rem] -translate-x-1/2 rounded border border-surface-200 bg-white px-2 py-1.5 text-left text-xs text-surface-800 shadow-md group-hover/pto-tip:block dark:border-dark-border dark:bg-dark-surface dark:text-surface-200"
                              role="tooltip"
                            >
                              <ul className="space-y-1">
                                {peopleWithPto.map((p) => {
                                  const dayCount = p.entries.length;
                                  const hoursPartial = p.entries
                                    .filter((e) => e.isPartial)
                                    .reduce((s, e) => s + (e.hours ?? 0), 0);
                                  const line = p.entries.some((e) => e.isPartial)
                                    ? `${p.name}: partial PTO (${hoursPartial}h this week)`
                                    : `${p.name}: ${dayCount} day(s) PTO`;
                                  return (
                                    <li key={p.personId} className="flex items-start gap-1.5">
                                      <span
                                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-jred-400 dark:bg-jred-500"
                                        aria-hidden
                                      />
                                      <span>{line}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </th>
                  );
                })}
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
                    className={`p-1 border text-center text-xs whitespace-nowrap w-16 ${currentWeekColClass(w)}`}
                    title={formatWeekKey(w)}
                    aria-current={isCurrentWeek(w) ? "date" : undefined}
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
                  {weeks.map((w, weekIdx) => {
                    const k = formatWeekKey(w);
                    return hoursInput(
                      a.personId,
                      k,
                      getPlanned(a.personId, k),
                      true,
                      false,
                      idx,
                      weekIdx,
                      "planned"
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
                    <td key={k} className={`p-2 border text-center tabular-nums ${planningFloatTotalVarianceClass(k)} ${currentWeekColClass(w)}`}>
                      {formatTotal(plannedWeekTotal(k))}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="rounded-lg border border-surface-200 dark:border-dark-border overflow-clip shadow-card-light dark:shadow-card-dark bg-white dark:bg-dark-surface" style={{ minWidth: tableWrapperMinWidth, paddingRight: gridCardEndPadding }}>
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
                  className={`relative p-2 border text-left ${sticky} ${stickyOpaqueBody} ${stickyEdge} border-surface-200 dark:border-dark-border`}
                  style={{ left: 0, width: stickyColsWidth, minWidth: stickyColsWidth }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pr-10">
                    <h3 className="text-display-md font-bold text-surface-900 dark:text-white">
                      2. Weekly Actuals Grid
                    </h3>
                    {!actualsCollapsed && hasAnySplitWeekColumn && sortedAssignments.length > 0 ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          id="weekly-actuals-split-weeks-hint"
                          className="text-xs text-surface-500 dark:text-surface-400 leading-none whitespace-nowrap"
                          title="Weeks that span two calendar months"
                        >
                          Split weeks
                        </span>
                        <div
                          className="inline-flex shrink-0 overflow-hidden rounded border border-surface-200 bg-surface-50 dark:border-dark-border dark:bg-dark-raised/80"
                          role="group"
                          aria-labelledby="weekly-actuals-split-weeks-hint"
                        >
                          <button
                            type="button"
                            onClick={expandAllSplitWeeks}
                            disabled={splitWeekBulkState.allExpanded}
                            aria-label="Expand all month-split week cells"
                            title="Show both months for every split week"
                            className="px-2 py-0.5 text-xs font-medium text-surface-700 transition enabled:hover:bg-white enabled:hover:text-surface-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-surface-200 enabled:dark:hover:bg-dark-surface dark:disabled:opacity-35 border-r border-surface-200 dark:border-dark-border focus-visible:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jblue-400"
                          >
                            Expand
                          </button>
                          <button
                            type="button"
                            onClick={collapseAllSplitWeeks}
                            disabled={splitWeekBulkState.noneExpanded}
                            aria-label="Collapse all month-split week cells"
                            title="Roll up to one value per split week"
                            className="px-2 py-0.5 text-xs font-medium text-surface-700 transition enabled:hover:bg-white enabled:hover:text-surface-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-surface-200 enabled:dark:hover:bg-dark-surface dark:disabled:opacity-35 focus-visible:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jblue-400"
                          >
                            Collapse
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActualsCollapsed((c) => !c)}
                    aria-expanded={!actualsCollapsed}
                    aria-label={actualsCollapsed ? "Show weekly actuals" : "Hide weekly actuals"}
                    title={actualsCollapsed ? "Show weekly actuals" : "Hide weekly actuals"}
                    className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-500 transition hover:bg-surface-100 hover:text-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2 dark:text-surface-400 dark:hover:bg-dark-raised dark:hover:text-surface-100"
                  >
                    {actualsCollapsed ? (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </th>
                <th colSpan={weeks.length} className="p-0 border-0 bg-transparent" aria-hidden />
              </tr>
              {!actualsCollapsed ? (
                <tr className={stickyBgHead}>
                  <th className={`p-2 border ${sticky} ${stickyOpaqueHead}`} style={{ left: 0 }} aria-hidden />
                  <th className={`p-2 border text-left ${sticky} ${stickyOpaqueHead}`} style={{ left: colReady }}>Person</th>
                  <th className={`p-2 border text-left ${sticky} ${stickyOpaqueHead}`} style={{ left: leftRole }}>Role</th>
                  <th className={`p-2 text-center ${sticky} ${stickyOpaqueFoot} resourcing-total-header`} style={{ left: leftTotal }}>Total</th>
                  {weeks.map((w) => (
                    <th
                      key={formatWeekKey(w)}
                      className={`p-1 border text-center text-xs whitespace-nowrap w-16 ${currentWeekColClass(w)}`}
                      title={formatWeekKey(w)}
                      aria-current={isCurrentWeek(w) ? "date" : undefined}
                    >
                      {formatWeekShort(w)}
                    </th>
                  ))}
                </tr>
              ) : null}
            </thead>
            {!actualsCollapsed ? (
              <>
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
                      {weeks.map((w, weekIdx) => {
                        const k = formatWeekKey(w);
                        const monthKeys = getMonthKeysForWeek(w);
                        if (monthKeys.length === 2) {
                          const expanded = expandedSplitCells.has(splitCellKey(a.personId, k));
                          if (expanded) {
                            return actualsSplitCell(
                              a.personId,
                              k,
                              monthKeys as [string, string],
                              idx,
                              weekIdx,
                              () => setSplitCellExpanded(a.personId, k, false)
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
                          true,
                          idx,
                          weekIdx,
                          "actual"
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
                        <td key={k} className={`p-2 border text-center tabular-nums ${actualsTotalVarianceClass(k)} ${currentWeekColClass(w)}`}>
                          {formatTotal(actualWeekTotal(k))}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </>
            ) : null}
          </table>
        </div>

        <div className="rounded-lg border border-surface-200 dark:border-dark-border overflow-clip shadow-card-light dark:shadow-card-dark bg-white dark:bg-dark-surface" style={{ minWidth: tableWrapperMinWidth, paddingRight: gridCardEndPadding }}>
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
                      className={`p-1 border text-center text-xs whitespace-nowrap w-16 border-surface-200 dark:border-dark-border ${currentWeekColClass(w)}`}
                      title={k}
                      aria-current={isCurrentWeek(w) ? "date" : undefined}
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
                    <td key={k} className={`p-2 border text-center tabular-nums ${planningFloatTotalVarianceClass(k)} ${currentWeekColClass(w)}`}>
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
