"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Indent,
  Outdent,
  Plus,
  Trash2,
} from "lucide-react";
import { expandYmdRange, isWeekendYmd } from "@/lib/plan/businessDays";
import {
  resolvePlanDateCellEdit,
  type PlanDateEditEvent,
} from "@/lib/plan/dateInput";
import { positionPercent, widthPercent } from "@/lib/plan/positioning";
import {
  getPlanAxisRange,
  getPlanScale,
  getScaleColumns,
  type PlanScale,
  type ScaleColumn,
} from "@/lib/plan/scale";
import type { PlanItemJson, PlanJson, PlanPhaseJson } from "@/lib/plan/serialize";
import {
  flattenVisibleRows,
  getItemDepth,
  indentItem,
  outdentItem,
  type PlanVisibleRow,
} from "@/lib/plan/tree";
import {
  isPointType,
  MAX_ITEM_DEPTH,
  PLAN_ITEM_TYPES,
  type PlanItemType,
  type PlanMeetingStatus,
} from "@/lib/plan/types";

const MEETING_VIOLET = "#6d28d9";
const ROW_HEIGHT = 36;
const GRID_WIDTH = 560;
const EXPAND_COL = 28;
const TYPE_COL = 120;
const DATE_COL = 108;
const DURATION_COL = 56;
const MIN_COL_WIDTH = 12;

const INPUT_CLASS =
  "block w-full h-7 px-2 rounded text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100";
const BTN_TOOLBAR =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-800 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY =
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50";

const ITEM_TYPE_LABELS: Record<PlanItemType, string> = {
  task: "Task",
  milestone: "Milestone",
  sign_off: "Sign-off",
  hard_deadline: "Hard deadline",
  waiting_on_client: "Waiting on client",
  meeting: "Meeting",
};

type RowKey = string;
type ZoomMode = "fit" | PlanScale;

type DisplayRow =
  | { kind: "data"; row: PlanVisibleRow }
  | { kind: "add-item"; phase: PlanPhaseJson }
  | { kind: "add-phase" };

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

