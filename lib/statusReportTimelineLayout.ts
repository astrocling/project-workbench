/**
 * Shared Status Report TimelineBlock metrics (HTML preview + PDF fallback).
 *
 * Plan schedules use a taller row split into a bar band and a marker band so
 * key-date labels never paint on top of the next phase bar.
 * Project Timeline schedules keep the original compact overlay so 4 rows still
 * fit the 16:9 slide (the Plan metrics would overflow and cover activities).
 */
import { MODULAR_BODY_TYPE_PX, MODULAR_CHROME_SCALE } from "@/lib/reportPanels";
import {
  expandScheduleEntriesToOwnRows,
  getActiveTimelineRows,
  getCompactPlanTimelineRows,
  getVisibleMarkersForRow,
  TIMELINE_FILL_ROW_MAX,
  type PlanReportDensity,
} from "@/lib/plan/reportSchedule";

export const SR_TIMELINE_ROW_HEIGHT_PX = 18;
export const SR_TIMELINE_BAR_TOP_PX = 3;
export const SR_TIMELINE_BAR_HEIGHT_PX = 12;
export const SR_TIMELINE_MARKER_ICON_PX = 8;
export const SR_TIMELINE_MARKER_COL_PX = 76;
export const SR_TIMELINE_BAR_FONT_PX = 7;
export const SR_TIMELINE_MARKER_FONT_PX = 6;
export const SR_TIMELINE_MONTH_FONT_PX = 7;
export const SR_PLAN_LANE_LABEL_COL_PX = 100;
/** Modular filled slot: phase names live in this rail so bars stay uncluttered. */
export const SR_FILL_PHASE_LABEL_COL_PX = 112;
/** Advanced Modular: wide enough for names like "Kickoff and Discovery". */
export const SR_FILL_ADVANCED_PHASE_LABEL_COL_PX = 240;
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

export const SR_TIMELINE_SLOT_HEIGHT_PX = 70;

export type StatusReportTimelineMetrics = {
  mode: "overlay" | "bands" | "lanes" | "pinned";
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
  topBandPx: number;
  bottomRailPx: number;
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
  topBandPx: 0,
  bottomRailPx: 0,
};

const PLAN_ADVANCED_TIMELINE_METRICS: StatusReportTimelineMetrics = {
  ...PLAN_TIMELINE_METRICS,
  mode: "pinned",
  markerTopPx: SR_TIMELINE_MARKER_TOP_PX,
  topBandPx: 0,
  bottomRailPx: 0,
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
  topBandPx: 0,
  bottomRailPx: 0,
};

/** Tall Modular slot: module body type, key dates under bars, one lane per phase. */
const PLAN_FILL_TIMELINE_METRICS: StatusReportTimelineMetrics = {
  mode: "bands",
  rowHeightPx: 40,
  barTopPx: 4,
  barHeightPx: 18,
  markerIconPx: 12,
  markerColPx: 88,
  barFontPx: MODULAR_BODY_TYPE_PX,
  markerFontPx: MODULAR_BODY_TYPE_PX,
  monthFontPx: MODULAR_BODY_TYPE_PX,
  markerTopPx: 8,
  labelColPx: SR_FILL_PHASE_LABEL_COL_PX,
  topBandPx: 0,
  bottomRailPx: 0,
};

const PLAN_ADVANCED_FILL_TIMELINE_METRICS: StatusReportTimelineMetrics = {
  ...PLAN_FILL_TIMELINE_METRICS,
  mode: "pinned",
  markerTopPx:
    PLAN_FILL_TIMELINE_METRICS.barTopPx + (PLAN_FILL_TIMELINE_METRICS.barHeightPx ?? 0) + 1,
  topBandPx: 0,
  bottomRailPx: 0,
  labelColPx: 0,
};

