/**
 * Shared Status Report TimelineBlock metrics (HTML preview + PDF fallback).
 * Rows are split into a bar band and a marker band so key-date labels never
 * paint on top of the next phase bar.
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

/** Alternate hanging left/right of the date so clustered key dates do not stack. */
export function timelineMarkerHangsLeft(indexInRow: number): boolean {
  return indexInRow % 2 === 0;
}
