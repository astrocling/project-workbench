/**
 * Shared Status Report TimelineBlock metrics (HTML preview + PDF fallback).
 *
 * Plan schedules use a taller row split into a bar band and a marker band so
 * key-date labels never paint on top of the next phase bar.
 * Project Timeline schedules keep the original compact overlay so 4 rows still
 * fit the 16:9 slide (the Plan metrics would overflow and cover activities).
 */
export const SR_TIMELINE_ROW_HEIGHT_PX = 18;
export const SR_TIMELINE_BAR_TOP_PX = 3;
export const SR_TIMELINE_BAR_HEIGHT_PX = 12;
export const SR_TIMELINE_MARKER_ICON_PX = 8;
export const SR_TIMELINE_MARKER_COL_PX = 76;
export const SR_TIMELINE_BAR_FONT_PX = 7;
export const SR_TIMELINE_MARKER_FONT_PX = 6;
export const SR_TIMELINE_MONTH_FONT_PX = 7;
export const SR_PLAN_LANE_LABEL_COL_PX = 100;
export const SR_TIMELINE_MARKER_MIN_GAP_PCT = 12;
export const SR_TIMELINE_MONTH_HEADER_PX = 12;
export const SR_TIMELINE_REPORT_DATE_LABEL_PX = 8;

/** Slide chart width inside StatusReportView padding (720 − 48). */
export const SR_TIMELINE_CHART_WIDTH_PX = 672;
export const SR_TIMELINE_MIN_MONTH_COL_PX = 50;
export const SR_TIMELINE_MAX_VISIBLE_MONTHS = Math.floor(
  SR_TIMELINE_CHART_WIDTH_PX / SR_TIMELINE_MIN_MONTH_COL_PX
);

/** Marker stack starts just below the bar so icons do not cover phase names. */
export const SR_TIMELINE_MARKER_TOP_PX =
  SR_TIMELINE_BAR_TOP_PX + SR_TIMELINE_BAR_HEIGHT_PX + 1;

export type StatusReportTimelineMetrics = {
  mode: "overlay" | "bands" | "lanes";
  rowHeightPx: number;
  barTopPx: number;
  barHeightPx: number | null;
  markerIconPx: number;
  markerColPx: number;
  barFontPx: number;
  markerFontPx: number;
  monthFontPx: number;
  markerTopPx: number;
  labelColPx: number;
};

const PLAN_TIMELINE_METRICS: StatusReportTimelineMetrics = {
  mode: "lanes",
  rowHeightPx: SR_TIMELINE_ROW_HEIGHT_PX,
  barTopPx: SR_TIMELINE_BAR_TOP_PX,
  barHeightPx: SR_TIMELINE_BAR_HEIGHT_PX,
  markerIconPx: SR_TIMELINE_MARKER_ICON_PX,
  markerColPx: SR_TIMELINE_MARKER_COL_PX,
  barFontPx: SR_TIMELINE_BAR_FONT_PX,
  markerFontPx: SR_TIMELINE_MARKER_FONT_PX,
  monthFontPx: SR_TIMELINE_MONTH_FONT_PX,
  markerTopPx: 4,
  labelColPx: 0,
};

const PROJECT_TIMELINE_METRICS: StatusReportTimelineMetrics = {
  mode: "overlay",
  rowHeightPx: 14,
  barTopPx: 2,
  barHeightPx: null,
  markerIconPx: 11,
  markerColPx: 52,
  barFontPx: 5,
  markerFontPx: 5,
  monthFontPx: 6,
  markerTopPx: 0,
  labelColPx: 0,
};

export function getStatusReportTimelineMetrics(
  scheduleSource?: "timeline" | "plan" | null
): StatusReportTimelineMetrics {
  return scheduleSource === "plan" ? PLAN_TIMELINE_METRICS : PROJECT_TIMELINE_METRICS;
}

export function scaleStatusReportTimelineMetrics(
  metrics: StatusReportTimelineMetrics,
  scale: number
): StatusReportTimelineMetrics {
  if (scale === 1) return metrics;
  return {
    ...metrics,
    rowHeightPx: metrics.rowHeightPx * scale,
    barTopPx: metrics.barTopPx * scale,
    barHeightPx: metrics.barHeightPx == null ? null : metrics.barHeightPx * scale,
    markerIconPx: metrics.markerIconPx * scale,
    markerColPx: metrics.markerColPx * scale,
    barFontPx: metrics.barFontPx * scale,
    markerFontPx: metrics.markerFontPx * scale,
    monthFontPx: metrics.monthFontPx * scale,
    markerTopPx: metrics.markerTopPx * scale,
    labelColPx: metrics.labelColPx * scale,
  };
}

/** Alternate hanging left/right of the date so clustered key dates do not stack. */
export function timelineMarkerHangsLeft(indexInRow: number): boolean {
  return indexInRow % 2 === 0;
}

