/**
 * Shared Status Report TimelineBlock metrics (HTML preview + PDF fallback).
 *
 * Plan schedules use a taller row split into a bar band and a marker band so
 * key-date labels never paint on top of the next phase bar.
 * Project Timeline schedules keep the original compact overlay so 4 rows still
 * fit the 16:9 slide (the Plan metrics would overflow and cover activities).
 */
export const SR_TIMELINE_ROW_HEIGHT_PX = 38;
export const SR_TIMELINE_BAR_TOP_PX = 2;
export const SR_TIMELINE_BAR_HEIGHT_PX = 13;
export const SR_TIMELINE_MARKER_ICON_PX = 10;
export const SR_TIMELINE_MARKER_COL_PX = 76;
export const SR_TIMELINE_BAR_FONT_PX = 7;
export const SR_TIMELINE_MARKER_FONT_PX = 6;
export const SR_TIMELINE_MONTH_FONT_PX = 7;

/** Marker stack starts just below the bar so icons do not cover phase names. */
export const SR_TIMELINE_MARKER_TOP_PX =
  SR_TIMELINE_BAR_TOP_PX + SR_TIMELINE_BAR_HEIGHT_PX + 1;

export type StatusReportTimelineMetrics = {
  mode: "overlay" | "bands";
  rowHeightPx: number;
  barTopPx: number;
  barHeightPx: number | null;
  markerIconPx: number;
  markerColPx: number;
  barFontPx: number;
  markerFontPx: number;
  monthFontPx: number;
  markerTopPx: number;
};

const PLAN_TIMELINE_METRICS: StatusReportTimelineMetrics = {
  mode: "bands",
  rowHeightPx: SR_TIMELINE_ROW_HEIGHT_PX,
  barTopPx: SR_TIMELINE_BAR_TOP_PX,
  barHeightPx: SR_TIMELINE_BAR_HEIGHT_PX,
  markerIconPx: SR_TIMELINE_MARKER_ICON_PX,
  markerColPx: SR_TIMELINE_MARKER_COL_PX,
  barFontPx: SR_TIMELINE_BAR_FONT_PX,
  markerFontPx: SR_TIMELINE_MARKER_FONT_PX,
  monthFontPx: SR_TIMELINE_MONTH_FONT_PX,
  markerTopPx: SR_TIMELINE_MARKER_TOP_PX,
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
};

export function getStatusReportTimelineMetrics(
  scheduleSource?: "timeline" | "plan" | null
): StatusReportTimelineMetrics {
  return scheduleSource === "plan" ? PLAN_TIMELINE_METRICS : PROJECT_TIMELINE_METRICS;
}

/** Alternate hanging left/right of the date so clustered key dates do not stack. */
export function timelineMarkerHangsLeft(indexInRow: number): boolean {
  return indexInRow % 2 === 0;
}

export type TimelineLayoutOverlay = {
  hiddenBarIds?: string[];
  hiddenMarkerIds?: string[];
  labels?: Record<string, string>;
  rows?: Record<string, number>;
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
  return { ...timeline, bars, markers };
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
  if (
    hiddenBarIds.length === 0 &&
    hiddenMarkerIds.length === 0 &&
    !labels &&
    !rows
  ) {
    return undefined;
  }
  return {
    ...(hiddenBarIds.length > 0 ? { hiddenBarIds } : {}),
    ...(hiddenMarkerIds.length > 0 ? { hiddenMarkerIds } : {}),
    ...(labels ? { labels } : {}),
    ...(rows ? { rows } : {}),
  };
}
