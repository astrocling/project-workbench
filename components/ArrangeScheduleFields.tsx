"use client";

import { useMemo, type ReactNode } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Diamond,
  Eye,
  EyeOff,
  Flag,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";
import { reportKeyDateKind, TIMELINE_RENDERABLE_ROW_MAX } from "@/lib/plan/reportSchedule";
import {
  groupArrangeSchedule,
  isReadableTimelineWindow,
  moveArrangeKeyDate,
  moveArrangePhase,
  setTimelineLayoutLabel,
  setTimelineLayoutRow,
  setTimelineLayoutWindow,
  toggleTimelineHiddenId,
  type TimelineLayoutOverlay,
} from "@/lib/statusReportTimelineLayout";

const PHASE_INPUT_CLASS =
  "h-7 min-w-0 flex-1 px-1.5 rounded text-body-sm bg-transparent border border-transparent hover:border-surface-300 dark:hover:border-dark-muted focus:border-surface-400 dark:focus:border-dark-muted focus:outline-none text-surface-900 dark:text-surface-100";

const CHIP_INPUT_CLASS =
  "h-5 min-w-[4.5rem] max-w-[10rem] px-0.5 bg-transparent border-0 text-body-sm text-surface-800 dark:text-surface-100 focus:outline-none";

const MONTH_SELECT_CLASS =
  "h-7 px-1.5 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted";

const KEY_DATE_ICONS: Record<string, LucideIcon> = {
  Pin: Diamond,
  ThumbsUp: PenLine,
  BadgeAlert: Flag,
  Flag,
  Rocket: Calendar,
  Calendar,
};

