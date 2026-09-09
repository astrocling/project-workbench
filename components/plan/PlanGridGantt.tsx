"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Diamond,
  Flag,
  GripVertical,
  ListTodo,
  PenLine,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { expandYmdRange, isWeekendYmd } from "@/lib/plan/businessDays";
import {
  resolvePlanDateCellEdit,
  type PlanDateEditEvent,
} from "@/lib/plan/dateInput";
import {
  applyGanttDrag,
  positionPercent,
  widthPercent,
  ymdAtClientX,
  type GanttDragKind,
} from "@/lib/plan/positioning";
import {
  getPlanAxisRange,
  getPlanScale,
  getScaleColumns,
  type PlanScale,
  type ScaleColumn,
} from "@/lib/plan/scale";
import type { PlanItemJson, PlanJson, PlanPhaseJson } from "@/lib/plan/serialize";
import { flattenVisibleRows, type PlanVisibleRow } from "@/lib/plan/tree";
import {
  resolveItemDrop,
  type ItemDropTarget,
} from "@/lib/plan/itemDrop";
import { resolvePhaseDrop, type PhaseDropTarget } from "@/lib/plan/phaseDrop";
import {
  isPointType,
  PLAN_ITEM_STATUSES,
  PLAN_ITEM_TYPES,
  type PlanItemStatus,
  type PlanItemType,
  type PlanMeetingStatus,
} from "@/lib/plan/types";
import { defaultShowOnReports } from "@/lib/plan/reportVisibility";
import {
  fitGanttColWidth,
  formatCompactYmd,
  readableGanttColWidth,
} from "@/lib/plan/ganttColWidth";

const MEETING_VIOLET = "#6d28d9";
const ROW_HEIGHT = 36;
const VIEW_GRID_WIDTH = 400;
const ACTIONS_COL = 52;
const FULL_GRID_INNER_WIDTH = 906 + ACTIONS_COL;
const EXPAND_COL = 28;
const NAME_COL = 220;
const TYPE_COL = 160;
const DATE_COL = 140;
const DURATION_COL = 56;
const REPORT_CHECK_COL = 32;
const STATUS_COL = 130;
const COMPACT_DATE_COL = 88;
const COMPACT_STATUS_COL = 72;
const DROP_EDGE_PX = 10;
const PLAN_ITEM_DRAG = "text/plan-item";
const PLAN_PHASE_DRAG = "text/plan-phase";
const DEFAULT_PHASE_COLOR = "#1941FA";
const PHASE_COLORS = [
  { value: "#1941FA", label: "Blue" },
  { value: "#15803d", label: "Green" },
  { value: "#b45309", label: "Amber" },
  { value: "#0f766e", label: "Teal" },
  { value: "#475569", label: "Slate" },
  { value: "#6d28d9", label: "Violet" },
] as const;

function normalizeHexColor(value: string): string {
  const hex = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    const [, r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return DEFAULT_PHASE_COLOR.toLowerCase();
}

const INPUT_CLASS =
  "block w-full h-7 px-2 rounded text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100";
const ROW_ICON_BTN =
  "p-0.5 rounded text-surface-400 hover:text-surface-800 hover:bg-surface-100 dark:hover:text-surface-100 dark:hover:bg-dark-muted disabled:opacity-40 disabled:cursor-not-allowed";
const ROW_ACTIONS_REVEAL =
  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100";

const ITEM_STATUS_LABELS: Record<PlanItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

const ITEM_TYPE_LABELS: Record<PlanItemType, string> = {
  task: "Task",
  milestone: "Milestone",
  sign_off: "Sign-off",
  hard_deadline: "Hard deadline",
  waiting_on_client: "Waiting on client",
  meeting: "Meeting",
};

const ITEM_TYPE_ICONS: Record<PlanItemType, LucideIcon> = {
  task: ListTodo,
  milestone: Diamond,
  sign_off: PenLine,
  hard_deadline: Flag,
  waiting_on_client: Clock,
  meeting: Calendar,
};

type RowKey = string;
type ZoomMode = "fit" | PlanScale;
type GridMode = "view" | "edit";
type GridDropHover =
  | ItemDropTarget
  | { kind: "phase-before"; phaseId: string }
  | { kind: "phase-append" };

function dragTypes(event: DragEvent): string[] {
  return Array.from(event.dataTransfer.types);
}

function droppedKind(event: DragEvent): "item" | "phase" | null {
  const types = dragTypes(event);
  if (types.includes(PLAN_PHASE_DRAG)) return "phase";
  if (types.includes(PLAN_ITEM_DRAG)) return "item";
  const plain = event.dataTransfer.getData("text/plain");
  if (plain.startsWith("phase:")) return "phase";
  if (plain) return "item";
  return null;
}

function isPhaseDrag(event: DragEvent): boolean {
  return dragTypes(event).includes(PLAN_PHASE_DRAG);
}

function isItemDrag(event: DragEvent): boolean {
  return dragTypes(event).includes(PLAN_ITEM_DRAG);
}

function readDraggedId(event: DragEvent, mime: string): string {
  const raw = event.dataTransfer.getData(mime) || event.dataTransfer.getData("text/plain");
  return raw.replace(/^phase:/, "");
}

function nextSiblingInsertBeforeId(items: PlanItemJson[], item: PlanItemJson): string | null {
  const siblings = items
    .filter(
      (candidate) =>
        candidate.phaseId === item.phaseId && candidate.parentItemId === item.parentItemId
    )
    .slice()
    .sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate));
  const index = siblings.findIndex((candidate) => candidate.id === item.id);
  return siblings[index + 1]?.id ?? null;
}

function compactDateLabel(item: PlanItemJson): { text: string; title: string } {
  const start = formatCompactYmd(item.startDate);
  if (isPointType(item.type, item.meetingStatus) || item.startDate === item.endDate) {
    return { text: start, title: item.startDate };
  }
  return {
    text: `${start}–${formatCompactYmd(item.endDate)}`,
    title: `${item.startDate} – ${item.endDate}`,
  };
}

function itemTypeTitle(item: PlanItemJson): string {
  const label = ITEM_TYPE_LABELS[item.type];
  if (item.type === "meeting" && item.meetingStatus) {
    return `${label} (${item.meetingStatus})`;
  }
  return label;
}

type DisplayRow = { kind: "data"; row: PlanVisibleRow } | { kind: "add-phase" };

function rowKey(row: PlanVisibleRow): RowKey {
  return row.kind === "phase" ? `phase:${row.phase.id}` : `item:${row.item!.id}`;
}

function phaseDateRange(phase: { items: PlanItemJson[] }): { start: string | null; end: string | null } {
  if (phase.items.length === 0) return { start: null, end: null };
  let start = phase.items[0].startDate;
  let end = phase.items[0].endDate;
  for (const item of phase.items) {
    if (item.startDate < start) start = item.startDate;
    if (item.endDate > end) end = item.endDate;
  }
  return { start, end };
}

function calendarDays(start: string, end: string): number {
  return expandYmdRange(start, end).length;
}