export function pickSpacedTimelineMarkers<T extends { date: string; label?: string }>(
  markers: T[],
  axisStart: string,
  axisEnd: string,
  minGapPct = SR_TIMELINE_MARKER_MIN_GAP_PCT
): T[] {
  const startMs = new Date(axisStart).getTime();
  const totalMs = new Date(axisEnd).getTime() - startMs || 1;
  const sorted = [...markers].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.label ?? "").localeCompare(b.label ?? "")
  );
  const kept: T[] = [];
  let lastPct = Number.NEGATIVE_INFINITY;
  for (const marker of sorted) {
    const pct = ((new Date(marker.date).getTime() - startMs) / totalMs) * 100;
    if (pct - lastPct >= minGapPct) {
      kept.push(marker);
      lastPct = pct;
    }
  }
  return kept;
}

export function formatPlanKeyDatesLine(
  markers: Array<{ label: string; date: string }>,
  maxItems = 10
): string {
  const sorted = [...markers].sort(
    (a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)
  );
  const shown = sorted.slice(0, maxItems);
  const extra = sorted.length - shown.length;
  const parts = shown.map((marker) => {
    const [y, m, d] = marker.date.slice(0, 10).split("-").map(Number);
    return `${m}/${d} ${marker.label}`;
  });
  if (extra > 0) parts.push(`+${extra} more`);
  return parts.join(" · ");
}

export function timelineLaneLabel(
  bars: Array<{ label: string }>,
  markers: Array<{ label: string }>,
  rowIndex: number
): string {
  const names = [...new Set(bars.map((bar) => bar.label.trim()).filter(Boolean))];
  if (names.length > 0) return names.join(" / ");
  if (markers[0]?.label) return markers[0].label;
  return `Row ${rowIndex}`;
}

export type TimelineLayoutOverlay = {
  hiddenBarIds?: string[];
  hiddenMarkerIds?: string[];
  labels?: Record<string, string>;
  rows?: Record<string, number>;
  windowStartYmd?: string;
  windowEndYmd?: string;
};

type LayoutBar = {
  phaseId?: string;
  rowIndex: number;
  label: string;
  startDate: string;
  endDate: string;
  color?: string | null;
  muted?: boolean;
};

type LayoutMarker = {
  itemId?: string;
  label: string;
  date: string;
  shape?: string;
  rowIndex?: number;
  muted?: boolean;
};

export type LayoutTimelineSlice = {
  startDate: string;
  endDate: string;
  bars: LayoutBar[];
  markers: LayoutMarker[];
};

function clampRow(row: number): number | null {
  if (!Number.isInteger(row) || row < 1 || row > 4) return null;
  return row;
}

function overlayLabel(id: string | undefined, labels: Record<string, string> | undefined, fallback: string) {
  if (!id || !labels) return fallback;
  const next = labels[id]?.trim();
  return next ? next : fallback;
}

function listWithId(ids: string[] | undefined, id: string, hidden: boolean): string[] | undefined {
  const set = new Set(ids ?? []);
  if (hidden) set.add(id);
  else set.delete(id);
  const next = [...set];
  return next.length > 0 ? next : undefined;
}

export function toggleTimelineHiddenId(
  ids: string[] | undefined,
  id: string,
  hidden: boolean
): string[] | undefined {
  return listWithId(ids, id, hidden);
}