type ArrangeScheduleFieldsProps = {
  timeline: NonNullable<StatusReportPDFData["timeline"]>;
  layout: TimelineLayoutOverlay;
  onChange: (next: TimelineLayoutOverlay) => void;
  disabled?: boolean;
  maxRow?: number;
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

function shortDate(ymd: string): string {
  return new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-dark-raised disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function ArrangeScheduleFields({
  timeline,
  layout,
  onChange,
  disabled,
  maxRow = TIMELINE_RENDERABLE_ROW_MAX,
}: ArrangeScheduleFieldsProps) {
  const rowMax = maxRow ?? TIMELINE_RENDERABLE_ROW_MAX;
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
  const groups = useMemo(
    () => groupArrangeSchedule(timeline, layout, rowMax),
    [timeline, layout, rowMax]
  );

  function commitLabel(id: string, original: string, value: string) {
    onChange({
      ...layout,
      labels: setTimelineLayoutLabel(layout.labels, id, original, value),
    });
  }

  function toggleHidden(kind: "bar" | "marker", id: string, hidden: boolean) {
    if (kind === "bar") {
      onChange({
        ...layout,
        hiddenBarIds: toggleTimelineHiddenId(layout.hiddenBarIds, id, hidden),
      });
      return;
    }
    onChange({
      ...layout,
      hiddenMarkerIds: toggleTimelineHiddenId(layout.hiddenMarkerIds, id, hidden),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-body-sm font-semibold text-surface-800 dark:text-surface-100">
          Arrange this report’s schedule
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-label-sm font-semibold uppercase tracking-wide text-surface-500">
            Months
          </span>
          <select
            aria-label="Window start"
            className={MONTH_SELECT_CLASS}
            disabled={disabled}
            value={toMonthKey(layout.windowStartYmd ?? timeline.startDate)}
            onChange={(event) => {
              const start = `${event.target.value}-01`;
              const end = layout.windowEndYmd ?? timeline.endDate;
              if (!isReadableTimelineWindow(start, end)) return;
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
          <span className="text-surface-400" aria-hidden>
            –
          </span>
          <select
            aria-label="Window end"
            className={MONTH_SELECT_CLASS}
            disabled={disabled}
            value={toMonthKey(layout.windowEndYmd ?? timeline.endDate)}
            onChange={(event) => {
              const end = monthEndYmd(event.target.value);
              const start = layout.windowStartYmd ?? timeline.startDate;
              if (!isReadableTimelineWindow(start, end)) return;
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
      </div>

      <div className="rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden bg-white dark:bg-dark-surface">
        <div className="hidden sm:grid grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] gap-3 px-2 py-1 bg-surface-50 dark:bg-dark-raised text-label-sm font-semibold uppercase tracking-wide text-surface-500">
          <div>Phase</div>
          <div>Key dates</div>
        </div>
        {groups.length === 0 ? (
          <p className="px-2 py-2 text-body-sm text-surface-500">Nothing on this schedule.</p>
        ) : null}
        {groups.map((group, groupIndex) => {
          const phaseId = group.bar?.id;
          const groupKey = phaseId ?? `orphans-${groupIndex}`;
          const canMoveUp = Boolean(phaseId) && groupIndex > 0 && groups[groupIndex - 1]?.bar;
          const canMoveDown =
            Boolean(phaseId) &&
            groupIndex < groups.length - 1 &&
            groups[groupIndex + 1]?.bar;
          const phaseBar = phaseId
            ? timeline.bars.find((bar) => bar.phaseId === phaseId)
            : undefined;
          const originalRow = phaseBar?.rowIndex ?? 1;
          const currentRow = layout.rows?.[phaseId!] ?? originalRow;
          const showLineButtons = rowMax <= 4;
          return (
            <div
              key={groupKey}
              className="grid grid-cols-1 sm:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] gap-2 sm:gap-3 px-2 py-1.5 border-t border-surface-200 dark:border-dark-border items-center"
            >
              {group.bar ? (
                <div className={`flex items-center gap-1 min-w-0 ${group.bar.hidden ? "opacity-50" : ""}`}>
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: group.bar.color ?? "#1941FA" }}
                    aria-hidden
                  />
                  <input
                    type="text"
                    aria-label="Phase name on this slide"
                    className={PHASE_INPUT_CLASS}
                    disabled={disabled}
                    defaultValue={group.bar.label}
                    key={`${group.bar.id}-${group.bar.label}`}
                    onBlur={(event) => {
                      const phase = group.bar;
                      if (!phase) return;
                      const original =
                        timeline.bars.find((bar) => bar.phaseId === phase.id)?.label ??
                        phase.label;
                      commitLabel(phase.id, original, event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    }}
                  />
                  <IconButton
                    label={group.bar.hidden ? "Show phase on slide" : "Hide phase on this slide"}
                    disabled={disabled}
                    onClick={() => {
                      const phase = group.bar;
                      if (!phase) return;
                      toggleHidden("bar", phase.id, !phase.hidden);
                    }}
                  >
                    {group.bar.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </IconButton>
                  <IconButton
                    label="Move phase up"
                    disabled={disabled || !canMoveUp}
                    onClick={() => onChange(moveArrangePhase(layout, timeline, phaseId!, -1, rowMax))}
                  >
                    <ChevronUp size={14} />
                  </IconButton>
                  <IconButton
                    label="Move phase down"
                    disabled={disabled || !canMoveDown}
                    onClick={() => onChange(moveArrangePhase(layout, timeline, phaseId!, 1, rowMax))}
                  >
                    <ChevronDown size={14} />
                  </IconButton>
                  {showLineButtons ? (
                    <span className="inline-flex items-center gap-0.5 ml-0.5">
                      {[1, 2, 3, 4].map((line) => (
                        <button
                          key={line}
                          type="button"
                          aria-label={`Place phase on line ${line}`}
                          aria-pressed={currentRow === line}
                          disabled={disabled}
                          onClick={() =>
                            onChange({
                              ...layout,
                              rows: setTimelineLayoutRow(layout.rows, phaseId!, originalRow, line, 4),
                            })
                          }
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-label-sm font-semibold disabled:opacity-30 ${
                            currentRow === line
                              ? "bg-surface-800 text-white dark:bg-surface-100 dark:text-surface-900"
                              : "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-dark-raised"
                          }`}
                        >
                          {line}
                        </button>
                      ))}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-label-sm font-semibold uppercase tracking-wide text-surface-500">
                  Other key dates
                </p>
              )}
              <div className="flex flex-wrap gap-1 min-w-0">
                {group.markers.length === 0 ? (
                  <span className="text-body-sm text-surface-400">—</span>
                ) : null}
                {group.markers.map((marker) => {
                  const kind = reportKeyDateKind(marker.shape);
                  const TypeIcon = KEY_DATE_ICONS[kind.shape] ?? Diamond;
                  const canMoveMarkerPrev = Boolean(phaseId) && groupIndex > 0 && Boolean(groups[groupIndex - 1]?.bar);
                  const canMoveMarkerNext =
                    Boolean(phaseId) && groupIndex < groups.length - 1 && Boolean(groups[groupIndex + 1]?.bar);
                  const phaseColor = group.bar?.color ?? "#1941FA";
                  return (
                    <span
                      key={marker.id}
                      title={kind.label}
                      className={`inline-flex items-center gap-0.5 max-w-full h-7 pl-1.5 pr-0.5 rounded-full border border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised ${
                        marker.hidden ? "opacity-50" : ""
                      }`}
                    >
                      <TypeIcon
                        size={12}
                        className="shrink-0"
                        style={{ color: phaseColor }}
                        aria-hidden
                      />
                      <span className="text-label-sm font-semibold uppercase tracking-wide text-surface-500 whitespace-nowrap">
                        {kind.label}
                      </span>
                      <span className="text-label-sm text-surface-500 whitespace-nowrap">
                        {shortDate(marker.date)}
                      </span>
                      <input
                        type="text"
                        aria-label={`${kind.label} name on this slide`}
                        className={CHIP_INPUT_CLASS}
                        disabled={disabled}
                        defaultValue={marker.label}
                        key={`${marker.id}-${marker.label}`}
                        onBlur={(event) => {
                          const original =
                            timeline.markers.find((item) => item.itemId === marker.id)?.label ??
                            marker.label;
                          commitLabel(marker.id, original, event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                        }}
                      />
                      <IconButton
                        label="Move key date to previous phase"
                        disabled={disabled || !canMoveMarkerPrev}
                        onClick={() =>
                          onChange(moveArrangeKeyDate(layout, timeline, marker.id, -1, rowMax))
                        }
                      >
                        <ChevronLeft size={12} />
                      </IconButton>
                      <IconButton
                        label="Move key date to next phase"
                        disabled={disabled || !canMoveMarkerNext}
                        onClick={() =>
                          onChange(moveArrangeKeyDate(layout, timeline, marker.id, 1, rowMax))
                        }
                      >
                        <ChevronRight size={12} />
                      </IconButton>
                      <IconButton
                        label={marker.hidden ? "Show key date on slide" : "Hide key date on this slide"}
                        disabled={disabled}
                        onClick={() => toggleHidden("marker", marker.id, !marker.hidden)}
                      >
                        {marker.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      </IconButton>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