function columnPixelWidth(scale: ReturnType<typeof getPlanScale>): number {
  if (scale === "day") return 28;
  if (scale === "week") return 48;
  return 72;
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
  const [paneWidth, setPaneWidth] = useState(0);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  const nameInputRefs = useRef(new Map<string, HTMLInputElement>());

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
    zoomMode === "fit" && paneWidth > 0
      ? Math.max(MIN_COL_WIDTH, paneWidth / Math.max(columns.length, 1))
      : columnPixelWidth(scale);
  const ganttWidth = columns.length * colWidth;
  const axisWidened =
    axisRange.startYmd < plan.kickoffDate || axisRange.endYmd > plan.endDate;

  const rows = useMemo(
    () => flattenVisibleRows(plan.phases, collapsedIds),
    [plan.phases, collapsedIds]
  );
  const displayRows = useMemo<DisplayRow[]>(() => {
    const output: DisplayRow[] = [];
    rows.forEach((row, index) => {
      output.push({ kind: "data", row });
      const nextRow = rows[index + 1];
      const phaseEnds = !nextRow || nextRow.phase.id !== row.phase.id;
      if (canEdit && phaseEnds && !collapsedIds.has(row.phase.id)) {
        output.push({ kind: "add-item", phase: row.phase });
      }
    });
    if (canEdit) output.push({ kind: "add-phase" });
    return output;
  }, [canEdit, collapsedIds, rows]);

  const allItems = useMemo(
    () => plan.phases.flatMap((p) => p.items),
    [plan.phases]
  );

  const selectedRow = useMemo(
    () => (selectedKey ? rows.find((r) => rowKey(r) === selectedKey) : undefined),
    [rows, selectedKey]
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
    dates: { startDate: string } | { endDate: string }
  ) {
    return apiCall(`${apiBase}/items/${item.id}`, "PATCH", dates, { indicateBusy: false });
  }

  async function handleAddPhase() {
    const name = `Phase ${plan.phases.length + 1}`;
    const created = await apiCall(`${apiBase}/phases`, "POST", {
      name,
      color: "#1941FA",
    });
    if (created && typeof created === "object" && "id" in created) {
      setPendingFocusId(String(created.id));
    }
  }

  async function handleAddItem() {
    if (!canEdit) return;
    let phaseId: string;
    let parentItemId: string | null = null;
    let startDate = plan.kickoffDate;
    let endDate = plan.kickoffDate;

    if (selectedRow?.kind === "phase") {
      phaseId = selectedRow.phase.id;
    } else if (selectedRow?.kind === "item" && selectedRow.item) {
      phaseId = selectedRow.phase.id;
      const depth = getItemDepth(allItems, selectedRow.item.id);
      if (depth < MAX_ITEM_DEPTH) {
        parentItemId = selectedRow.item.id;
      } else {
        parentItemId = selectedRow.item.parentItemId;
      }
      startDate = selectedRow.item.startDate;
      endDate = selectedRow.item.endDate;
    } else if (plan.phases.length > 0) {
      phaseId = plan.phases[0].id;
    } else {
      setError("Add a phase first");
      return;
    }

    const created = await apiCall(`${apiBase}/items`, "POST", {
      phaseId,
      parentItemId,
      type: "task",
      label: "New item",
      startDate,
      endDate,
      meetingStatus: null,
      scheduledTime: null,
    });
    if (created && typeof created === "object" && "id" in created) {
      setPendingFocusId(String(created.id));
    }
  }

  async function handleAddItemToPhase(phase: PlanPhaseJson) {
    if (!canEdit) return;
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

  async function handleDelete() {
    if (!selectedRow || !canEdit) return;
    if (selectedRow.kind === "phase") {
      if (!window.confirm("Delete this phase and all its items?")) return;
      await apiCall(`${apiBase}/phases/${selectedRow.phase.id}`, "DELETE");
      setSelectedKey(null);
    } else if (selectedRow.item) {
      if (!window.confirm("Delete this item?")) return;
      await apiCall(`${apiBase}/items/${selectedRow.item.id}`, "DELETE");
      setSelectedKey(null);
    }
  }

  async function handleIndent() {
    if (!selectedRow || selectedRow.kind !== "item" || !selectedRow.item) return;
    const result = indentItem(allItems, selectedRow.item.id);
    if (!result) {
      setError("Cannot indent this item");
      return;
    }
    await patchItem(selectedRow.item, { parentItemId: result.parentItemId });
  }

  async function handleOutdent() {
    if (!selectedRow || selectedRow.kind !== "item" || !selectedRow.item) return;
    const result = outdentItem(allItems, selectedRow.item.id);
    if (!result) return;
    await patchItem(selectedRow.item, { parentItemId: result.parentItemId });
  }

  async function handleScheduleMeeting() {
    if (!selectedRow || selectedRow.kind !== "item" || !selectedRow.item) return;
    const item = selectedRow.item;
    if (item.type !== "meeting" || item.meetingStatus !== "assumed") return;
    await patchItem(item, {
      meetingStatus: "scheduled",
      endDate: item.startDate,
    });
  }

  const canIndent =
    selectedRow?.kind === "item" &&
    selectedRow.item &&
    indentItem(allItems, selectedRow.item.id) !== null;

  const canOutdent =
    selectedRow?.kind === "item" &&
    selectedRow.item &&
    outdentItem(allItems, selectedRow.item.id) !== null;

  const canSchedule =
    selectedRow?.kind === "item" &&
    selectedRow.item &&
    selectedRow.item.type === "meeting" &&
    selectedRow.item.meetingStatus === "assumed";

  return (
    <section className="space-y-2">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 py-1 bg-white dark:bg-dark-surface">
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleAddPhase} disabled={busy} className={BTN_PRIMARY}>
              <Plus size={14} aria-hidden />
              Add phase
            </button>
            <button type="button" onClick={handleAddItem} disabled={busy} className={BTN_TOOLBAR}>
              <Plus size={14} aria-hidden />
              Add item
            </button>
            <button
              type="button"
              onClick={handleIndent}
              disabled={busy || !canIndent}
              className={BTN_TOOLBAR}
              title="Indent"
            >
              <Indent size={14} aria-hidden />
              Indent
            </button>
            <button
              type="button"
              onClick={handleOutdent}
              disabled={busy || !canOutdent}
              className={BTN_TOOLBAR}
              title="Outdent"
            >
              <Outdent size={14} aria-hidden />
              Outdent
            </button>
            {canSchedule && (
              <button
                type="button"
                onClick={handleScheduleMeeting}
                disabled={busy}
                className={BTN_TOOLBAR}
              >
                Schedule meeting
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || !selectedRow}
              className={BTN_TOOLBAR}
            >
              <Trash2 size={14} aria-hidden />
              Delete
            </button>
          </div>
        ) : (
          <div />
        )}
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

      {error && <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>}
      {axisWidened && (
        <p className="text-body-sm text-surface-500 dark:text-surface-400">
          Some items fall outside the plan dates.
        </p>
      )}

      <div
        className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden"
      >
        <div className="flex border-b border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised">
          <div className="shrink-0 border-r border-surface-200 dark:border-dark-border" style={{ width: GRID_WIDTH }}>
            <GridHeader />
          </div>
          <div
            ref={headerScrollRef}
            className="flex-1 overflow-hidden"
            style={{ minWidth: 0 }}
          >
            <div style={{ width: ganttWidth }}>
              <GanttHeader columns={columns} colWidth={colWidth} scale={scale} />
            </div>
          </div>
        </div>

        <div className="flex" style={{ height: Math.min(480, Math.max(200, displayRows.length * ROW_HEIGHT + 8)) }}>
          <div
            ref={leftScrollRef}
            className="shrink-0 overflow-y-auto overflow-x-hidden border-r border-surface-200 dark:border-dark-border"
            style={{ width: GRID_WIDTH }}
            onScroll={(e) => {
              if (rightScrollRef.current) {
                syncVerticalScroll(e.currentTarget, rightScrollRef.current);
              }
            }}
          >
            {displayRows.map((displayRow) => {
              if (displayRow.kind === "add-item") {
                return (
                  <InlineAddRow
                    key={`add-item:${displayRow.phase.id}`}
                    label="Add item"
                    disabled={busy}
                    onClick={() => handleAddItemToPhase(displayRow.phase)}
                  />
                );
              }
              if (displayRow.kind === "add-phase") {
                return (
                  <InlineAddRow
                    key="add-phase"
                    label="Add phase"
                    disabled={busy}
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
                  canEdit={canEdit}
                  isSelected={isSelected}
                  collapsedIds={collapsedIds}
                  onSelect={() => setSelectedKey(key)}
                  onToggleCollapse={toggleCollapsed}
                  nameInputRef={(input) => {
                    const id = row.kind === "phase" ? row.phase.id : row.item!.id;
                    registerNameInput(id, input);
                  }}
                  onPatchPhase={async (phase, name) => {
                    await apiCall(`${apiBase}/phases/${phase.id}`, "PATCH", { name });
                  }}
                  onPatchItem={patchItem}
                  onPatchItemDates={patchItemDates}
                />
              );
            })}
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
            <div style={{ width: ganttWidth }}>
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
                  />
                ) : (
                  <GanttSpacerRow
                    key={
                      displayRow.kind === "add-item"
                        ? `add-item:${displayRow.phase.id}`
                        : "add-phase"
                    }
                  />
                )
              )}
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
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-1 px-8 border-b border-surface-100 dark:border-dark-border text-body-sm text-surface-500 hover:bg-surface-50 hover:text-surface-800 dark:text-surface-400 dark:hover:bg-dark-raised dark:hover:text-surface-200 disabled:opacity-50"
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