function buildItemPatch(
  item: PlanItemJson,
  changes: Partial<{
    type: PlanItemType;
    label: string;
    startDate: string;
    endDate: string;
    meetingStatus: PlanMeetingStatus | null;
    scheduledTime: string | null;
    parentItemId: string | null;
    phaseId: string;
    showOnReports: boolean;
    reportLabel: string | null;
    status: PlanItemStatus;
  }>
): Record<string, unknown> {
  const type = changes.type ?? item.type;
  let meetingStatus =
    changes.meetingStatus !== undefined ? changes.meetingStatus : item.meetingStatus;
  if (type === "meeting" && !meetingStatus) meetingStatus = "assumed";

  const startDate = changes.startDate ?? item.startDate;
  let endDate = changes.endDate ?? item.endDate;

  if (type !== "meeting" && changes.type !== undefined) {
    meetingStatus = null;
  }

  if (isPointType(type, meetingStatus)) {
    endDate = startDate;
  }

  return {
    type,
    label: changes.label ?? item.label,
    startDate,
    endDate,
    meetingStatus: type === "meeting" ? meetingStatus : null,
    scheduledTime:
      changes.scheduledTime !== undefined ? changes.scheduledTime : item.scheduledTime,
    ...(changes.parentItemId !== undefined ? { parentItemId: changes.parentItemId } : {}),
    ...(changes.phaseId !== undefined ? { phaseId: changes.phaseId } : {}),
    ...(changes.showOnReports !== undefined ? { showOnReports: changes.showOnReports } : {}),
    ...(changes.reportLabel !== undefined ? { reportLabel: changes.reportLabel } : {}),
    ...(changes.status !== undefined ? { status: changes.status } : {}),
  };
}

/**
 * A date cell that holds its own draft value.
 *
 * Native date inputs report a value on every keystroke (empty mid-segment, years like `0002`
 * while `2026` is typed), so only complete, changed dates are saved. The cell remembers the date
 * it last handed to `onCommit`, so a completed edit saves exactly once whether it is finished by
 * `change`, by `blur`, or by both. The input is uncontrolled and the stored `value` is written
 * into it only while it is not focused, which keeps a refetch (from this save or another editor's)
 * from pulling the value out from under an edit in progress — and, since nothing remounts the
 * input, arrow-key stepping keeps its focus and caret.
 */
export function DateCell({
  value,
  onCommit,
  className = INPUT_CLASS,
}: {
  value: string;
  onCommit: (nextValue: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);
  const lastSubmittedRef = useRef<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || focusedRef.current) return;
    lastSubmittedRef.current = null;
    if (input.value !== value) input.value = value;
  }, [value]);

  function handleEdit(event: PlanDateEditEvent, inputValue: string) {
    const decision = resolvePlanDateCellEdit({
      event,
      inputValue,
      externalValue: value,
      lastSubmitted: lastSubmittedRef.current,
    });
    lastSubmittedRef.current = decision.nextLastSubmitted;
    if (decision.restore != null && inputRef.current) {
      inputRef.current.value = decision.restore;
    }
    if (decision.save != null) onCommit(decision.save);
  }

  return (
    <input
      ref={inputRef}
      type="date"
      defaultValue={value}
      className={className}
      onClick={(e) => e.stopPropagation()}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => handleEdit("change", e.target.value)}
      onBlur={(e) => {
        focusedRef.current = false;
        handleEdit("blur", e.target.value);
      }}
    />
  );
}

type PlanGridGanttProps = {
  plan: PlanJson;
  canEdit: boolean;
  apiBase: string;
  onMutated: () => void;
};

