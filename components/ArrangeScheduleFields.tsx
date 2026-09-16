"use client";

import { useMemo, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";
import { TIMELINE_RENDERABLE_ROW_MAX } from "@/lib/plan/reportSchedule";
import {
  groupArrangeSchedule,
  isReadableTimelineWindow,
  moveArrangePhase,
  setTimelineLayoutLabel,
  setTimelineLayoutWindow,
  toggleTimelineHiddenId,
  type TimelineLayoutOverlay,
} from "@/lib/statusReportTimelineLayout";

const INPUT_CLASS =
  "block w-full h-8 px-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted";

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
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 disabled:opacity-40"
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
    <div className="space-y-3">
      <div>
        <p className="text-body-sm font-semibold text-surface-800 dark:text-surface-100">
          Arrange this report’s schedule
        </p>
        <p className="text-body-sm text-surface-600 dark:text-surface-400 mt-1">
          Show, hide, rename, or reorder for this slide. Plan dates stay as stored on the Plan.
        </p>
      </div>

      <details className="rounded-lg border border-surface-200 dark:border-dark-border px-3 py-2 bg-white dark:bg-dark-surface">
        <summary className="text-body-sm font-semibold text-surface-800 dark:text-surface-100 cursor-pointer">
          Months shown
        </summary>
        <div className="flex flex-wrap items-end gap-3 mt-3">
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
          <p className="text-body-sm text-surface-500 max-w-md">
            Month columns stay at least 50px wide so the slide stays readable.
          </p>
        </div>
      </details>

      <div className="rounded-lg border border-surface-200 dark:border-dark-border divide-y divide-surface-200 dark:divide-dark-border bg-white dark:bg-dark-surface">
        {groups.length === 0 ? (
          <p className="px-3 py-2 text-body-sm text-surface-500">Nothing on this schedule.</p>
        ) : null}
        {groups.map((group, groupIndex) => {
          const phaseId = group.bar?.id;
          const canMoveUp = Boolean(phaseId) && groupIndex > 0 && groups[groupIndex - 1]?.bar;
          const canMoveDown =
            Boolean(phaseId) &&
            groupIndex < groups.length - 1 &&
            groups[groupIndex + 1]?.bar;
          return (
            <div key={phaseId ?? `orphans-${groupIndex}`} className="px-3 py-2 space-y-2">
              {group.bar ? (
                <div className={`flex items-center gap-2 ${group.bar.hidden ? "opacity-50" : ""}`}>
                  <span
                    className="h-3 w-3 rounded-sm shrink-0"
                    style={{ backgroundColor: group.bar.color ?? "#1941FA" }}
                    aria-hidden
                  />
                  <input
                    type="text"
                    aria-label="Phase name on this slide"
                    className={`${INPUT_CLASS} flex-1 min-w-0`}
                    disabled={disabled}
                    defaultValue={group.bar.label}
                    key={`${group.bar.id}-${group.bar.label}`}
                    onBlur={(event) => {
                      const original =
                        timeline.bars.find((bar) => bar.phaseId === group.bar?.id)?.label ??
                        group.bar.label;
                      commitLabel(group.bar.id, original, event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    }}
                  />
                  <IconButton
                    label={group.bar.hidden ? "Show phase on slide" : "Hide phase on this slide"}
                    disabled={disabled}
                    onClick={() => toggleHidden("bar", group.bar.id, !group.bar.hidden)}
                  >
                    {group.bar.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                  <IconButton
                    label="Move phase up"
                    disabled={disabled || !canMoveUp}
                    onClick={() => onChange(moveArrangePhase(layout, timeline, phaseId!, -1, rowMax))}
                  >
                    <ChevronUp size={16} />
                  </IconButton>
                  <IconButton
                    label="Move phase down"
                    disabled={disabled || !canMoveDown}
                    onClick={() => onChange(moveArrangePhase(layout, timeline, phaseId!, 1, rowMax))}
                  >
                    <ChevronDown size={16} />
                  </IconButton>
                </div>
              ) : (
                <p className="text-label-sm font-semibold uppercase tracking-wide text-surface-500">
                  Other key dates
                </p>
              )}
              {group.markers.map((marker) => (
                <div
                  key={marker.id}
                  className={`flex items-center gap-2 pl-5 ${marker.hidden ? "opacity-50" : ""}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-[#FF2020] bg-white shrink-0" aria-hidden />
                  <input
                    type="text"
                    aria-label="Key date name on this slide"
                    className={`${INPUT_CLASS} flex-1 min-w-0`}
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
                    label={marker.hidden ? "Show key date on slide" : "Hide key date on this slide"}
                    disabled={disabled}
                    onClick={() => toggleHidden("marker", marker.id, !marker.hidden)}
                  >
                    {marker.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