function GridHeader() {
  return (
    <div
      className="flex items-center h-9 text-label-sm font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-400 border-b border-surface-200 dark:border-dark-border"
      style={{ height: ROW_HEIGHT }}
    >
      <div style={{ width: EXPAND_COL }} className="shrink-0" />
      <div className="flex-1 min-w-0 px-2">Name</div>
      <div style={{ width: TYPE_COL }} className="shrink-0 px-1">Type</div>
      <div style={{ width: DATE_COL }} className="shrink-0 px-1">Start</div>
      <div style={{ width: DATE_COL }} className="shrink-0 px-1">End</div>
      <div
        style={{ width: DURATION_COL }}
        className="shrink-0 px-1 text-center"
      >
        Days
      </div>
    </div>
  );
}

function GridRow({
  row,
  canEdit,
  isSelected,
  collapsedIds,
  onSelect,
  onToggleCollapse,
  nameInputRef,
  onPatchPhase,
  onPatchItem,
  onPatchItemDates,
}: {
  row: PlanVisibleRow;
  canEdit: boolean;
  isSelected: boolean;
  collapsedIds: Set<string>;
  onSelect: () => void;
  onToggleCollapse: (id: string) => void;
  nameInputRef: (input: HTMLInputElement | null) => void;
  onPatchPhase: (phase: PlanPhaseJson, name: string) => Promise<void>;
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
    }>
  ) => Promise<unknown | null>;
  onPatchItemDates: (
    item: PlanItemJson,
    dates: { startDate: string } | { endDate: string }
  ) => Promise<unknown | null>;
}) {
  if (row.kind === "phase") {
    const phase = row.phase;
    const hasChildren = phase.items.length > 0;
    const collapsed = collapsedIds.has(phase.id);

    return (
      <div
        className={`flex items-center border-b border-surface-100 dark:border-dark-border cursor-pointer ${
          isSelected ? "bg-jblue-50 dark:bg-jblue-900/20" : "hover:bg-surface-50 dark:hover:bg-dark-raised"
        }`}
        style={{ height: ROW_HEIGHT }}
        onClick={onSelect}
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
        <div className="flex-1 min-w-0 px-2 flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: phase.color }}
            aria-hidden
          />
          {canEdit ? (
            <input
              ref={nameInputRef}
              type="text"
              defaultValue={phase.name}
              key={phase.id + phase.name}
              className={INPUT_CLASS}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== phase.name) onPatchPhase(phase, name);
              }}
            />
          ) : (
            <span className="text-body-sm font-semibold text-surface-800 dark:text-surface-100 truncate">
              {phase.name}
            </span>
          )}
        </div>
        <div style={{ width: TYPE_COL }} className="shrink-0 px-1 text-body-sm text-surface-500">
          Phase
        </div>
        <div style={{ width: DATE_COL }} className="shrink-0" />
        <div style={{ width: DATE_COL }} className="shrink-0" />
        <div style={{ width: DURATION_COL }} className="shrink-0" />
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
  // A point item's end date follows its start date; the API derives that from the stored type,
  // so neither cell has to send the other date back.
  const saveStartDate = (startDate: string) => onPatchItemDates(item, { startDate });
  const saveEndDate = (endDate: string) => onPatchItemDates(item, { endDate });

  return (
    <div
      className={`flex items-center border-b border-surface-100 dark:border-dark-border cursor-pointer ${
        isSelected ? "bg-jblue-50 dark:bg-jblue-900/20" : "hover:bg-surface-50 dark:hover:bg-dark-raised"
      }`}
      style={{ height: ROW_HEIGHT }}
      onClick={onSelect}
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
        className="flex-1 min-w-0 px-2"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {canEdit ? (
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
          <span className="text-body-sm text-surface-800 dark:text-surface-100 truncate block">
            {item.label}
          </span>
        )}
      </div>
      <div style={{ width: TYPE_COL }} className="shrink-0 px-1">
        {canEdit ? (
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
              <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>
            ))}
          </select>
        ) : (
          <span className="text-body-sm text-surface-600 dark:text-surface-400">
            {ITEM_TYPE_LABELS[item.type]}
            {item.type === "meeting" && item.meetingStatus
              ? ` (${item.meetingStatus})`
              : ""}
          </span>
        )}
      </div>
      <div style={{ width: DATE_COL }} className="shrink-0 px-1">
        {canEdit ? (
          <DateCell value={item.startDate} onCommit={saveStartDate} />
        ) : (
          <span className="text-body-sm tabular-nums text-surface-700 dark:text-surface-300">
            {item.startDate}
          </span>
        )}
      </div>
      <div style={{ width: DATE_COL }} className="shrink-0 px-1">
        {canEdit && !point ? (
          <DateCell value={item.endDate} onCommit={saveEndDate} />
        ) : (
          <span
            className={`text-body-sm tabular-nums ${
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
            className={`shrink-0 text-center text-label-sm font-bold uppercase tracking-wide text-white truncate px-0.5 ${
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
}: {
  row: PlanVisibleRow;
  planStart: string;
  planEnd: string;
  columns: ScaleColumn[];
  colWidth: number;
  scale: ReturnType<typeof getPlanScale>;
}) {
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
        ) : row.item ? (
          <ItemGanttMark
            item={row.item}
            color={row.phase.color}
            planStart={planStart}
            planEnd={planEnd}
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

function ItemGanttMark({
  item,
  color,
  planStart,
  planEnd,
}: {
  item: PlanItemJson;
  color: string;
  planStart: string;
  planEnd: string;
}) {
  const point = isPointType(item.type, item.meetingStatus);
  const waiting = item.type === "waiting_on_client";
  const assumedMeeting =
    item.type === "meeting" && item.meetingStatus === "assumed";

  if (point) {
    const left = positionPercent(item.startDate, planStart, planEnd);
    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
        style={{ left: `${left}%` }}
        title={`${item.label} (${item.startDate})`}
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
        className="absolute top-2 bottom-2 rounded border-2 border-dashed pointer-events-none"
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
      />
    );
  }

  return (
    <div
      className={`absolute top-2 bottom-2 rounded ${
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
    />
  );
}