const PROJECT_FILL_TIMELINE_METRICS: StatusReportTimelineMetrics = {
  mode: "bands",
  rowHeightPx: 40,
  barTopPx: 4,
  barHeightPx: 18,
  markerIconPx: 12,
  markerColPx: 88,
  barFontPx: MODULAR_BODY_TYPE_PX,
  markerFontPx: MODULAR_BODY_TYPE_PX,
  monthFontPx: MODULAR_BODY_TYPE_PX,
  markerTopPx: 8,
  labelColPx: SR_FILL_PHASE_LABEL_COL_PX,
  topBandPx: 0,
  bottomRailPx: 0,
};

export function usesPromotedTimeline(
  scheduleSource?: "timeline" | "plan" | null,
  planDensity?: PlanReportDensity | null
): boolean {
  return scheduleSource === "plan" && planDensity !== "phases";
}

export function statusReportTimelineSlotHeightPx(opts: {
  scheduleSource?: "timeline" | "plan" | null;
  planDensity?: PlanReportDensity | null;
  contentHeightPx?: number;
}): number {
  if (!usesPromotedTimeline(opts.scheduleSource, opts.planDensity)) {
    return SR_TIMELINE_SLOT_HEIGHT_PX;
  }
  return Math.max(SR_TIMELINE_SLOT_HEIGHT_PX, opts.contentHeightPx ?? SR_TIMELINE_SLOT_HEIGHT_PX);
}

export function getStatusReportTimelineMetrics(
  scheduleSource?: "timeline" | "plan" | null,
  options?: { fillAvailableHeight?: boolean; planDensity?: PlanReportDensity | null }
): StatusReportTimelineMetrics {
  const fill = options?.fillAvailableHeight === true;
  if (scheduleSource === "plan") {
    if (usesPromotedTimeline(scheduleSource, options?.planDensity)) {
      return fill ? PLAN_ADVANCED_FILL_TIMELINE_METRICS : PLAN_ADVANCED_TIMELINE_METRICS;
    }
    return fill ? PLAN_FILL_TIMELINE_METRICS : PLAN_TIMELINE_METRICS;
  }
  return fill ? PROJECT_FILL_TIMELINE_METRICS : PROJECT_TIMELINE_METRICS;
}

export function timelineMarkerStackTop(
  baseTop: number,
  index: number,
  step: number,
  enabled: boolean
): number {
  return enabled ? baseTop + index * step : baseTop;
}

export function timelineFillMarkerStep(metrics: StatusReportTimelineMetrics): number {
  return metrics.markerIconPx + metrics.markerFontPx + 4;
}

export function timelineReportDateRowPx(
  fillAvailableHeight: boolean,
  layoutScale: number,
  modularChromeScale: number
): number {
  if (fillAvailableHeight || layoutScale === modularChromeScale) return 16;
  return 8 * layoutScale;
}

export function statusReportTimelineChromeScale(isModular: boolean): number {
  return isModular ? MODULAR_CHROME_SCALE : 1;
}

export function timelinePhaseRowLayout({
  fillAvailableHeight,
  rowHeightPx,
  lockHeight,
}: {
  fillAvailableHeight: boolean;
  rowHeightPx: number;
  lockHeight: boolean;
}): { minHeight: number; flexGrow?: number; flexShrink?: number; flexBasis?: number; height?: number } {
  if (fillAvailableHeight) {
    return { minHeight: rowHeightPx, flexGrow: 1, flexShrink: 0, flexBasis: 0 };
  }
  if (lockHeight) return { minHeight: rowHeightPx, height: rowHeightPx };
  return { minHeight: rowHeightPx };
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
    topBandPx: metrics.topBandPx * scale,
    bottomRailPx: metrics.bottomRailPx * scale,
  };
}

export function timelineMarkerPhaseColor(
  marker: { color?: string | null; phaseId?: string; rowIndex?: number },
  bars: Array<{ color?: string | null; phaseId?: string; rowIndex?: number }>
): string | null {
  if (marker.color) return marker.color;
  const byPhase = marker.phaseId
    ? bars.find((bar) => bar.phaseId === marker.phaseId && bar.color)
    : undefined;
  if (byPhase?.color) return byPhase.color;
  const byRow =
    marker.rowIndex != null
      ? bars.find((bar) => bar.rowIndex === marker.rowIndex && bar.color)
      : undefined;
  return byRow?.color ?? null;
}