export function setTimelineLayoutLabel(
  labels: Record<string, string> | undefined,
  id: string,
  original: string,
  value: string
): Record<string, string> | undefined {
  const next = { ...(labels ?? {}) };
  const trimmed = value.trim();
  if (!trimmed || trimmed === original) {
    delete next[id];
  } else {
    next[id] = trimmed;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function setTimelineLayoutRow(
  rows: Record<string, number> | undefined,
  id: string,
  original: number,
  value: number
): Record<string, number> | undefined {
  const next = { ...(rows ?? {}) };
  const clamped = clampRow(value);
  if (clamped == null || clamped === original) delete next[id];
  else next[id] = clamped;
  return Object.keys(next).length > 0 ? next : undefined;
}

export function inclusiveMonthCount(startYmd: string, endYmd: string): number {
  const start = new Date(`${startYmd.slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${endYmd.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 0;
  }
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
}

export function isReadableTimelineWindow(startYmd: string, endYmd: string): boolean {
  const months = inclusiveMonthCount(startYmd, endYmd);
  return months >= 1 && months <= SR_TIMELINE_MAX_VISIBLE_MONTHS;
}

export function statusReportMonthHeaderLabel(monthKey: string, monthCount: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  const long = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" }).toUpperCase();
  if (monthCount <= 4) return long;
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
}

export function setTimelineLayoutWindow(
  layout: TimelineLayoutOverlay | undefined,
  windowStartYmd: string,
  windowEndYmd: string,
  autoStartYmd: string,
  autoEndYmd: string
): TimelineLayoutOverlay | undefined {
  const next: TimelineLayoutOverlay = { ...(layout ?? {}) };
  const start = windowStartYmd.slice(0, 10);
  const end = windowEndYmd.slice(0, 10);
  if (!isReadableTimelineWindow(start, end) || start > end) {
    return layout;
  }
  const matchesAuto = start === autoStartYmd.slice(0, 10) && end === autoEndYmd.slice(0, 10);
  if (matchesAuto) {
    delete next.windowStartYmd;
    delete next.windowEndYmd;
  } else {
    next.windowStartYmd = start;
    next.windowEndYmd = end;
  }
  if (
    (next.hiddenBarIds?.length ?? 0) === 0 &&
    (next.hiddenMarkerIds?.length ?? 0) === 0 &&
    !next.labels &&
    !next.rows &&
    !next.windowStartYmd &&
    !next.windowEndYmd
  ) {
    return undefined;
  }
  return next;
}

/** Hide, rename, and re-row compact bars/markers by Plan source id. Dates are never changed. */
export function applyTimelineLayout<T extends LayoutTimelineSlice>(
  timeline: T,
  layout?: TimelineLayoutOverlay | null
): T {
  if (!layout) return timeline;
  const hiddenBars = new Set(layout.hiddenBarIds ?? []);
  const hiddenMarkers = new Set(layout.hiddenMarkerIds ?? []);
  const bars = timeline.bars
    .filter((bar) => !bar.phaseId || !hiddenBars.has(bar.phaseId))
    .map((bar) => {
      const row = bar.phaseId ? clampRow(layout.rows?.[bar.phaseId] ?? bar.rowIndex) : bar.rowIndex;
      return {
        ...bar,
        label: overlayLabel(bar.phaseId, layout.labels, bar.label),
        rowIndex: row ?? bar.rowIndex,
      };
    });
  const markers = timeline.markers
    .filter((marker) => !marker.itemId || !hiddenMarkers.has(marker.itemId))
    .map((marker) => {
      const currentRow = marker.rowIndex ?? 1;
      const row = marker.itemId ? clampRow(layout.rows?.[marker.itemId] ?? currentRow) : currentRow;
      return {
        ...marker,
        label: overlayLabel(marker.itemId, layout.labels, marker.label),
        rowIndex: row ?? currentRow,
      };
    });
  const startDate = layout.windowStartYmd?.slice(0, 10) || timeline.startDate;
  const endDate = layout.windowEndYmd?.slice(0, 10) || timeline.endDate;
  return { ...timeline, startDate, endDate, bars, markers };
}

function pickExisting<T extends string | number>(
  record: Record<string, T> | undefined,
  ids: Set<string>
): Record<string, T> | undefined {
  if (!record) return undefined;
  const next: Record<string, T> = {};
  for (const [id, value] of Object.entries(record)) {
    if (ids.has(id)) next[id] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Keep layout keys that still exist on the rebuilt compact schedule. */
export function pruneTimelineLayout(
  layout: TimelineLayoutOverlay | undefined,
  timeline: Pick<LayoutTimelineSlice, "bars" | "markers">
): TimelineLayoutOverlay | undefined {
  if (!layout) return undefined;
  const barIds = new Set(timeline.bars.map((bar) => bar.phaseId).filter((id): id is string => !!id));
  const markerIds = new Set(
    timeline.markers.map((marker) => marker.itemId).filter((id): id is string => !!id)
  );
  const hiddenBarIds = (layout.hiddenBarIds ?? []).filter((id) => barIds.has(id));
  const hiddenMarkerIds = (layout.hiddenMarkerIds ?? []).filter((id) => markerIds.has(id));
  const labels = pickExisting(layout.labels, new Set([...barIds, ...markerIds]));
  const rows = pickExisting(layout.rows, new Set([...barIds, ...markerIds]));
  const windowStartYmd = layout.windowStartYmd?.slice(0, 10);
  const windowEndYmd = layout.windowEndYmd?.slice(0, 10);
  const hasWindow =
    Boolean(windowStartYmd && windowEndYmd) &&
    isReadableTimelineWindow(windowStartYmd!, windowEndYmd!);
  if (
    hiddenBarIds.length === 0 &&
    hiddenMarkerIds.length === 0 &&
    !labels &&
    !rows &&
    !hasWindow
  ) {
    return undefined;
  }
  return {
    ...(hiddenBarIds.length > 0 ? { hiddenBarIds } : {}),
    ...(hiddenMarkerIds.length > 0 ? { hiddenMarkerIds } : {}),
    ...(labels ? { labels } : {}),
    ...(rows ? { rows } : {}),
    ...(hasWindow ? { windowStartYmd, windowEndYmd } : {}),
  };
}
