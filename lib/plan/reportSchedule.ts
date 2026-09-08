import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";
import {
  itemShowsOnReports,
  phaseShowsOnReports,
} from "@/lib/plan/reportVisibility";
import { isPlanItemComplete } from "@/lib/plan/completion";

export type PlanReportDensity = "phases" | "phases_and_key_dates";

export type ReportScheduleBar = {
  phaseId?: string;
  rowIndex: number;
  label: string;
  startDate: string;
  endDate: string;
  color: string | null;
  muted?: boolean;
};

export type ReportScheduleMarker = {
  itemId?: string;
  label: string;
  date: string;
  shape: string;
  rowIndex: number;
  muted?: boolean;
};

export type ReportScheduleSlice = {
  bars: ReportScheduleBar[];
  markers: ReportScheduleMarker[];
};

function phaseRowIndex(order: number): number {
  return (order % 4) + 1;
}

function isKeyDateMarker(item: PlanItemJson): boolean {
  if (item.type === "milestone" || item.type === "sign_off" || item.type === "hard_deadline") {
    return true;
  }
  return item.type === "meeting" && item.meetingStatus === "scheduled";
}

function markerShape(item: PlanItemJson): string {
  switch (item.type) {
    case "milestone":
      return "Pin";
    case "sign_off":
      return "ThumbsUp";
    case "hard_deadline":
      return "BadgeAlert";
    case "meeting":
      return "Rocket";
    default:
      return "Pin";
  }
}

function minDate(dates: string[]): string {
  return dates.reduce((min, d) => (d < min ? d : min));
}

function maxDate(dates: string[]): string {
  return dates.reduce((max, d) => (d > max ? d : max));
}

export function compactPlanToSchedule(
  phases: PlanPhaseJson[],
  density: PlanReportDensity
): ReportScheduleSlice | null {
  const datedPhases = phases.filter(
    (phase) => phaseShowsOnReports(phase) && phase.items.length > 0
  );
  if (datedPhases.length === 0) {
    return null;
  }

  const bars = datedPhases
    .map((phase) => {
      const startDates = phase.items.map((item) => item.startDate);
      const endDates = phase.items.map((item) => item.endDate);
      const startDate = minDate(startDates);
      const endDate = maxDate(endDates);
      // Point-only phases render as markers only (no zero-length / one-day bars).
      if (startDate >= endDate) {
        return null;
      }
      const muted = phase.items.every((item) => isPlanItemComplete(item));
      return {
        phaseId: phase.id,
        rowIndex: phaseRowIndex(phase.order),
        label: phase.name,
        startDate,
        endDate,
        color: null,
        ...(muted ? { muted: true } : {}),
      };
    })
    .filter((bar): bar is NonNullable<typeof bar> => bar != null);

  if (density === "phases") {
    return bars.length > 0 ? { bars, markers: [] } : null;
  }

  const markers = datedPhases.flatMap((phase) => {
    const rowIndex = phaseRowIndex(phase.order);
    return phase.items
      .filter((item) => isKeyDateMarker(item) && itemShowsOnReports(item))
      .map((item) => {
        const muted = isPlanItemComplete(item);
        return {
          itemId: item.id,
          label: item.label,
          date: item.startDate,
          shape: markerShape(item),
          rowIndex,
          ...(muted ? { muted: true } : {}),
        };
      });
  });

  return bars.length === 0 && markers.length === 0 ? null : { bars, markers };
}

type ScheduleBar = {
  startDate: string;
  endDate: string;
  rowIndex?: number;
};
type ScheduleMarker = {
  date: string;
  rowIndex?: number;
};

export type TimelineAxisSlice = {
  startDate: string;
  endDate: string;
  bars: ScheduleBar[];
  markers: ScheduleMarker[];
};

export const TIMELINE_RENDERABLE_ROW_MIN = 1;
export const TIMELINE_RENDERABLE_ROW_MAX = 4;