export function timelinePhaseWash(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return undefined;
  const n = match[1];
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.1)`;
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

export type PinnedLabelBox = { cxPct: number; topPx: number };

export const PINNED_LABEL_DRAG_THRESHOLD_PX = 3;

/** One line of pinned label text (matches leading-tight + font size in TimelineBlock). */
export function pinnedLabelLineHeightPx(markerFontPx: number): number {
  return markerFontPx + 4;
}

/** Two-line clamp height for pinned labels (HTML WebkitLineClamp: 2 and PDF wrap). */
export function pinnedLabelBlockHeightPx(markerFontPx: number): number {
  return pinnedLabelLineHeightPx(markerFontPx) * 2;
}

/** Vertical step when stacking clustered pinned labels. */
export function pinnedLabelStackStepPx(markerFontPx: number): number {
  return pinnedLabelBlockHeightPx(markerFontPx) + 4;
}

/** Chart column width inside slide padding (672 − phase label rail). */
export function statusReportTimelineChartWidthPx(labelColPx: number): number {
  return SR_TIMELINE_CHART_WIDTH_PX - labelColPx;
}

export function pinnedLabelCxPctBounds(
  markerColPx: number,
  chartWidthPx: number
): { minCxPct: number; maxCxPct: number } {
  if (chartWidthPx <= 0) return { minCxPct: 0, maxCxPct: 100 };
  const halfWidthPct = (markerColPx / 2 / chartWidthPx) * 100;
  return { minCxPct: halfWidthPct, maxCxPct: 100 - halfWidthPct };
}

export function truncatePinnedLabelText(
  label: string,
  markerColPx: number,
  markerFontPx: number,
  maxLines = 2
): string {
  const charsPerLine = Math.max(4, Math.floor(markerColPx / (markerFontPx * 0.55)));
  const maxChars = charsPerLine * maxLines;
  if (label.length <= maxChars) return label;
  return `${label.slice(0, maxChars - 1)}…`;
}

export function movePinnedLabelBox(
  start: PinnedLabelBox,
  deltaXPct: number,
  deltaYPx: number,
  opts: { minTopPx: number; maxTopPx?: number; minCxPct: number; maxCxPct: number }
): PinnedLabelBox {
  const maxTopPx = opts.maxTopPx ?? Number.POSITIVE_INFINITY;
  return {
    cxPct: Math.min(opts.maxCxPct, Math.max(opts.minCxPct, start.cxPct + deltaXPct)),
    topPx: Math.min(maxTopPx, Math.max(opts.minTopPx, start.topPx + deltaYPx)),
  };
}

export function setTimelineLayoutMarkerLabel(
  markerLabelLayout: Record<string, PinnedLabelBox> | undefined,
  id: string,
  box: PinnedLabelBox | null
): Record<string, PinnedLabelBox> | undefined {
  const next = { ...(markerLabelLayout ?? {}) };
  if (box == null) delete next[id];
  else next[id] = box;
  return Object.keys(next).length > 0 ? next : undefined;
}

function timelineAxisDatePercent(date: string, axisStart: string, axisEnd: string): number {
  const startMs = new Date(axisStart).getTime();
  const totalMs = new Date(axisEnd).getTime() - startMs || 1;
  return ((new Date(date).getTime() - startMs) / totalMs) * 100;
}

export function defaultPinnedLabelLayout<T extends { itemId?: string; date: string }>(
  markers: T[],
  axisStart: string,
  axisEnd: string,
  opts: { markerTopPx: number; markerIconPx: number; stackStepPx: number; minGapPct?: number }
): Record<string, PinnedLabelBox> {
  const minGapPct = opts.minGapPct ?? SR_TIMELINE_MARKER_MIN_GAP_PCT;
  const baseTopPx = opts.markerTopPx + opts.markerIconPx + 2;
  const sorted = markers
    .filter((marker): marker is T & { itemId: string } => Boolean(marker.itemId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const layout: Record<string, PinnedLabelBox> = {};
  let lastPct = Number.NEGATIVE_INFINITY;
  let stackIndex = 0;
  for (const marker of sorted) {
    const cxPct = timelineAxisDatePercent(marker.date, axisStart, axisEnd);
    if (cxPct - lastPct < minGapPct) {
      stackIndex += 1;
    } else {
      stackIndex = 0;
    }
    lastPct = cxPct;
    layout[marker.itemId] = {
      cxPct,
      topPx: baseTopPx + stackIndex * opts.stackStepPx,
    };
  }
  return layout;
}

export function resolvePinnedLabelLayout<T extends { itemId?: string; date: string }>(
  markers: T[],
  overlay: TimelineLayoutOverlay | undefined,
  axisStart: string,
  axisEnd: string,
  opts: { markerTopPx: number; markerIconPx: number; stackStepPx: number; minGapPct?: number }
): Record<string, PinnedLabelBox> {
  const layout = defaultPinnedLabelLayout(markers, axisStart, axisEnd, opts);
  const saved = overlay?.markerLabelLayout;
  if (!saved) return layout;
  const resolved = { ...layout };
  for (const [id, box] of Object.entries(saved)) {
    if (id in resolved) resolved[id] = box;
  }
  return resolved;
}

export function timelinePinnedRowHeightPx(
  baseRowHeightPx: number,
  markerIds: string[],
  layout: Record<string, PinnedLabelBox>,
  labelHeightPx: number,
  padPx = 0
): number {
  let max = baseRowHeightPx;
  for (const id of markerIds) {
    const box = layout[id];
    if (box) max = Math.max(max, box.topPx + labelHeightPx + padPx);
  }
  return max;
}

/** Sum of pinned row heights + month header + report-date row (unscaled slide px). */
export function timelinePinnedContentHeightPx(opts: {
  timeline: LayoutTimelineSlice;
  scheduleSource?: "timeline" | "plan" | null;
  planDensity?: PlanReportDensity | null;
  fillAvailableHeight?: boolean;
  layoutScale?: number;
  labelOverlay?: TimelineLayoutOverlay;
  reportDate?: string;
}): number | null {
  const baseMetrics = getStatusReportTimelineMetrics(opts.scheduleSource, {
    fillAvailableHeight: opts.fillAvailableHeight,
    planDensity: opts.planDensity,
  });
  if (baseMetrics.mode !== "pinned") return null;

  const layoutScale = opts.layoutScale ?? 1;
  const fillAvailableHeight = opts.fillAvailableHeight === true;
  const stackStepPx = pinnedLabelStackStepPx(baseMetrics.markerFontPx);
  const labelHeightPx = pinnedLabelBlockHeightPx(baseMetrics.markerFontPx);
  const pinnedOpts = {
    markerTopPx: baseMetrics.markerTopPx,
    markerIconPx: baseMetrics.markerIconPx,
    stackStepPx,
  };

  const chart = fillAvailableHeight
    ? expandScheduleEntriesToOwnRows(opts.timeline)
    : opts.timeline;
  const rowCap = fillAvailableHeight ? TIMELINE_FILL_ROW_MAX : undefined;
  const startYmd = opts.timeline.startDate.slice(0, 10);
  const endYmd = opts.timeline.endDate.slice(0, 10);
  const activeRows = fillAvailableHeight
    ? getActiveTimelineRows(chart, TIMELINE_FILL_ROW_MAX)
    : opts.scheduleSource === "plan"
      ? getCompactPlanTimelineRows(opts.timeline, opts.reportDate)
      : getActiveTimelineRows(opts.timeline);

  let rowsSum = 0;
  for (const row of activeRows) {
    const markersInRow = getVisibleMarkersForRow(chart.markers, row, startYmd, endYmd, rowCap);
    const layout = resolvePinnedLabelLayout(
      markersInRow,
      opts.labelOverlay,
      startYmd,
      endYmd,
      pinnedOpts
    );
    const ids = markersInRow
      .map((marker) => marker.itemId)
      .filter((id): id is string => Boolean(id));
    rowsSum += timelinePinnedRowHeightPx(
      baseMetrics.rowHeightPx,
      ids,
      layout,
      labelHeightPx
    );
  }

  const monthHeaderPx = fillAvailableHeight ? baseMetrics.monthFontPx + 8 : 12 * layoutScale;
  const reportDateInRange =
    opts.reportDate && opts.reportDate >= startYmd && opts.reportDate <= endYmd;
  const reportDateRowPx = reportDateInRange
    ? timelineReportDateRowPx(fillAvailableHeight, layoutScale, MODULAR_CHROME_SCALE)
    : 0;

  return rowsSum * layoutScale + monthHeaderPx + reportDateRowPx;
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
  markerRails?: Record<string, "top" | "bottom">;
  markerLabelLayout?: Record<string, { cxPct: number; topPx: number }>;
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
  phaseId?: string;
  label: string;
  date: string;
  shape?: string;
  rowIndex?: number;
  color?: string | null;
  muted?: boolean;
};

export type LayoutTimelineSlice = {
  startDate: string;
  endDate: string;
  bars: LayoutBar[];
  markers: LayoutMarker[];
};

function clampRow(row: number, maxRow = 4): number | null {
  if (!Number.isInteger(row) || row < 1 || row > maxRow) return null;
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

function overlayHasContent(layout: TimelineLayoutOverlay): boolean {
  return (
    (layout.hiddenBarIds?.length ?? 0) > 0 ||
    (layout.hiddenMarkerIds?.length ?? 0) > 0 ||
    Boolean(layout.labels) ||
    Boolean(layout.rows) ||
    Boolean(layout.markerRails) ||
    Boolean(layout.markerLabelLayout) ||
    Boolean(layout.windowStartYmd && layout.windowEndYmd)
  );
}

export function setTimelineLayoutRow(
  rows: Record<string, number> | undefined,
  id: string,
  original: number,
  value: number,
  maxRow = 4
): Record<string, number> | undefined {
  const next = { ...(rows ?? {}) };
  const clamped = clampRow(value, maxRow);
  if (clamped == null || clamped === original) delete next[id];
  else next[id] = clamped;
  return Object.keys(next).length > 0 ? next : undefined;
}

export type ArrangeScheduleBar = {
  phaseId?: string;
  rowIndex: number;
  label: string;
  color?: string | null;
  muted?: boolean;
};

export type ArrangeScheduleMarker = {
  itemId?: string;
  rowIndex?: number;
  label: string;
  date: string;
  shape?: string;
  muted?: boolean;
};

export type ArrangeScheduleGroup = {
  bar: {
    id: string;
    label: string;
    color: string | null;
    hidden: boolean;
    muted: boolean;
  } | null;
  markers: Array<{
    id: string;
    label: string;
    date: string;
    shape: string;
    hidden: boolean;
    muted: boolean;
  }>;
};

function displayRow(
  id: string | undefined,
  original: number,
  layout: TimelineLayoutOverlay | undefined,
  maxRow: number
): number {
  if (!id) return original;
  return clampRow(layout?.rows?.[id] ?? original, maxRow) ?? original;
}

/** Checklist groups for Arrange: phases in row order, key dates nested, hidden items stay in place. */
export function groupArrangeSchedule(
  timeline: { bars: ArrangeScheduleBar[]; markers: ArrangeScheduleMarker[] },
  layout: TimelineLayoutOverlay | undefined,
  maxRow = 4
): ArrangeScheduleGroup[] {
  const hiddenBars = new Set(layout?.hiddenBarIds ?? []);
  const hiddenMarkers = new Set(layout?.hiddenMarkerIds ?? []);
  const phases = timeline.bars
    .filter((bar): bar is ArrangeScheduleBar & { phaseId: string } => Boolean(bar.phaseId))
    .map((bar) => ({
      bar,
      row: displayRow(bar.phaseId, bar.rowIndex, layout, maxRow),
    }))
    .sort(
      (a, b) =>
        a.row - b.row || a.bar.label.localeCompare(b.bar.label) || a.bar.phaseId.localeCompare(b.bar.phaseId)
    );

  const usedMarkerIds = new Set<string>();
  const groups: ArrangeScheduleGroup[] = phases.map(({ bar, row }) => {
    const markers = timeline.markers
      .filter((marker): marker is ArrangeScheduleMarker & { itemId: string } => Boolean(marker.itemId))
      .filter((marker) => displayRow(marker.itemId, marker.rowIndex ?? 1, layout, maxRow) === row)
      .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
    for (const marker of markers) usedMarkerIds.add(marker.itemId);
    return {
      bar: {
        id: bar.phaseId,
        label: overlayLabel(bar.phaseId, layout?.labels, bar.label),
        color: bar.color ?? null,
        hidden: hiddenBars.has(bar.phaseId),
        muted: bar.muted === true,
      },
      markers: markers.map((marker) => ({
        id: marker.itemId,
        label: overlayLabel(marker.itemId, layout?.labels, marker.label),
        date: marker.date,
        shape: marker.shape ?? "Pin",
        hidden: hiddenMarkers.has(marker.itemId),
        muted: marker.muted === true,
      })),
    };
  });

  const orphans = timeline.markers
    .filter((marker): marker is ArrangeScheduleMarker & { itemId: string } => Boolean(marker.itemId))
    .filter((marker) => !usedMarkerIds.has(marker.itemId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  if (orphans.length > 0) {
    groups.push({
      bar: null,
      markers: orphans.map((marker) => ({
        id: marker.itemId,
        label: overlayLabel(marker.itemId, layout?.labels, marker.label),
        date: marker.date,
        shape: marker.shape ?? "Pin",
        hidden: hiddenMarkers.has(marker.itemId),
        muted: marker.muted === true,
      })),
    });
  }
  return groups;
}

/** Swap a phase with its neighbor in Arrange order; markers on those rows move with them. */
export function moveArrangePhase(
  layout: TimelineLayoutOverlay,
  timeline: { bars: ArrangeScheduleBar[]; markers: ArrangeScheduleMarker[] },
  phaseId: string,
  direction: -1 | 1,
  maxRow = 4
): TimelineLayoutOverlay {
  const phases = timeline.bars
    .filter((bar): bar is ArrangeScheduleBar & { phaseId: string } => Boolean(bar.phaseId))
    .map((bar) => ({
      id: bar.phaseId,
      original: bar.rowIndex,
      row: displayRow(bar.phaseId, bar.rowIndex, layout, maxRow),
    }))
    .sort((a, b) => a.row - b.row || a.id.localeCompare(b.id));
  const index = phases.findIndex((phase) => phase.id === phaseId);
  const neighbor = index >= 0 ? phases[index + direction] : undefined;
  if (index < 0 || !neighbor) return layout;

  const rowA = phases[index].row;
  const rowB = neighbor.row;
  if (rowA === rowB) return layout;

  const assignments: Array<{ id: string; original: number }> = [
    { id: phases[index].id, original: phases[index].original },
    { id: neighbor.id, original: neighbor.original },
    ...timeline.markers
      .filter((marker): marker is ArrangeScheduleMarker & { itemId: string } => Boolean(marker.itemId))
      .map((marker) => ({
        id: marker.itemId,
        original: marker.rowIndex ?? 1,
        row: displayRow(marker.itemId, marker.rowIndex ?? 1, layout, maxRow),
      }))
      .filter((marker) => marker.row === rowA || marker.row === rowB),
  ];

  let rows = layout.rows;
  for (const item of assignments) {
    const current = displayRow(item.id, item.original, layout, maxRow);
    const nextRow = current === rowA ? rowB : rowA;
    rows = setTimelineLayoutRow(rows, item.id, item.original, nextRow, maxRow);
  }
  return { ...layout, rows };
}

/** Move a key date to the neighboring phase group in Arrange (row overlay only). */
export function moveArrangeKeyDate(
  layout: TimelineLayoutOverlay,
  timeline: { bars: ArrangeScheduleBar[]; markers: ArrangeScheduleMarker[] },
  markerId: string,
  direction: -1 | 1,
  maxRow = 4
): TimelineLayoutOverlay {
  const groups = groupArrangeSchedule(timeline, layout, maxRow).filter((group) => group.bar);
  const groupIndex = groups.findIndex((group) => group.markers.some((marker) => marker.id === markerId));
  const target = groupIndex >= 0 ? groups[groupIndex + direction] : undefined;
  if (groupIndex < 0 || !target?.bar) return layout;
  const marker = timeline.markers.find((item) => item.itemId === markerId);
  if (!marker) return layout;
  const targetPhase = timeline.bars.find((bar) => bar.phaseId === target.bar.id);
  const targetRow = displayRow(target.bar.id, targetPhase?.rowIndex ?? 1, layout, maxRow);
  const original = marker.rowIndex ?? 1;
  const rows = setTimelineLayoutRow(layout.rows, markerId, original, targetRow, maxRow);
  return { ...layout, rows };
}

export function timelineLayoutFromPreviousSnapshot(
  snapshot:
    | {
        scheduleSource?: string;
        timelineLayout?: TimelineLayoutOverlay;
      }
    | null
    | undefined
): TimelineLayoutOverlay | undefined {
  if (snapshot?.scheduleSource !== "plan" || !snapshot.timelineLayout) return undefined;
  const layout = snapshot.timelineLayout;
  return overlayHasContent(layout) ? layout : undefined;
}

export function persistTimelineLayoutOnSnapshot<
  T extends {
    timeline?: Pick<LayoutTimelineSlice, "bars" | "markers">;
    timelineLayout?: TimelineLayoutOverlay;
  },
>(snapshot: T, layout: TimelineLayoutOverlay | undefined): T {
  if (!layout) return snapshot;
  const pruned = snapshot.timeline ? pruneTimelineLayout(layout, snapshot.timeline) : layout;
  if (!pruned) return snapshot;
  return { ...snapshot, timelineLayout: pruned };
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
  if (!overlayHasContent(next)) {
    return undefined;
  }
  return next;
}

/** Hide, rename, and re-row compact bars/markers by Plan source id. Dates are never changed. */
export function applyTimelineLayout<T extends LayoutTimelineSlice>(
  timeline: T,
  layout?: TimelineLayoutOverlay | null,
  maxRow = 4
): T {
  if (!layout) return timeline;
  const hiddenBars = new Set(layout.hiddenBarIds ?? []);
  const hiddenMarkers = new Set(layout.hiddenMarkerIds ?? []);
  const bars = timeline.bars
    .filter((bar) => !bar.phaseId || !hiddenBars.has(bar.phaseId))
    .map((bar) => {
      const row = bar.phaseId ? clampRow(layout.rows?.[bar.phaseId] ?? bar.rowIndex, maxRow) : bar.rowIndex;
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
      const row = marker.itemId ? clampRow(layout.rows?.[marker.itemId] ?? currentRow, maxRow) : currentRow;
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

function pickExisting<T>(
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
  const markerLabelLayout = pickExisting(layout.markerLabelLayout, markerIds);
  const windowStartYmd = layout.windowStartYmd?.slice(0, 10);
  const windowEndYmd = layout.windowEndYmd?.slice(0, 10);
  const hasWindow =
    Boolean(windowStartYmd && windowEndYmd) &&
    isReadableTimelineWindow(windowStartYmd!, windowEndYmd!);
  const next: TimelineLayoutOverlay = {
    ...(hiddenBarIds.length > 0 ? { hiddenBarIds } : {}),
    ...(hiddenMarkerIds.length > 0 ? { hiddenMarkerIds } : {}),
    ...(labels ? { labels } : {}),
    ...(rows ? { rows } : {}),
    ...(markerLabelLayout ? { markerLabelLayout } : {}),
    ...(hasWindow ? { windowStartYmd, windowEndYmd } : {}),
  };
  return overlayHasContent(next) ? next : undefined;
}