export function PlanGridGantt({ plan, canEdit, apiBase, onMutated }: PlanGridGanttProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [selectedKey, setSelectedKey] = useState<RowKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [gridMode, setGridMode] = useState<GridMode>("view");
  const [paneWidth, setPaneWidth] = useState(0);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  const nameInputRefs = useRef(new Map<string, HTMLInputElement>());
  const ganttAxisRef = useRef<HTMLDivElement>(null);
  const ganttDragRef = useRef<{
    item: PlanItemJson;
    kind: GanttDragKind;
    originStart: string;
    originEnd: string;
    originYmd: string;
    point: boolean;
  } | null>(null);
  const [datePreview, setDatePreview] = useState<{
    itemId: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const datePreviewRef = useRef(datePreview);
  datePreviewRef.current = datePreview;
  const [dropHover, setDropHover] = useState<GridDropHover | null>(null);

  const axisRange = useMemo(() => getPlanAxisRange(plan), [plan]);
  const scale = useMemo(
    () =>
      zoomMode === "fit"
        ? getPlanScale(axisRange.startYmd, axisRange.endYmd)
        : zoomMode,
    [axisRange, zoomMode]
  );
  const columns = useMemo(
    () => getScaleColumns(axisRange.startYmd, axisRange.endYmd, scale),
    [axisRange, scale]
  );
  const colWidth =
    zoomMode === "fit"
      ? fitGanttColWidth(paneWidth, columns.length, scale)
      : readableGanttColWidth(scale);
  const editing = canEdit && gridMode === "edit";
  const leftGridWidth = gridMode === "view" ? VIEW_GRID_WIDTH : FULL_GRID_INNER_WIDTH;
  const ganttWidth = columns.length * colWidth;
  const axisWidened =
    axisRange.startYmd < plan.kickoffDate || axisRange.endYmd > plan.endDate;

  const rows = useMemo(
    () => flattenVisibleRows(plan.phases, collapsedIds),
    [plan.phases, collapsedIds]
  );
  const displayRows = useMemo<DisplayRow[]>(() => {
    const output: DisplayRow[] = rows.map((row) => ({ kind: "data", row }));
    if (editing) output.push({ kind: "add-phase" });
    return output;
  }, [editing, rows]);

  const allItems = useMemo(
    () => plan.phases.flatMap((p) => p.items),
    [plan.phases]
  );

  const selectedRow = useMemo(
    () => (selectedKey ? rows.find((r) => rowKey(r) === selectedKey) : undefined),
    [rows, selectedKey]
  );

  const ymdFromPointer = useCallback(
    (clientX: number) => {
      const axis = ganttAxisRef.current;
      if (!axis) return null;
      const rect = axis.getBoundingClientRect();
      return ymdAtClientX(
        clientX,
        rect.left,
        rect.width,
        axisRange.startYmd,
        axisRange.endYmd
      );
    },
    [axisRange.endYmd, axisRange.startYmd]
  );

  useEffect(() => {
    const pane = rightScrollRef.current;
    if (!pane) return;

    const updateWidth = () => setPaneWidth(pane.clientWidth);
    const handleWheel = (event: WheelEvent) => {
      if (
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) {
        event.preventDefault();
        pane.scrollLeft +=
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY;
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(pane);
    pane.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      observer.disconnect();
      pane.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    if (!pendingFocusId) return;
    const input = nameInputRefs.current.get(pendingFocusId);
    if (!input) return;
    input.focus();
    input.select();
    setPendingFocusId(null);
  }, [pendingFocusId, plan.phases]);

  const registerNameInput = useCallback(
    (id: string, input: HTMLInputElement | null) => {
      if (input) nameInputRefs.current.set(id, input);
      else nameInputRefs.current.delete(id);
    },
    []
  );

  const syncVerticalScroll = useCallback((source: HTMLDivElement, target: HTMLDivElement) => {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    target.scrollTop = source.scrollTop;
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  }, []);

  const syncHeaderHorizontal = useCallback((scrollLeft: number) => {
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = scrollLeft;
  }, []);

  async function apiCall(
    url: string,
    method: string,
    body?: Record<string, unknown>,
    options?: { indicateBusy?: boolean }
  ): Promise<unknown | null> {
    const indicateBusy = options?.indicateBusy !== false;
    if (indicateBusy) setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "Request failed");
        return null;
      }
      onMutated();
      return json;
    } finally {
      if (indicateBusy) setBusy(false);
    }
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchItem(
    item: PlanItemJson,
    changes: Partial<{
      type: PlanItemType;
      label: string;
      startDate: string;
      endDate: string;
      meetingStatus: PlanMeetingStatus | null;
      scheduledTime: string | null;
      parentItemId: string | null;
      showOnReports: boolean;
      reportLabel: string | null;
      status: PlanItemStatus;
    }>
  ) {
    const body = buildItemPatch(item, changes);
    return apiCall(`${apiBase}/items/${item.id}`, "PATCH", body);
  }

  /**
   * Date cells send only the date they changed. `PATCH` merges against the stored row (and derives
   * a point item's end date from its type), so a date save that races another edit of the same item
   * cannot resend the label, type, or other date this render's props were holding.
   */
  async function patchItemDates(
    item: PlanItemJson,
    dates: { startDate?: string; endDate?: string }
  ) {
    return apiCall(`${apiBase}/items/${item.id}`, "PATCH", dates, { indicateBusy: false });
  }

  function clearDropHover() {
    setDropHover(null);
  }

  function acceptItemDrag(event: DragEvent) {
    if (!isItemDrag(event)) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    return true;
  }

  function acceptPhaseDrag(event: DragEvent) {
    if (!isPhaseDrag(event)) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    return true;
  }

  async function handleItemDrop(event: DragEvent, target: ItemDropTarget) {
    event.preventDefault();
    const draggedId = readDraggedId(event, PLAN_ITEM_DRAG);
    setDropHover(null);
    if (droppedKind(event) !== "item" || !draggedId) return;
    const result = resolveItemDrop(allItems, draggedId, target);
    if (!result) return;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await apiCall(`${apiBase}/items/${result.placement.itemId}`, "PATCH", {
      phaseId: result.placement.phaseId,
      parentItemId: result.placement.parentItemId,
      insertBeforeItemId: result.placement.insertBeforeItemId,
    });
  }

  async function handlePhaseDrop(event: DragEvent, target: PhaseDropTarget) {
    event.preventDefault();
    const draggedId = readDraggedId(event, PLAN_PHASE_DRAG);
    setDropHover(null);
    if (droppedKind(event) !== "phase" || !draggedId) return;
    const result = resolvePhaseDrop(
      plan.phases.map((phase) => ({ id: phase.id, order: phase.order })),
      draggedId,
      target
    );
    if (!result) return;
    await apiCall(`${apiBase}/phases/${result.phaseId}`, "PATCH", {
      insertBeforePhaseId: result.insertBeforePhaseId,
    });
  }

  async function finishGanttDrag(commit: boolean) {
    const session = ganttDragRef.current;
    const preview = datePreviewRef.current;
    ganttDragRef.current = null;
    setDatePreview(null);
    if (!commit || !session || !preview || preview.itemId !== session.item.id) return;
    if (
      preview.startDate === session.originStart &&
      preview.endDate === session.originEnd
    ) {
      return;
    }
    await patchItemDates(session.item, {
      startDate: preview.startDate,
      endDate: preview.endDate,
    });
  }

  useEffect(() => {
    if (!ganttDragRef.current) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void finishGanttDrag(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [datePreview]);

  async function handleAddPhase() {
    if (!editing) return;
    const name = `Phase ${plan.phases.length + 1}`;
    const created = await apiCall(`${apiBase}/phases`, "POST", {
      name,
      color: DEFAULT_PHASE_COLOR,
    });
    if (created && typeof created === "object" && "id" in created) {
      setPendingFocusId(String(created.id));
    }
  }

  async function handleAddItemToPhase(phase: PlanPhaseJson) {
    if (!editing) return;
    const created = await apiCall(`${apiBase}/items`, "POST", {
      phaseId: phase.id,
      parentItemId: null,
      type: "task",
      label: "New item",
      startDate: plan.kickoffDate,
      endDate: plan.kickoffDate,
      meetingStatus: null,
      scheduledTime: null,
    });
    if (created && typeof created === "object" && "id" in created) {
      setPendingFocusId(String(created.id));
    }
  }

  async function handleAddItemAfter(item: PlanItemJson) {
    if (!editing) return;
    const created = await apiCall(`${apiBase}/items`, "POST", {
      phaseId: item.phaseId,
      parentItemId: item.parentItemId,
      insertBeforeItemId: nextSiblingInsertBeforeId(allItems, item),
      type: "task",
      label: "New item",
      startDate: item.startDate,
      endDate: item.endDate,
      meetingStatus: null,
      scheduledTime: null,
    });
    if (created && typeof created === "object" && "id" in created) {
      setPendingFocusId(String(created.id));
    }
  }

  async function handleDeleteRow(row: PlanVisibleRow) {
    if (!editing) return;
    if (row.kind === "phase") {
      if (!window.confirm("Delete this phase and all its items?")) return;
      await apiCall(`${apiBase}/phases/${row.phase.id}`, "DELETE");
      setSelectedKey(null);
    } else if (row.item) {
      if (!window.confirm("Delete this item?")) return;
      await apiCall(`${apiBase}/items/${row.item.id}`, "DELETE");
      setSelectedKey(null);
    }
  }

  const handleDeleteRef = useRef(() => {
    if (selectedRow) void handleDeleteRow(selectedRow);
  });
  handleDeleteRef.current = () => {
    if (selectedRow) void handleDeleteRow(selectedRow);
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      void handleDeleteRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleScheduleMeeting(item: PlanItemJson) {
    if (item.type !== "meeting" || item.meetingStatus !== "assumed") return;
    await patchItem(item, {
      meetingStatus: "scheduled",
      endDate: item.startDate,
    });
  }

  const bodyHeight = Math.min(480, Math.max(200, displayRows.length * ROW_HEIGHT + 8));

  return (
    <section className="space-y-2">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-end gap-2 py-1 bg-white dark:bg-dark-surface">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <div
              className="inline-flex rounded-md border border-surface-300 dark:border-dark-muted overflow-hidden"
              aria-label="Grid mode"
            >
              {(["view", "edit"] as GridMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGridMode(mode)}
                  className={`px-2.5 py-1 text-body-sm font-medium capitalize ${
                    gridMode === mode
                      ? "bg-surface-800 text-white dark:bg-surface-200 dark:text-surface-900"
                      : "bg-white text-surface-700 hover:bg-surface-100 dark:bg-dark-surface dark:text-surface-300 dark:hover:bg-dark-raised"
                  }`}
                  aria-pressed={gridMode === mode}
                >
                  {mode}
                </button>
              ))}
            </div>
          ) : null}
          <div
            className="inline-flex rounded-md border border-surface-300 dark:border-dark-muted overflow-hidden"
            aria-label="Gantt zoom"
          >
            {(["fit", "day", "week", "month"] as ZoomMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setZoomMode(mode)}
                className={`px-2.5 py-1 text-body-sm font-medium capitalize ${
                  zoomMode === mode
                    ? "bg-surface-800 text-white dark:bg-surface-200 dark:text-surface-900"
                    : "bg-white text-surface-700 hover:bg-surface-100 dark:bg-dark-surface dark:text-surface-300 dark:hover:bg-dark-raised"
                }`}
                aria-pressed={zoomMode === mode}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>}
      {axisWidened && (
        <p className="text-body-sm text-surface-500 dark:text-surface-400">
          Some items fall outside the plan dates.
        </p>
      )}

      <div
        className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden"
      >
        <div className="flex" style={{ height: bodyHeight + ROW_HEIGHT }}>
          <div
            className="shrink-0 overflow-x-auto overflow-y-hidden border-r border-surface-200 dark:border-dark-border"
            style={{ width: leftGridWidth, maxWidth: "55%" }}
          >
            <div style={{ minWidth: leftGridWidth }}>
              <div className="bg-surface-50 dark:bg-dark-raised">
                <GridHeader gridMode={gridMode} editing={editing} />
              </div>
              <div
                ref={leftScrollRef}
                className="overflow-y-auto overflow-x-hidden"
                style={{ height: bodyHeight }}
                onScroll={(e) => {
                  if (rightScrollRef.current) {
                    syncVerticalScroll(e.currentTarget, rightScrollRef.current);
                  }
                }}
              >
            {displayRows.map((displayRow) => {
              if (displayRow.kind === "add-phase") {
                return (
                  <InlineAddRow
                    key="add-phase"
                    label="Add phase"
                    disabled={busy}
                    dropHover={dropHover?.kind === "phase-append"}
                    onDragOver={(event) => {
                      if (!editing || !acceptPhaseDrag(event)) return;
                      setDropHover({ kind: "phase-append" });
                    }}
                    onDragLeave={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                      clearDropHover();
                    }}
                    onDrop={(event) => {
                      if (droppedKind(event) === "phase") {
                        void handlePhaseDrop(event, { kind: "append" });
                      }
                    }}
                    onClick={handleAddPhase}
                  />
                );
              }
              const { row } = displayRow;
              const key = rowKey(row);
              const isSelected = selectedKey === key;
              return (
                <GridRow
                  key={key}
                  row={row}
                  gridMode={gridMode}
                  editing={editing}
                  busy={busy}
                  isSelected={isSelected}
                  collapsedIds={collapsedIds}
                  onSelect={() => setSelectedKey(key)}
                  onToggleCollapse={toggleCollapsed}
                  nameInputRef={(input) => {
                    const id = row.kind === "phase" ? row.phase.id : row.item!.id;
                    registerNameInput(id, input);
                  }}
                  onPatchPhase={async (phase, changes) => {
                    await apiCall(`${apiBase}/phases/${phase.id}`, "PATCH", changes);
                  }}
                  onPatchItem={patchItem}
                  onPatchItemDates={patchItemDates}
                  onAddItem={() => {
                    if (row.kind === "phase") void handleAddItemToPhase(row.phase);
                    else if (row.item) void handleAddItemAfter(row.item);
                  }}
                  onDelete={() => void handleDeleteRow(row)}
                  onScheduleMeeting={
                    row.kind === "item" && row.item
                      ? () => void handleScheduleMeeting(row.item!)
                      : undefined
                  }
                  dropHover={dropHover}
                  onItemDragOver={(event, itemId) => {
                    if (!acceptItemDrag(event)) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const edge = event.clientY - rect.top < DROP_EDGE_PX;
                    setDropHover(
                      edge
                        ? { kind: "before", itemId }
                        : { kind: "nest", itemId }
                    );
                  }}
                  onPhaseDragOver={(event, phaseId) => {
                    if (acceptPhaseDrag(event)) {
                      setDropHover({ kind: "phase-before", phaseId });
                      return;
                    }
                    if (!acceptItemDrag(event)) return;
                    setDropHover({ kind: "phase", phaseId });
                  }}
                  onDragLeaveRow={clearDropHover}
                  onDropTarget={(event, target) => {
                    const kind = droppedKind(event);
                    if (kind === "phase" && target.kind === "phase") {
                      void handlePhaseDrop(event, { kind: "before", phaseId: target.phaseId });
                      return;
                    }
                    if (kind === "item" && (target.kind === "nest" || target.kind === "before" || target.kind === "phase")) {
                      void handleItemDrop(event, target);
                    }
                  }}
                />
              );
            })}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <div
              ref={headerScrollRef}
              className="overflow-hidden shrink-0 bg-surface-50 dark:bg-dark-raised"
              style={{ minWidth: 0 }}
            >
              <div style={{ width: ganttWidth }}>
                <GanttHeader columns={columns} colWidth={colWidth} scale={scale} />
              </div>
            </div>
            <div
            ref={rightScrollRef}
            className="flex-1 overflow-x-auto overflow-y-auto"
            style={{ minWidth: 0 }}
            onScroll={(e) => {
              syncHeaderHorizontal(e.currentTarget.scrollLeft);
              if (leftScrollRef.current) {
                syncVerticalScroll(e.currentTarget, leftScrollRef.current);
              }
            }}
          >
            <div ref={ganttAxisRef} style={{ width: ganttWidth }}>
              {displayRows.map((displayRow) =>
                displayRow.kind === "data" ? (
                  <GanttRow
                    key={rowKey(displayRow.row)}
                    row={displayRow.row}
                    planStart={axisRange.startYmd}
                    planEnd={axisRange.endYmd}
                    columns={columns}
                    colWidth={colWidth}
                    scale={scale}
                    canEdit={editing}
                    datePreview={datePreview}
                    onGanttPointerDown={(item, kind, clientX) => {
                      const ymd = ymdFromPointer(clientX);
                      if (!ymd) return;
                      const point = isPointType(item.type, item.meetingStatus);
                      ganttDragRef.current = {
                        item,
                        kind: point ? "move" : kind,
                        originStart: item.startDate,
                        originEnd: item.endDate,
                        originYmd: ymd,
                        point,
                      };
                      setDatePreview({
                        itemId: item.id,
                        startDate: item.startDate,
                        endDate: item.endDate,
                      });
                    }}
                    onGanttPointerMove={(clientX) => {
                      const session = ganttDragRef.current;
                      if (!session) return;
                      const ymd = ymdFromPointer(clientX);
                      if (!ymd) return;
                      const next = applyGanttDrag({
                        kind: session.kind,
                        originStart: session.originStart,
                        originEnd: session.originEnd,
                        originYmd: session.originYmd,
                        currentYmd: ymd,
                        point: session.point,
                      });
                      setDatePreview({
                        itemId: session.item.id,
                        startDate: next.startDate,
                        endDate: next.endDate,
                      });
                    }}
                    onGanttPointerUp={(commit) => {
                      void finishGanttDrag(commit);
                    }}
                  />
                ) : (
                  <GanttSpacerRow key="add-phase" />
                )
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InlineAddRow({
  label,
  disabled,
  onClick,
  dropHover,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  dropHover?: boolean;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex w-full items-center gap-1 px-8 border-b border-surface-100 dark:border-dark-border text-body-sm text-surface-500 hover:bg-surface-50 hover:text-surface-800 dark:text-surface-400 dark:hover:bg-dark-raised dark:hover:text-surface-200 disabled:opacity-50 ${
        dropHover ? "bg-jblue-50 dark:bg-jblue-900/30 ring-1 ring-inset ring-jblue-500" : ""
      }`}
      style={{ height: ROW_HEIGHT }}
    >
      <Plus size={13} aria-hidden />
      {label}
    </button>
  );
}

function GanttSpacerRow() {
  return (
    <div
      className="border-b border-surface-100 dark:border-dark-border"
      style={{ height: ROW_HEIGHT }}
      aria-hidden
    />
  );
}

function GridHeader({ gridMode, editing }: { gridMode: GridMode; editing: boolean }) {
  if (gridMode === "view") {
    return (
      <div
        className="flex items-center text-label-sm font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-400 border-b border-surface-200 dark:border-dark-border"
        style={{ height: ROW_HEIGHT, minWidth: VIEW_GRID_WIDTH }}
      >
        <div style={{ width: EXPAND_COL }} className="shrink-0" />
        <div className="flex-1 min-w-0 px-2">Name</div>
        <div style={{ width: COMPACT_DATE_COL }} className="shrink-0 px-1">
          Dates
        </div>
        <div style={{ width: COMPACT_STATUS_COL }} className="shrink-0 px-1">
          Status
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center text-label-sm font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-400 border-b border-surface-200 dark:border-dark-border"
      style={{ height: ROW_HEIGHT, minWidth: FULL_GRID_INNER_WIDTH }}
    >
      <div style={{ width: EXPAND_COL }} className="shrink-0" />
      <div className="px-2 shrink-0" style={{ minWidth: NAME_COL }}>
        Name
      </div>
      <div style={{ width: TYPE_COL }} className="shrink-0 px-1">
        Type
      </div>
      <div style={{ width: DATE_COL }} className="shrink-0 px-1">
        Start
      </div>
      <div style={{ width: DATE_COL }} className="shrink-0 px-1">
        End
      </div>
      <div style={{ width: DURATION_COL }} className="shrink-0 px-1 text-center">
        Days
      </div>
      <div
        style={{ width: REPORT_CHECK_COL }}
        className="shrink-0 px-1 text-center"
        title="Show on status-report schedule"
      >
        Rpt
      </div>
      <div style={{ width: STATUS_COL }} className="shrink-0 px-1">
        Status
      </div>
      {editing ? <div style={{ width: ACTIONS_COL }} className="shrink-0" /> : null}
    </div>
  );
}

function TypeGlyph({ item }: { item: PlanItemJson }) {
  const Icon = ITEM_TYPE_ICONS[item.type];
  const title = itemTypeTitle(item);
  return (
    <span className="shrink-0 text-surface-500 dark:text-surface-400" title={title}>
      <Icon size={14} aria-label={title} />
    </span>
  );
}

function PhaseColorControl({
  color,
  name,
  editing,
  onChange,
}: {
  color: string;
  name: string;
  editing: boolean;
  onChange: (color: string) => void;
}) {
  const hex = normalizeHexColor(color);
  if (!editing) {
    return (
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
    );
  }

  return (
    <label
      className="relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-surface-300 dark:border-dark-muted overflow-hidden"
      style={{ backgroundColor: hex }}
      title="Change phase color"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="color"
        value={hex}
        aria-label={`Color for ${name}`}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function RowActions({
  addLabel,
  deleteLabel,
  busy,
  onAdd,
  onDelete,
}: {
  addLabel: string;
  deleteLabel: string;
  busy: boolean;
  onAdd: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`shrink-0 flex items-center justify-end gap-0.5 px-1 ${ROW_ACTIONS_REVEAL}`}
      style={{ width: ACTIONS_COL }}
    >
      <button
        type="button"
        className={ROW_ICON_BTN}
        title={addLabel}
        aria-label={addLabel}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
      >
        <Plus size={14} aria-hidden />
      </button>
      <button
        type="button"
        className={ROW_ICON_BTN}
        title={deleteLabel}
        aria-label={deleteLabel}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  );
}

function GridRow({
  row,
  gridMode,
  editing,
  busy,
  isSelected,
  collapsedIds,
  onSelect,
  onToggleCollapse,
  nameInputRef,
  onPatchPhase,
  onPatchItem,
  onPatchItemDates,
  onAddItem,
  onDelete,
  onScheduleMeeting,
  dropHover,
  onItemDragOver,
  onPhaseDragOver,
  onDragLeaveRow,
  onDropTarget,
}: {
  row: PlanVisibleRow;
  gridMode: GridMode;
  editing: boolean;
  busy: boolean;
  isSelected: boolean;
  collapsedIds: Set<string>;
  onSelect: () => void;
  onToggleCollapse: (id: string) => void;
  nameInputRef: (input: HTMLInputElement | null) => void;
  onPatchPhase: (
    phase: PlanPhaseJson,
    changes: Partial<{ name: string; color: string; showOnReports: boolean; reportLabel: string | null }>
  ) => Promise<void>;
  onPatchItem: (
    item: PlanItemJson,
    changes: Partial<{
      type: PlanItemType;
      label: string;
      startDate: string;
      endDate: string;
      meetingStatus: PlanMeetingStatus | null;
      scheduledTime: string | null;
      parentItemId: string | null;
      phaseId: string;
      showOnReports: boolean;
      reportLabel: string | null;
      status: PlanItemStatus;
    }>
  ) => Promise<unknown | null>;
  onPatchItemDates: (
    item: PlanItemJson,
    dates: { startDate?: string; endDate?: string }
  ) => Promise<unknown | null>;
  onAddItem: () => void;
  onDelete: () => void;
  onScheduleMeeting?: () => void;
  dropHover: GridDropHover | null;
  onItemDragOver: (event: DragEvent<HTMLDivElement>, itemId: string) => void;
  onPhaseDragOver: (event: DragEvent<HTMLDivElement>, phaseId: string) => void;
  onDragLeaveRow: () => void;
  onDropTarget: (event: DragEvent<HTMLDivElement>, target: ItemDropTarget) => void;
}) {
  const compact = gridMode === "view";
  const editColumns = editing;
  const rowMinWidth = compact ? VIEW_GRID_WIDTH : FULL_GRID_INNER_WIDTH;

  if (row.kind === "phase") {
    const phase = row.phase;
    const hasChildren = phase.items.length > 0;
    const collapsed = collapsedIds.has(phase.id);

    const phaseItemDrop =
      dropHover?.kind === "phase" && dropHover.phaseId === phase.id;
    const phaseBeforeDrop =
      dropHover?.kind === "phase-before" && dropHover.phaseId === phase.id;

    return (
      <div
        className={`group flex items-center border-b border-surface-100 dark:border-dark-border cursor-pointer ${
          isSelected ? "bg-jblue-50 dark:bg-jblue-900/20" : "hover:bg-surface-50 dark:hover:bg-dark-raised"
        } ${phaseItemDrop ? "ring-1 ring-inset ring-jblue-500 bg-jblue-50/80 dark:bg-jblue-900/30" : ""} ${
          phaseBeforeDrop ? "border-t-2 border-t-jblue-500" : ""
        }`}
        style={{ height: ROW_HEIGHT, minWidth: rowMinWidth }}
        onClick={onSelect}
        onDragOver={editing ? (event) => onPhaseDragOver(event, phase.id) : undefined}
        onDragLeave={
          editing
            ? (event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                onDragLeaveRow();
              }
            : undefined
        }
        onDrop={
          editing
            ? (event) => onDropTarget(event, { kind: "phase", phaseId: phase.id })
            : undefined
        }
      >
        <div style={{ width: EXPAND_COL }} className="shrink-0 flex justify-center">
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 text-surface-500 hover:text-surface-800 dark:hover:text-surface-200"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(phase.id);
              }}
              aria-label={collapsed ? "Expand phase" : "Collapse phase"}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : null}
        </div>
        <div
          className={`px-2 flex items-center gap-2 ${compact ? "flex-1 min-w-0" : "shrink-0"}`}
          style={compact ? undefined : { minWidth: NAME_COL }}
        >
          {editing ? (
            <button
              type="button"
              draggable
              className="shrink-0 p-0.5 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-grab active:cursor-grabbing"
              title="Drag to reorder phase"
              aria-label="Drag to reorder phase"
              onClick={(e) => e.stopPropagation()}
              onDragStart={(event) => {
                event.dataTransfer.setData(PLAN_PHASE_DRAG, phase.id);
                event.dataTransfer.setData("text/plain", `phase:${phase.id}`);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={onDragLeaveRow}
            >
              <GripVertical size={14} aria-hidden />
            </button>
          ) : null}
          <PhaseColorControl
            color={phase.color}
            name={phase.name}
            editing={editing}
            onChange={(color) => {
              if (color !== normalizeHexColor(phase.color)) onPatchPhase(phase, { color });
            }}
          />
          {editColumns ? (
            <input
              ref={nameInputRef}
              type="text"
              defaultValue={phase.name}
              key={phase.id + phase.name}
              className={INPUT_CLASS}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== phase.name) onPatchPhase(phase, { name });
              }}
            />
          ) : (
            <span
              className={`text-body-sm font-semibold text-surface-800 dark:text-surface-100 ${
                compact ? "truncate" : "whitespace-nowrap"
              }`}
              title={phase.name}
            >
              {phase.name}
            </span>
          )}
        </div>
        {compact ? (
          <>
            <div style={{ width: COMPACT_DATE_COL }} className="shrink-0" />
            <div style={{ width: COMPACT_STATUS_COL }} className="shrink-0" />
          </>
        ) : (
          <>
            <div style={{ width: TYPE_COL }} className="shrink-0 px-1">
              {editing ? (
                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  {PHASE_COLORS.map((swatch) => {
                    const selected = normalizeHexColor(phase.color) === swatch.value.toLowerCase();
                    return (
                      <button
                        key={swatch.value}
                        type="button"
                        title={swatch.label}
                        aria-label={`${swatch.label} phase color`}
                        aria-pressed={selected}
                        className={`h-5 w-5 rounded-sm border ${
                          selected
                            ? "border-surface-800 dark:border-white ring-1 ring-offset-1 ring-surface-400 dark:ring-surface-500"
                            : "border-surface-300 dark:border-dark-muted"
                        }`}
                        style={{ backgroundColor: swatch.value }}
                        onClick={() => {
                          if (normalizeHexColor(phase.color) !== swatch.value.toLowerCase()) {
                            onPatchPhase(phase, { color: swatch.value });
                          }
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <span className="text-body-sm text-surface-500 whitespace-nowrap">Phase</span>
              )}
            </div>
            <div style={{ width: DATE_COL }} className="shrink-0" />
            <div style={{ width: DATE_COL }} className="shrink-0" />
            <div style={{ width: DURATION_COL }} className="shrink-0" />
            <div style={{ width: REPORT_CHECK_COL }} className="shrink-0 px-1 flex justify-center">
              {editing ? (
                <input
                  type="checkbox"
                  checked={phase.showOnReports !== false}
                  aria-label="Show phase on status reports"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onPatchPhase(phase, { showOnReports: e.target.checked })}
                />
              ) : (
                <span className="text-body-sm text-surface-500">{phase.showOnReports !== false ? "Yes" : "No"}</span>
              )}
            </div>
            <div style={{ width: STATUS_COL }} className="shrink-0" />
            {editing ? (
              <RowActions
                addLabel="Add item to phase"
                deleteLabel="Delete phase"
                busy={busy}
                onAdd={onAddItem}
                onDelete={onDelete}
              />
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (row.kind === "item") {
    const item = row.item!;
    const phase = row.phase;
    const depth = row.depth;
    const hasChildren = phase.items.some((i: PlanItemJson) => i.parentItemId === item.id);
    const collapsed = collapsedIds.has(item.id);
    const point = isPointType(item.type, item.meetingStatus);
    const duration = calendarDays(item.startDate, item.endDate);
    const saveStartDate = (startDate: string) => onPatchItemDates(item, { startDate });
    const saveEndDate = (endDate: string) => onPatchItemDates(item, { endDate });
    const compactDates = compactDateLabel(item);
    const statusLabel = ITEM_STATUS_LABELS[item.status ?? "not_started"];
    const canSchedule =
      item.type === "meeting" && item.meetingStatus === "assumed" && onScheduleMeeting;

    const nestDrop = dropHover?.kind === "nest" && dropHover.itemId === item.id;
    const beforeDrop = dropHover?.kind === "before" && dropHover.itemId === item.id;

    return (
      <div
        className={`group flex items-center border-b border-surface-100 dark:border-dark-border cursor-pointer ${
          isSelected ? "bg-jblue-50 dark:bg-jblue-900/20" : "hover:bg-surface-50 dark:hover:bg-dark-raised"
        } ${nestDrop ? "ring-1 ring-inset ring-jblue-500 bg-jblue-50/80 dark:bg-jblue-900/30" : ""} ${
          beforeDrop ? "border-t-2 border-t-jblue-500" : ""
        }`}
        style={{ height: ROW_HEIGHT, minWidth: rowMinWidth }}
        onClick={onSelect}
        onDragOver={editing ? (event) => onItemDragOver(event, item.id) : undefined}
        onDragLeave={
          editing
            ? (event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                onDragLeaveRow();
              }
            : undefined
        }
        onDrop={
          editing
            ? (event) => {
                if (droppedKind(event) === "phase") {
                  event.preventDefault();
                  return;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                const edge = event.clientY - rect.top < DROP_EDGE_PX;
                onDropTarget(
                  event,
                  edge ? { kind: "before", itemId: item.id } : { kind: "nest", itemId: item.id }
                );
              }
            : undefined
        }
      >
        <div style={{ width: EXPAND_COL }} className="shrink-0 flex justify-center">
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 text-surface-500"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(item.id);
              }}
              aria-label={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : null}
        </div>
        <div
          className={`px-2 flex items-center gap-1 ${compact ? "flex-1 min-w-0" : "shrink-0"}`}
          style={{
            paddingLeft: 8 + depth * 16,
            ...(compact ? {} : { minWidth: NAME_COL }),
          }}
        >
          {editing ? (
            <button
              type="button"
              draggable
              className="shrink-0 p-0.5 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-grab active:cursor-grabbing"
              title="Drag to reorder or move"
              aria-label="Drag to reorder"
              onClick={(e) => e.stopPropagation()}
              onDragStart={(event) => {
                event.dataTransfer.setData(PLAN_ITEM_DRAG, item.id);
                event.dataTransfer.setData("text/plain", item.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={onDragLeaveRow}
            >
              <GripVertical size={14} aria-hidden />
            </button>
          ) : null}
          {compact ? <TypeGlyph item={item} /> : null}
          {editColumns ? (
            <input
              ref={nameInputRef}
              type="text"
              defaultValue={item.label}
              key={item.id + item.label}
              className={INPUT_CLASS}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const label = e.target.value.trim();
                if (label && label !== item.label) onPatchItem(item, { label });
              }}
            />
          ) : (
            <span
              className={`text-body-sm text-surface-800 dark:text-surface-100 ${
                compact ? "truncate block min-w-0" : "whitespace-nowrap"
              }`}
              title={item.label}
            >
              {item.label}
            </span>
          )}
        </div>
        {compact ? (
          <>
            <div
              style={{ width: COMPACT_DATE_COL }}
              className="shrink-0 px-1 text-body-sm tabular-nums text-surface-600 dark:text-surface-400 truncate"
              title={compactDates.title}
            >
              {compactDates.text}
            </div>
            <div
              style={{ width: COMPACT_STATUS_COL }}
              className="shrink-0 px-1 text-body-sm text-surface-600 dark:text-surface-400 truncate"
              title={statusLabel}
            >
              {statusLabel}
            </div>
          </>
        ) : (
          <>
            <div style={{ width: TYPE_COL }} className="shrink-0 px-1">
              {editing ? (
                <select
                  value={item.type}
                  className={INPUT_CLASS}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const type = e.target.value as PlanItemType;
                    const meetingStatus: PlanMeetingStatus | null =
                      type === "meeting" ? "assumed" : null;
                    onPatchItem(item, { type, meetingStatus });
                  }}
                >
                  {PLAN_ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ITEM_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-body-sm text-surface-600 dark:text-surface-400 whitespace-nowrap">
                  {itemTypeTitle(item)}
                </span>
              )}
            </div>
            <div style={{ width: DATE_COL }} className="shrink-0 px-1">
              {editing ? (
                <DateCell value={item.startDate} onCommit={saveStartDate} />
              ) : (
                <span className="text-body-sm tabular-nums text-surface-700 dark:text-surface-300 whitespace-nowrap">
                  {item.startDate}
                </span>
              )}
            </div>
            <div style={{ width: DATE_COL }} className="shrink-0 px-1">
              {editing && !point ? (
                <DateCell value={item.endDate} onCommit={saveEndDate} />
              ) : (
                <span
                  className={`text-body-sm tabular-nums whitespace-nowrap ${
                    point
                      ? "text-surface-400 dark:text-surface-500"
                      : "text-surface-700 dark:text-surface-300"
                  }`}
                >
                  {point ? "—" : item.endDate}
                </span>
              )}
            </div>
            <div
              style={{ width: DURATION_COL }}
              className="shrink-0 px-1 text-center text-body-sm tabular-nums text-surface-600 dark:text-surface-400"
            >
              {duration}
            </div>
            <div style={{ width: REPORT_CHECK_COL }} className="shrink-0 px-1 flex justify-center">
              {editing ? (
                <input
                  type="checkbox"
                  checked={item.showOnReports ?? defaultShowOnReports(item.type, item.meetingStatus)}
                  aria-label="Show item on status reports"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onPatchItem(item, { showOnReports: e.target.checked })}
                />
              ) : (
                <span className="text-body-sm text-surface-500">
                  {(item.showOnReports ?? defaultShowOnReports(item.type, item.meetingStatus)) ? "Yes" : "No"}
                </span>
              )}
            </div>
            <div style={{ width: STATUS_COL }} className="shrink-0 px-1 flex items-center gap-1">
              {editing ? (
                <>
                  <select
                    value={item.status ?? "not_started"}
                    className={INPUT_CLASS}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onPatchItem(item, { status: e.target.value as PlanItemStatus })}
                  >
                    {PLAN_ITEM_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {ITEM_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  {canSchedule ? (
                    <button
                      type="button"
                      className={ROW_ICON_BTN}
                      title="Schedule meeting"
                      aria-label="Schedule meeting"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScheduleMeeting();
                      }}
                    >
                      <Calendar size={14} aria-hidden />
                    </button>
                  ) : null}
                </>
              ) : (
                <span className="text-body-sm text-surface-600 dark:text-surface-400 whitespace-nowrap">
                  {statusLabel}
                </span>
              )}
            </div>
            {editing ? (
              <RowActions
                addLabel="Add item after"
                deleteLabel="Delete item"
                busy={busy}
                onAdd={onAddItem}
                onDelete={onDelete}
              />
            ) : null}
          </>
        )}
      </div>
    );
  }

  return null;
}

function GanttHeader({
  columns,
  colWidth,
  scale,
}: {
  columns: ScaleColumn[];
  colWidth: number;
  scale: ReturnType<typeof getPlanScale>;
}) {
  return (
    <div
      className="flex border-b border-surface-200 dark:border-dark-border"
      style={{ height: ROW_HEIGHT }}
    >
      {columns.map((col, i) => {
        const weekend =
          scale === "day" && isWeekendYmd(col.startYmd);
        return (
          <div
            key={col.key}
            className={`shrink-0 text-center text-label-sm font-bold uppercase tracking-wide text-white px-0.5 ${
              i < columns.length - 1 ? "border-r border-white/30" : ""
            } ${weekend ? "opacity-90" : ""}`}
            style={{
              width: colWidth,
              lineHeight: `${ROW_HEIGHT}px`,
              backgroundColor: weekend ? "#2a3a8f" : "#040966",
            }}
            title={col.label}
          >
            {col.label}
          </div>
        );
      })}
    </div>
  );
}

function GanttRow({
  row,
  planStart,
  planEnd,
  columns,
  colWidth,
  scale,
  canEdit,
  datePreview,
  onGanttPointerDown,
  onGanttPointerMove,
  onGanttPointerUp,
}: {
  row: PlanVisibleRow;
  planStart: string;
  planEnd: string;
  columns: ScaleColumn[];
  colWidth: number;
  scale: ReturnType<typeof getPlanScale>;
  canEdit: boolean;
  datePreview: { itemId: string; startDate: string; endDate: string } | null;
  onGanttPointerDown: (item: PlanItemJson, kind: GanttDragKind, clientX: number) => void;
  onGanttPointerMove: (clientX: number) => void;
  onGanttPointerUp: (commit: boolean) => void;
}) {
  const item =
    row.kind === "item" && row.item
      ? datePreview?.itemId === row.item.id
        ? { ...row.item, startDate: datePreview.startDate, endDate: datePreview.endDate }
        : row.item
      : undefined;

  return (
    <div
      className="relative border-b border-surface-100 dark:border-dark-border"
      style={{ height: ROW_HEIGHT }}
    >
      <div className="absolute inset-0 flex pointer-events-none">
        {columns.map((col) => {
          const weekend = scale === "day" && isWeekendYmd(col.startYmd);
          return (
            <div
              key={col.key}
              className={`shrink-0 h-full border-r border-surface-100 dark:border-dark-border ${
                weekend ? "bg-surface-100/80 dark:bg-dark-muted/40" : ""
              }`}
              style={{ width: colWidth }}
            />
          );
        })}
      </div>
      <div className="absolute inset-0">
        {row.kind === "phase" ? (
          <PhaseSummaryBar phase={row.phase} planStart={planStart} planEnd={planEnd} />
        ) : item ? (
          <ItemGanttMark
            item={item}
            color={row.phase.color}
            planStart={planStart}
            planEnd={planEnd}
            canEdit={canEdit}
            onGanttPointerDown={onGanttPointerDown}
            onGanttPointerMove={onGanttPointerMove}
            onGanttPointerUp={onGanttPointerUp}
          />
        ) : null}
      </div>
    </div>
  );
}

function PhaseSummaryBar({
  phase,
  planStart,
  planEnd,
}: {
  phase: PlanPhaseJson;
  planStart: string;
  planEnd: string;
}) {
  const { start, end } = phaseDateRange(phase);
  if (!start || !end) return null;

  const left = positionPercent(start, planStart, planEnd);
  const width = widthPercent(start, end, planStart, planEnd);

  return (
    <div
      className="absolute top-2 bottom-2 rounded opacity-40"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        minWidth: 4,
        backgroundColor: phase.color,
      }}
      title={`${phase.name}: ${start} – ${end}`}
    />
  );
}

const GANTT_HANDLE_PX = 6;

function ganttPointerHandlers(
  item: PlanItemJson,
  kind: GanttDragKind,
  canEdit: boolean,
  onGanttPointerDown: (item: PlanItemJson, kind: GanttDragKind, clientX: number) => void,
  onGanttPointerMove: (clientX: number) => void,
  onGanttPointerUp: (commit: boolean) => void
) {
  if (!canEdit) return {};
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onGanttPointerDown(item, kind, event.clientX);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      onGanttPointerMove(event.clientX);
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onGanttPointerUp(true);
    },
    onPointerCancel: () => onGanttPointerUp(false),
  };
}

function ItemGanttMark({
  item,
  color,
  planStart,
  planEnd,
  canEdit,
  onGanttPointerDown,
  onGanttPointerMove,
  onGanttPointerUp,
}: {
  item: PlanItemJson;
  color: string;
  planStart: string;
  planEnd: string;
  canEdit: boolean;
  onGanttPointerDown: (item: PlanItemJson, kind: GanttDragKind, clientX: number) => void;
  onGanttPointerMove: (clientX: number) => void;
  onGanttPointerUp: (commit: boolean) => void;
}) {
  const point = isPointType(item.type, item.meetingStatus);
  const waiting = item.type === "waiting_on_client";
  const assumedMeeting =
    item.type === "meeting" && item.meetingStatus === "assumed";
  const dragCursor = canEdit ? "cursor-grab touch-none" : "";
  const moveHandlers = ganttPointerHandlers(
    item,
    "move",
    canEdit,
    onGanttPointerDown,
    onGanttPointerMove,
    onGanttPointerUp
  );
  const startHandlers = ganttPointerHandlers(
    item,
    "resize-start",
    canEdit,
    onGanttPointerDown,
    onGanttPointerMove,
    onGanttPointerUp
  );
  const endHandlers = ganttPointerHandlers(
    item,
    "resize-end",
    canEdit,
    onGanttPointerDown,
    onGanttPointerMove,
    onGanttPointerUp
  );

  if (point) {
    const left = positionPercent(item.startDate, planStart, planEnd);
    return (
      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${dragCursor}`}
        style={{ left: `${left}%` }}
        title={`${item.label} (${item.startDate})`}
        {...moveHandlers}
      >
        <div
          className="w-3 h-3 rotate-45 border border-white/60 shadow-sm"
          style={{
            backgroundColor:
              item.type === "meeting" ? MEETING_VIOLET : color,
          }}
        />
      </div>
    );
  }

  const left = positionPercent(item.startDate, planStart, planEnd);
  const width = widthPercent(item.startDate, item.endDate, planStart, planEnd);

  if (assumedMeeting) {
    return (
      <div
        className={`absolute top-2 bottom-2 rounded border-2 border-dashed ${dragCursor}`}
        style={{
          left: `${left}%`,
          width: `${width}%`,
          minWidth: 4,
          borderColor: MEETING_VIOLET,
          background: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 4px,
            ${MEETING_VIOLET}33 4px,
            ${MEETING_VIOLET}33 8px
          )`,
        }}
        title={`${item.label} (assumed ${item.startDate} – ${item.endDate})`}
        {...moveHandlers}
      >
        {canEdit ? (
          <>
            <div
              className="absolute top-0 bottom-0 cursor-ew-resize"
              style={{ left: -GANTT_HANDLE_PX / 2, width: GANTT_HANDLE_PX }}
              {...startHandlers}
            />
            <div
              className="absolute top-0 bottom-0 cursor-ew-resize"
              style={{ right: -GANTT_HANDLE_PX / 2, width: GANTT_HANDLE_PX }}
              {...endHandlers}
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`absolute top-2 bottom-2 rounded ${dragCursor} ${
        waiting ? "border-2 border-dashed bg-transparent" : ""
      }`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        minWidth: 4,
        backgroundColor: waiting ? "transparent" : color,
        borderColor: waiting ? color : undefined,
      }}
      title={`${item.label} (${item.startDate} – ${item.endDate})`}
      {...moveHandlers}
    >
      {canEdit ? (
        <>
          <div
            className="absolute top-0 bottom-0 cursor-ew-resize"
            style={{ left: -GANTT_HANDLE_PX / 2, width: GANTT_HANDLE_PX }}
            {...startHandlers}
          />
          <div
            className="absolute top-0 bottom-0 cursor-ew-resize"
            style={{ right: -GANTT_HANDLE_PX / 2, width: GANTT_HANDLE_PX }}
            {...endHandlers}
          />
        </>
      ) : null}
    </div>
  );
}
