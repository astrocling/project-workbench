"use client";

import { useMemo, useState, type DragEvent } from "react";
import { EyeOff, GripVertical } from "lucide-react";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";
import { TIMELINE_RENDERABLE_ROW_MAX, TIMELINE_RENDERABLE_ROW_MIN } from "@/lib/plan/reportSchedule";
import {
  applyTimelineLayout,
  isReadableTimelineWindow,
  setTimelineLayoutLabel,
  setTimelineLayoutRow,
  setTimelineLayoutWindow,
  toggleTimelineHiddenId,
  type TimelineLayoutOverlay,
} from "@/lib/statusReportTimelineLayout";

const BAR_BG = "#1941FA";
const MARKER_COLOR = "#FF2020";
const ARRANGE_DRAG = "application/x-status-report-arrange";
const ROW_HEIGHT = 56;
const INPUT_CLASS =
  "block w-full h-8 px-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted";

type ArrangeKind = "bar" | "marker";
type DragPayload = { kind: ArrangeKind; id: string };
type SelectedItem = { kind: ArrangeKind; id: string };

type ArrangeScheduleFieldsProps = {
  timeline: NonNullable<StatusReportPDFData["timeline"]>;
  layout: TimelineLayoutOverlay;
  onChange: (next: TimelineLayoutOverlay) => void;
  disabled?: boolean;
};