export function isRenderableTimelineRow(rowIndex: number | undefined): boolean {
  const row = rowIndex ?? 1;
  return row >= TIMELINE_RENDERABLE_ROW_MIN && row <= TIMELINE_RENDERABLE_ROW_MAX;
}

/** Clip a bar to the axis; returns null when nothing is visible (zero-length or fully outside). */
export function getVisibleBarSegment(
  bar: Pick<ScheduleBar, "startDate" | "endDate">,
  axisStart: string,
  axisEnd: string
): { visibleStart: string; visibleEnd: string } | null {
  const startYmd = axisStart.slice(0, 10);
  const endYmd = axisEnd.slice(0, 10);
  const visibleStart = bar.startDate > startYmd ? bar.startDate : startYmd;
  const visibleEnd = bar.endDate < endYmd ? bar.endDate : endYmd;
  if (visibleStart < visibleEnd) {
    return { visibleStart, visibleEnd };
  }
  return null;
}

export function isMarkerInAxis(
  marker: Pick<ScheduleMarker, "date">,
  axisStart: string,
  axisEnd: string
): boolean {
  const startYmd = axisStart.slice(0, 10);
  const endYmd = axisEnd.slice(0, 10);
  const date = marker.date.slice(0, 10);
  return date >= startYmd && date <= endYmd;
}

/** Bars and markers default to row 1 when a snapshot omits the row. */
function rowIndexOf(entry: { rowIndex?: number }): number {
  return entry.rowIndex ?? 1;
}

/** Bar segments to draw on one row, clipped to the axis; drops bars with nothing visible. */
export function getVisibleBarSegmentsForRow<B extends ScheduleBar>(
  bars: readonly B[],
  rowIndex: number,
  axisStart: string,
  axisEnd: string
): Array<{ bar: B; visibleStart: string; visibleEnd: string }> {
  if (!isRenderableTimelineRow(rowIndex)) return [];
  const segments: Array<{ bar: B; visibleStart: string; visibleEnd: string }> = [];
  for (const bar of bars) {
    if (rowIndexOf(bar) !== rowIndex) continue;
    const segment = getVisibleBarSegment(bar, axisStart, axisEnd);
    if (segment) segments.push({ bar, ...segment });
  }
  return segments;
}

/**
 * Markers to draw on one row. Out-of-axis markers are dropped rather than clamped to an axis
 * edge, so a marker outside the reported window neither opens a row nor draws at the boundary.
 */
export function getVisibleMarkersForRow<M extends ScheduleMarker>(
  markers: readonly M[],
  rowIndex: number,
  axisStart: string,
  axisEnd: string
): M[] {
  if (!isRenderableTimelineRow(rowIndex)) return [];
  return markers.filter(
    (marker) => rowIndexOf(marker) === rowIndex && isMarkerInAxis(marker, axisStart, axisEnd)
  );
}

/** Rows 1–4 that draw at least one bar segment or marker. Both renderers show exactly these. */
export function getActiveTimelineRows(timeline: TimelineAxisSlice): number[] {
  const startYmd = timeline.startDate.slice(0, 10);
  const endYmd = timeline.endDate.slice(0, 10);
  const rows: number[] = [];
  for (let row = TIMELINE_RENDERABLE_ROW_MIN; row <= TIMELINE_RENDERABLE_ROW_MAX; row += 1) {
    const hasContent =
      getVisibleBarSegmentsForRow(timeline.bars, row, startYmd, endYmd).length > 0 ||
      getVisibleMarkersForRow(timeline.markers, row, startYmd, endYmd).length > 0;
    if (hasContent) rows.push(row);
  }
  return rows;
}

/** True when at least one bar segment or marker is visible on rows 1–4 within the axis. */
export function timelineHasVisibleSchedule(timeline: TimelineAxisSlice): boolean {
  return getActiveTimelineRows(timeline).length > 0;
}