function monthKeys(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (current <= endMonth) {
    months.push(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`);
    current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return months;
}

function monthEndYmd(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function toMonthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function positionPercent(dateStr: string, startDate: string, endDate: string): number {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const totalMs = endMs - startMs || 1;
  return Math.max(0, Math.min(100, ((new Date(dateStr).getTime() - startMs) / totalMs) * 100));
}

function widthPercent(startStr: string, endStr: string, axisStart: string, axisEnd: string): number {
  const startMs = new Date(axisStart).getTime();
  const endMs = new Date(axisEnd).getTime();
  const totalMs = endMs - startMs || 1;
  return Math.max(
    4,
    Math.min(100, ((new Date(endStr).getTime() - new Date(startStr).getTime()) / totalMs) * 100)
  );
}

function readPayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(ARRANGE_DRAG) || event.dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if ((parsed.kind === "bar" || parsed.kind === "marker") && typeof parsed.id === "string") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function ArrangeScheduleFields({
  timeline,
  layout,
  onChange,
  disabled,
}: ArrangeScheduleFieldsProps) {
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [dropRow, setDropRow] = useState<number | "hidden" | null>(null);

  const months = useMemo(
    () => monthKeys(timeline.startDate, timeline.endDate),
    [timeline.startDate, timeline.endDate]
  );
  const boundMonths = useMemo(() => {
    const dates = [
      timeline.startDate,
      timeline.endDate,
      ...timeline.bars.flatMap((bar) => [bar.startDate, bar.endDate]),
      ...timeline.markers.map((marker) => marker.date),
    ];
    const start = dates.reduce((min, d) => (d < min ? d : min));
    const end = dates.reduce((max, d) => (d > max ? d : max));
    return monthKeys(start, end);
  }, [timeline]);
  const placed = useMemo(() => applyTimelineLayout(timeline, layout), [timeline, layout]);
  const hiddenBars = timeline.bars.filter(
    (bar) => bar.phaseId && layout.hiddenBarIds?.includes(bar.phaseId)
  );
  const hiddenMarkers = timeline.markers.filter(
    (marker) => marker.itemId && layout.hiddenMarkerIds?.includes(marker.itemId)
  );

  function startDrag(event: DragEvent, payload: DragPayload) {
    if (disabled) return;
    event.dataTransfer.setData(ARRANGE_DRAG, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
    setSelected(payload);
  }

  function applyDrop(payload: DragPayload, target: number | "hidden") {
    if (payload.kind === "bar") {
      const bar = timeline.bars.find((item) => item.phaseId === payload.id);
      if (!bar) return;
      if (target === "hidden") {
        onChange({
          ...layout,
          hiddenBarIds: toggleTimelineHiddenId(layout.hiddenBarIds, payload.id, true),
        });
        return;
      }
      onChange({
        ...layout,
        hiddenBarIds: toggleTimelineHiddenId(layout.hiddenBarIds, payload.id, false),
        rows: setTimelineLayoutRow(layout.rows, payload.id, bar.rowIndex, target),
      });
      return;
    }
    const marker = timeline.markers.find((item) => item.itemId === payload.id);
    if (!marker) return;
    const originalRow = marker.rowIndex ?? 1;
    if (target === "hidden") {
      onChange({
        ...layout,
        hiddenMarkerIds: toggleTimelineHiddenId(layout.hiddenMarkerIds, payload.id, true),
      });
      return;
    }
    onChange({
      ...layout,
      hiddenMarkerIds: toggleTimelineHiddenId(layout.hiddenMarkerIds, payload.id, false),
      rows: setTimelineLayoutRow(layout.rows, payload.id, originalRow, target),
    });
  }

  function commitLabel(id: string, original: string, value: string) {
    onChange({
      ...layout,
      labels: setTimelineLayoutLabel(layout.labels, id, original, value),
    });
  }

  const selectedBar =
    selected?.kind === "bar" ? timeline.bars.find((bar) => bar.phaseId === selected.id) : undefined;
  const selectedMarker =
    selected?.kind === "marker"
      ? timeline.markers.find((marker) => marker.itemId === selected.id)
      : undefined;
  const selectedOriginal = selectedBar?.label ?? selectedMarker?.label ?? "";
  const selectedHidden = selected
    ? selected.kind === "bar"
      ? Boolean(selected.id && layout.hiddenBarIds?.includes(selected.id))
      : Boolean(selected.id && layout.hiddenMarkerIds?.includes(selected.id))
    : false;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-body-sm font-semibold text-surface-800 dark:text-surface-100">
          Arrange this report’s schedule
        </p>
        <p className="text-body-sm text-surface-600 dark:text-surface-400 mt-1">
          Drag bars and key dates between rows, or into Hidden. Dates stay as stored on the Plan.
          Click an item to rename or hide it for this slide.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-label-sm font-semibold uppercase tracking-wide text-surface-500 mb-1">
            Window start
          </label>
          <select
            className={INPUT_CLASS}
            disabled={disabled}
            value={toMonthKey(layout.windowStartYmd ?? timeline.startDate)}
            onChange={(event) => {
              const start = `${event.target.value}-01`;
              const end = layout.windowEndYmd ?? timeline.endDate;
              if (!isReadableTimelineWindow(start, end)) {
                return;
              }
              onChange(
                setTimelineLayoutWindow(
                  layout,
                  start,
                  end,
                  timeline.startDate,
                  timeline.endDate
                ) ?? {}
              );
            }}
          >
            {boundMonths.map((monthKey) => (
              <option key={`start-${monthKey}`} value={monthKey}>
                {monthLabel(monthKey)} {monthKey.slice(0, 4)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-label-sm font-semibold uppercase tracking-wide text-surface-500 mb-1">
            Window end
          </label>
          <select
            className={INPUT_CLASS}
            disabled={disabled}
            value={toMonthKey(layout.windowEndYmd ?? timeline.endDate)}
            onChange={(event) => {
              const end = monthEndYmd(event.target.value);
              const start = layout.windowStartYmd ?? timeline.startDate;
              if (!isReadableTimelineWindow(start, end)) {
                return;
              }
              onChange(
                setTimelineLayoutWindow(
                  layout,
                  start,
                  end,
                  timeline.startDate,
                  timeline.endDate
                ) ?? {}
              );
            }}
          >
            {boundMonths.map((monthKey) => (
              <option key={`end-${monthKey}`} value={monthKey}>
                {monthLabel(monthKey)} {monthKey.slice(0, 4)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-body-sm text-surface-500 max-w-md">
          Widen or shrink the slide window. Month columns must stay at least 50px wide so labels stay readable.
        </p>
      </div>

      <div className="rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden bg-white dark:bg-dark-surface">
        <div
          className="grid bg-surface-700 text-white"
          style={{ gridTemplateColumns: `44px repeat(${Math.max(months.length, 1)}, minmax(0, 1fr))` }}
        >
          <div className="px-1 py-1 text-label-sm font-semibold uppercase tracking-wide text-surface-200">
            Row
          </div>
          {months.map((monthKey) => (
            <div key={monthKey} className="px-1 py-1 text-center text-label-sm font-semibold uppercase">
              {monthLabel(monthKey)}
            </div>
          ))}
        </div>

        {Array.from(
          { length: TIMELINE_RENDERABLE_ROW_MAX - TIMELINE_RENDERABLE_ROW_MIN + 1 },
          (_, i) => TIMELINE_RENDERABLE_ROW_MIN + i
        ).map((row) => {
          const rowBars = placed.bars.filter((bar) => bar.rowIndex === row);
          const rowMarkers = placed.markers.filter((marker) => (marker.rowIndex ?? 1) === row);
          const isDrop = dropRow === row;
          return (
            <div
              key={row}
              className={`relative border-t border-surface-200 dark:border-dark-border ${
                isDrop ? "bg-jblue-50 dark:bg-jblue-900/20" : "bg-surface-50/60 dark:bg-dark-raised/40"
              }`}
              style={{ height: ROW_HEIGHT }}
              onDragOver={(event) => {
                if (disabled) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropRow(row);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setDropRow((current) => (current === row ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDropRow(null);
                if (disabled) return;
                const payload = readPayload(event);
                if (payload) applyDrop(payload, row);
              }}
            >
              <span className="absolute left-1 top-1 z-[1] text-label-sm font-semibold text-surface-500 tabular-nums w-9">
                {row}
              </span>
              <div className="absolute inset-y-0 right-0" style={{ left: 44 }}>
                {rowBars.map((bar) => {
                  const id = bar.phaseId;
                  if (!id) return null;
                  const isSelected = selected?.kind === "bar" && selected.id === id;
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      draggable={!disabled}
                      title="Drag to another row. Dates stay put."
                      onClick={() => setSelected({ kind: "bar", id })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected({ kind: "bar", id });
                        }
                      }}
                      onDragStart={(event) => startDrag(event, { kind: "bar", id })}
                      onDragEnd={() => setDropRow(null)}
                      className={`absolute top-1.5 h-5 rounded px-1.5 flex items-center gap-0.5 text-white text-label-sm font-semibold overflow-hidden ${
                        isSelected ? "ring-2 ring-offset-1 ring-jblue-500" : ""
                      } ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                      style={{
                        left: `${positionPercent(bar.startDate, timeline.startDate, timeline.endDate)}%`,
                        width: `${widthPercent(bar.startDate, bar.endDate, timeline.startDate, timeline.endDate)}%`,
                        backgroundColor: bar.color ?? BAR_BG,
                        opacity: bar.muted ? 0.45 : 1,
                      }}
                    >
                      <GripVertical size={12} className="shrink-0 opacity-80" aria-hidden />
                      <span className="truncate">{bar.label}</span>
                    </div>
                  );
                })}
                {rowMarkers.map((marker) => {
                  const id = marker.itemId;
                  if (!id) return null;
                  const isSelected = selected?.kind === "marker" && selected.id === id;
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      draggable={!disabled}
                      title="Drag to another row. Date stays put."
                      onClick={() => setSelected({ kind: "marker", id })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected({ kind: "marker", id });
                        }
                      }}
                      onDragStart={(event) => startDrag(event, { kind: "marker", id })}
                      onDragEnd={() => setDropRow(null)}
                      className={`absolute bottom-0.5 flex flex-col items-center w-20 -ml-10 ${
                        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                      }`}
                      style={{
                        left: `${positionPercent(marker.date, timeline.startDate, timeline.endDate)}%`,
                        opacity: marker.muted ? 0.45 : 1,
                      }}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full border-2 bg-white ${
                          isSelected ? "ring-2 ring-jblue-500" : ""
                        }`}
                        style={{ borderColor: MARKER_COLOR }}
                        aria-hidden
                      />
                      <span className="text-[10px] leading-tight text-surface-700 dark:text-surface-200 text-center line-clamp-2">
                        {marker.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`rounded-lg border border-dashed px-3 py-2 min-h-14 ${
          dropRow === "hidden"
            ? "border-jblue-500 bg-jblue-50 dark:bg-jblue-900/20"
            : "border-surface-300 dark:border-dark-muted bg-surface-50 dark:bg-dark-raised"
        }`}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropRow("hidden");
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDropRow((current) => (current === "hidden" ? null : current));
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDropRow(null);
          if (disabled) return;
          const payload = readPayload(event);
          if (payload) applyDrop(payload, "hidden");
        }}
      >
        <p className="text-label-sm font-semibold uppercase tracking-wide text-surface-500 mb-2">
          Hidden — drag here to omit from this slide, or drag a chip back onto a row
        </p>
        <div className="flex flex-wrap gap-2">
          {hiddenBars.length === 0 && hiddenMarkers.length === 0 ? (
            <p className="text-body-sm text-surface-500">Nothing hidden.</p>
          ) : null}
          {hiddenBars.map((bar) => {
            const id = bar.phaseId;
            if (!id) return null;
            return (
              <button
                key={id}
                type="button"
                draggable={!disabled}
                onClick={() => setSelected({ kind: "bar", id })}
                onDragStart={(event) => startDrag(event, { kind: "bar", id })}
                onDragEnd={() => setDropRow(null)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted cursor-grab active:cursor-grabbing"
              >
                <EyeOff size={12} aria-hidden />
                {layout.labels?.[id] ?? bar.label}
              </button>
            );
          })}
          {hiddenMarkers.map((marker) => {
            const id = marker.itemId;
            if (!id) return null;
            return (
              <button
                key={id}
                type="button"
                draggable={!disabled}
                onClick={() => setSelected({ kind: "marker", id })}
                onDragStart={(event) => startDrag(event, { kind: "marker", id })}
                onDragEnd={() => setDropRow(null)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted cursor-grab active:cursor-grabbing"
              >
                <EyeOff size={12} aria-hidden />
                {layout.labels?.[id] ?? marker.label}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (selectedBar || selectedMarker) ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-label-sm font-semibold uppercase tracking-wide text-surface-500 mb-1">
              Slide name
            </label>
            <input
              type="text"
              className={INPUT_CLASS}
              disabled={disabled}
              defaultValue={layout.labels?.[selected.id] ?? selectedOriginal}
              key={`${selected.id}-${layout.labels?.[selected.id] ?? selectedOriginal}`}
              onBlur={(e) => commitLabel(selected.id, selectedOriginal, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-body-sm border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised"
            onClick={() =>
              applyDrop(selected, selectedHidden ? (selectedBar?.rowIndex ?? selectedMarker?.rowIndex ?? 1) : "hidden")
            }
          >
            <EyeOff size={14} aria-hidden />
            {selectedHidden ? "Show on slide" : "Hide on this slide"}
          </button>
        </div>
      ) : (
        <p className="text-body-sm text-surface-500">Click a bar or key date to rename or hide it.</p>
      )}
    </div>
  );
}
