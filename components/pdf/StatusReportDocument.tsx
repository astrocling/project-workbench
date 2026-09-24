import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Link,
  StyleSheet,
  Svg,
  Circle,
  Path,
  Line,
  Rect,
  G,
} from "@react-pdf/renderer";
import { BRAND_COLORS } from "@/lib/brandColors";
import { formatMonthDay } from "@/lib/formatIsoDate";
import { getWeeksInMonthsForRange } from "@/lib/monthUtils";
import {
  PANEL_META,
  MODULAR_CHROME_SCALE,
  MODULAR_ROW_GAP_PX,
  MODULAR_SHORT_ROW_GROW,
  MODULAR_SLIDE_HEIGHT_PX,
  MODULAR_SLIDE_WIDTH_PX,
  MODULAR_TALL_ROW_GROW,
  normalizeModularPanels,
  rowShapeWeights,
  shouldRenderModularPage2,
  type DonutKpiData,
  type ModularLayoutPage,
  type ModularPanelsDocument,
  type ReportModule,
  type ReportPanel,
  type SprintScheduleData,
  type StoryPointsMetricsData,
} from "@/lib/reportPanels";
import {
  budgetDollarsBurnPercent,
  budgetHoursBurnPercent,
} from "@/lib/statusReportBudgetViews";
import { parseLinkSegments } from "@/lib/statusReportLinks";
import {
  capMeetingsForDisplay,
  planListEmptyMessage,
  type PlanMeetingsSnapshot,
  type PlanReportListItem,
  type PlanReportListSlice,
} from "@/lib/plan/reportLists";
import {
  expandScheduleEntriesToOwnRows,
  getActiveTimelineRows,
  getCompactPlanTimelineRows,
  getVisibleBarSegmentsForRow,
  getVisibleMarkersForRow,
  TIMELINE_FILL_ROW_MAX,
  timelineHasVisibleSchedule,
  type PlanReportDensity,
} from "@/lib/plan/reportSchedule";
import {
  getStatusReportTimelineMetrics,
  scaleStatusReportTimelineMetrics,
  SR_TIMELINE_BAR_FONT_PX,
  SR_TIMELINE_MARKER_COL_PX,
  SR_TIMELINE_MARKER_FONT_PX,
  SR_TIMELINE_MARKER_ICON_PX,
  SR_TIMELINE_MONTH_FONT_PX,
  SR_TIMELINE_SLOT_HEIGHT_PX,
  pickSpacedTimelineMarkers,
  resolvePinnedLabelLayout,
  statusReportMonthHeaderLabel,
  statusReportTimelineSlotHeightPx,
  timelineFillMarkerStep,
  timelineLaneLabel,
  timelineMarkerHangsLeft,
  timelineMarkerPhaseColor,
  timelineMarkerStackTop,
  timelinePhaseRowLayout,
  timelinePhaseWash,
  pinnedLabelBlockHeightPx,
  pinnedLabelStackStepPx,
  statusReportTimelineChartWidthPx,
  timelinePinnedContentHeightPx,
  timelinePinnedPinBottomY,
  timelinePinnedRowHeightPx,
  timelineReportDateRowPx,
  truncatePinnedLabelText,
  type StatusReportTimelineMetrics,
  type TimelineLayoutOverlay,
} from "@/lib/statusReportTimelineLayout";
import type { PlanJson } from "@/lib/plan/serialize";
import { ganttBarLabelTextColor } from "@/lib/plan/ganttBarLabel";

/**
 * Call registerStatusReportFonts(baseUrl) before rendering this document.
 * Server: path.join(process.cwd(), "node_modules/@fontsource/raleway/files")
 * Client: "/fonts" (with fonts in public/fonts/)
 */

// 16:9 slide in points (e.g. 8" x 4.5" at 90pt/inch → 720 x 405)
const PAGE_WIDTH = 720;
const PAGE_HEIGHT = 405;
/** Max height for table + chart block on Non-CDA exports (bottom 1/4 of slide). */
const BOTTOM_QUARTER_HEIGHT = PAGE_HEIGHT / 4;
/** Fixed gap between timeline/activities and budget section. */
const BUDGET_SECTION_GAP = 5;
/** Actual footer height: blue line + padding + one line of text. Prevents footer from stretching. */
const FOOTER_HEIGHT = 14;
const MODULAR_PAD = 24 * MODULAR_CHROME_SCALE;
const MODULAR_FOOTER_HEIGHT = FOOTER_HEIGHT * MODULAR_CHROME_SCALE;
/** Small gap between budget block and footer (in points; ~5px). */
const BUDGET_FOOTER_GAP = 5;
/** Content area height: page minus top padding and footer so budget sits flush above footer. */
const MAIN_CONTENT_HEIGHT = PAGE_HEIGHT - 24 - FOOTER_HEIGHT;
/** Space to reserve at bottom of main column so content doesn't overlap the fixed budget block (content-sized budget + gap). */
const BUDGET_BLOCK_RESERVED = 70;
/** Height reserved for the timeline so it can be pinned above the budget; month row + 4 bar rows + report date. Advanced Plan adds a top key-date band. */
const TIMELINE_SLOT_HEIGHT = SR_TIMELINE_SLOT_HEIGHT_PX;

const BIO_TITLE_COLOR = "#220088";
const BIO_LABEL_COLOR = "#220088";
const BIO_VALUE_COLOR = "#000000";
const BIO_BLOCK_BG = "#F5F5F5";

/** JAKALA footer (brand line + text). */
const FOOTER_LINE_COLOR = "#474797";
const FOOTER_BRAND_COLOR = "#474797";
const FOOTER_MUTED_COLOR = "#6b7280";

/** Timeline colors — match Timeline tab (jblue, jred, month header). */
const TIMELINE_MONTH_BG = "#040966";
const TIMELINE_BAR_BG = "#1941FA"; // jblue-500
const TIMELINE_REPORT_DATE = "#FF2020"; // jred-600
const TIMELINE_MARKER = "#FF2020"; // jred-600 (matches marker icon color in tab)
const TIMELINE_MARKER_LABEL = "#374151"; // surface-700
const TIMELINE_ROW_BORDER = "#d1d5db"; // surface-300 — stronger than surface-200 for visibility
const TIMELINE_MONTH_DIVIDER = "#9ca3af"; // vertical month boundaries (surface-400)

/** Lucide icon path/line data for timeline markers (same icons as Timeline tab). viewBox 0 0 24 24. */
type IconNode =
  | { type: "path"; d: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "rect"; x: number; y: number; width: number; height: number; rx?: number };
const TIMELINE_MARKER_ICONS: Record<string, IconNode[]> = {
  BadgeAlert: [
    { type: "path", d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" },
    { type: "line", x1: 12, y1: 8, x2: 12, y2: 12 },
    { type: "line", x1: 12, y1: 16, x2: 12.01, y2: 16 },
  ],
  ThumbsUp: [
    { type: "path", d: "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" },
    { type: "path", d: "M7 10v12" },
  ],
  TrendingUpDown: [
    { type: "path", d: "M14.828 14.828 21 21" },
    { type: "path", d: "M21 16v5h-5" },
    { type: "path", d: "m21 3-9 9-4-4-6 6" },
    { type: "path", d: "M21 8V3h-5" },
  ],
  Rocket: [
    { type: "path", d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" },
    { type: "path", d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" },
    { type: "path", d: "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" },
    { type: "path", d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" },
  ],
  PencilRuler: [
    { type: "path", d: "M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13" },
    { type: "path", d: "m8 6 2-2" },
    { type: "path", d: "m18 16 2-2" },
    { type: "path", d: "m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17" },
    { type: "path", d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" },
    { type: "path", d: "m15 5 4 4" },
  ],
  Pin: [
    { type: "path", d: "M12 17v5" },
    { type: "path", d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" },
  ],
  Flag: [
    { type: "path", d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" },
    { type: "line", x1: 4, y1: 22, x2: 4, y2: 15 },
  ],
  Calendar: [
    { type: "rect", x: 3, y: 4, width: 18, height: 18, rx: 2 },
    { type: "line", x1: 16, y1: 2, x2: 16, y2: 6 },
    { type: "line", x1: 8, y1: 2, x2: 8, y2: 6 },
    { type: "line", x1: 3, y1: 10, x2: 21, y2: 10 },
  ],
};
const TIMELINE_MARKER_ICON_SIZE = SR_TIMELINE_MARKER_ICON_PX;

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    paddingTop: 24,
    paddingLeft: 24,
    paddingRight: 24,
    paddingBottom: 0,
    fontSize: 9,
    fontFamily: "Raleway",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  },
  /** Full-height wrapper so absolute children (budget, footer) position relative to page bottom. */
  pageInnerWrap: {
    position: "relative",
    width: "100%",
    height: PAGE_HEIGHT - 24,
  },
  /** Constrains content to one page so budget ends exactly above footer (no gap). */
  pageContentWrap: {
    height: MAIN_CONTENT_HEIGHT,
    minHeight: MAIN_CONTENT_HEIGHT,
    flexDirection: "column",
    overflow: "hidden",
  },
  /** Row containing bio (left 50%) and RAG block (right 50%). Both sections align to top; bio keeps full multi-row layout. Minimal gap so status titles sit right below. */
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 12,
  },
  topRowHalf: {
    flex: 1,
    minWidth: 0,
  },
  /** Left column: full biographical section (title, two columns of rows, period). Fills width of left half, flows vertically. */
  biographicalBlock: {
    width: "100%",
  },
  bioTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: BIO_TITLE_COLOR,
    textAlign: "left",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  bioTitleLine: {
    height: 1,
    backgroundColor: BIO_TITLE_COLOR,
    marginBottom: 5,
  },
  bioColumns: {
    flexDirection: "row",
    backgroundColor: BIO_BLOCK_BG,
  },
  bioCol: {
    flex: 1,
    padding: 4,
  },
  bioRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  bioLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: BIO_LABEL_COLOR,
    marginRight: 4,
  },
  bioValue: {
    fontSize: 10,
    fontWeight: "normal",
    color: BIO_VALUE_COLOR,
    flex: 1,
  },
  bioPeriodRow: {
    flexDirection: "row",
    marginTop: 3,
  },
  bioPeriodLabel: {
    fontSize: 10,
    fontWeight: "normal",
    fontStyle: "italic",
    color: BIO_LABEL_COLOR,
    marginRight: 4,
  },
  bioPeriodValue: {
    fontSize: 10,
    fontWeight: "normal",
    fontStyle: "italic",
    color: BIO_VALUE_COLOR,
  },
  /** Wraps content below bio/RAG; status blocks + spacer flow above a pinned timeline slot. paddingBottom reserves space for fixed budget block. */
  mainContentColumn: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 0,
    flexDirection: "column",
    minHeight: 0,
    paddingBottom: BUDGET_BLOCK_RESERVED,
    position: "relative",
  },
  /** Padding so flowing content (status + spacer) doesn't overlap the absolutely positioned timeline. */
  mainContentPadding: {
    flex: 1,
    minHeight: 0,
    paddingBottom: TIMELINE_SLOT_HEIGHT,
  },
  /** Pins timeline above the budget so it doesn't move when status block content grows (e.g. 7 items). */
  timelineSlotFixed: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: BUDGET_BLOCK_RESERVED + BUDGET_SECTION_GAP,
    width: "100%",
  },
  /** Spacer between status blocks and timeline: grows so white space is below status items, not between bio/RAG and status titles. */
  budgetSectionSpacer: {
    flex: 1,
    minHeight: 24,
  },
  /** Fixed gap between timeline/activities and budget — same regardless of content amount. */
  budgetSectionGap: {
    height: BUDGET_SECTION_GAP,
    flexShrink: 0,
  },
  /** Budget section container — last element above footer. */
  budgetSectionPin: {
    flexShrink: 0,
  },
  /** Budget block pinned to bottom of page; no fixed height so it's only as tall as content; small gap above footer. */
  budgetBlockFixed: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: FOOTER_HEIGHT + BUDGET_FOOTER_GAP,
    flexDirection: "column",
  },
  /** Activities (status blocks) + spacer + timeline; flex so spacer absorbs space between status and timeline. */
  middleContent: {
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#060066",
  },
  threeCol: {
    flexDirection: "row",
    marginBottom: 0,
    gap: 12,
    width: "100%",
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
  colTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#060066",
  },
  /** Bullet items in activities columns; match StatusReportView: 7px font, 1.15 line-height, small gap between items. */
  bulletText: {
    fontSize: 7,
    marginBottom: 3,
    lineHeight: 1.2,
  },
  table: {
    marginTop: 6,
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  tableHeader: {
    backgroundColor: "#060066",
    color: "#fff",
    fontWeight: "bold",
    padding: 4,
  },
  tableCell: {
    padding: 4,
    flex: 1,
  },
  // Status report summary table (match copy-paste section exactly)
  srBorder: { borderWidth: 0.5, borderColor: "#e5e7eb" },
  srCellBase: { paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, fontSize: 12 },
  srHeader: {
    backgroundColor: BRAND_COLORS.header,
    color: BRAND_COLORS.onHeader,
    fontWeight: 600,
    fontSize: 12,
    textAlign: "left",
  },
  srLabel: {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    fontWeight: 600,
    fontSize: 12,
    textAlign: "left",
  },
  srLabelMedium: {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    fontWeight: 500,
    fontSize: 12,
    textAlign: "left",
  },
  srWhite: {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    fontSize: 12,
    textAlign: "right",
  },
  srGreen: {
    backgroundColor: BRAND_COLORS.overallBudget,
    color: BRAND_COLORS.onHeader,
    fontSize: 12,
    textAlign: "right",
  },
  srBlue: {
    backgroundColor: BRAND_COLORS.accent,
    color: BRAND_COLORS.onAccent,
    fontSize: 12,
    textAlign: "right",
  },
  srTitleRow: {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    fontWeight: 600,
    fontSize: 14,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
    textAlign: "center",
  },
  /** Compact text for bottom 25% table (fontSize 8). */
  srHeaderCompact: {
    backgroundColor: BRAND_COLORS.header,
    color: BRAND_COLORS.onHeader,
    fontWeight: 600,
    fontSize: 8,
    textAlign: "left",
  },
  /** Same as srHeaderCompact — use for milestones table to match budget tables. */
  srHeaderCompactNeutral: {
    backgroundColor: BRAND_COLORS.header,
    color: BRAND_COLORS.onHeader,
    fontWeight: 600,
    fontSize: 8,
    textAlign: "left",
  },
  srLabelCompact: {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    fontWeight: 600,
    fontSize: 8,
    textAlign: "left",
  },
  srWhiteCompact: {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    fontSize: 8,
    textAlign: "right",
  },
  /** Alternating row background for milestones table (PDF readability). */
  srLabelCompactAlt: {
    backgroundColor: "#f3f4f6",
    color: BRAND_COLORS.onWhite,
    fontWeight: 600,
    fontSize: 8,
    textAlign: "left",
  },
  srWhiteCompactAlt: {
    backgroundColor: "#f3f4f6",
    color: BRAND_COLORS.onWhite,
    fontSize: 8,
    textAlign: "right",
  },
  srGreenCompact: {
    backgroundColor: BRAND_COLORS.overallBudget,
    color: BRAND_COLORS.onHeader,
    fontSize: 8,
    textAlign: "right",
  },
  srBlueCompact: {
    backgroundColor: BRAND_COLORS.accent,
    color: BRAND_COLORS.onAccent,
    fontSize: 8,
    textAlign: "right",
  },
  /** Strikethrough for completed milestones (react-pdf uses textDecoration). */
  srStrikethrough: {
    textDecoration: "line-through",
  },
  timelinePlaceholder: {
    marginTop: 0,
    fontSize: 7,
    color: "#888",
  },
  timelineWrap: {
    position: "relative",
    marginTop: 3,
    width: "100%",
    borderWidth: 1,
    borderColor: TIMELINE_ROW_BORDER,
  },
  timelineMonthRow: {
    flexDirection: "row",
    backgroundColor: TIMELINE_MONTH_BG,
  },
  timelineMonthCell: {
    flex: 1,
    paddingVertical: 1,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  timelineMonthText: {
    fontSize: SR_TIMELINE_MONTH_FONT_PX,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
  },
  timelineBodyRow: {
    flexDirection: "row",
  },
  timelineLaneCol: {
    borderRightWidth: 1,
    borderRightColor: TIMELINE_ROW_BORDER,
  },
  timelineLaneHeader: {
    height: 12,
    backgroundColor: TIMELINE_MONTH_BG,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  timelineLaneHeaderText: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
  },
  timelineLaneCell: {
    justifyContent: "center",
    paddingHorizontal: 3,
    borderBottomWidth: 1,
    borderBottomColor: TIMELINE_ROW_BORDER,
    overflow: "hidden",
  },
  timelineLaneLabel: {
    fontSize: SR_TIMELINE_BAR_FONT_PX,
    fontWeight: "bold",
    color: "#060066",
  },
  timelineChartCol: {
    flex: 1,
  },
  /** Wrapper for bar rows so vertical month-boundary lines can be positioned behind them. */
  timelineBarRowsWrap: {
    position: "relative",
  },
  /** Bar rows wrapper (no extra stacking needed). */
  timelineBarRowsContent: {
    position: "relative",
  },
  /** Per-row layer for vertical month lines; first child in row so it paints behind bars/markers. */
  timelineRowMonthLinesLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  /** Vertical line at a month boundary within a row (position left as % in inline style). */
  timelineMonthBoundaryLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: TIMELINE_MONTH_DIVIDER,
  },
  timelineBarRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: TIMELINE_ROW_BORDER,
    position: "relative",
    zIndex: 1,
  },
  timelineBar: {
    position: "absolute",
    backgroundColor: TIMELINE_BAR_BG,
    borderRadius: 2,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  timelineBarText: {
    fontSize: SR_TIMELINE_BAR_FONT_PX,
    color: "#fff",
    fontWeight: 600,
  },
  timelineMarkerRow: {
    minHeight: 10,
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: TIMELINE_ROW_BORDER,
  },
  timelineMarkerText: {
    fontSize: SR_TIMELINE_MARKER_FONT_PX,
    color: TIMELINE_MARKER_LABEL,
    fontWeight: 500,
    lineHeight: 1.15,
  },
  timelineMarkerLabelWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderRadius: 1,
    marginTop: 0,
    maxWidth: SR_TIMELINE_MARKER_COL_PX,
    alignItems: "center",
  },
  timelineReportDateLine: {
    position: "absolute",
    top: 0,
    width: 2,
    backgroundColor: TIMELINE_REPORT_DATE,
  },
  /** Row under the last bar row for "Report date" label. */
  timelineReportDateLabelRow: {
    position: "relative",
    minHeight: 10,
    width: "100%",
  },
  timelineReportDateLabel: {
    position: "absolute",
    top: 0,
    fontSize: 5,
    fontWeight: "bold",
    color: TIMELINE_REPORT_DATE,
  },
  /** Row above the month header for "Report date" label. */
  timelineReportDateLabelAbove: {
    position: "relative",
    minHeight: 8,
    width: "100%",
  },
  /** Container for table + chart on Non-CDA; no fixed height so no gap below — content-sized only. */
  bottomQuarterSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  /** CDA export: left = milestones table, right = two tables + two charts. Align flex-start so title/header rows line up. */
  cdaBottomSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 0,
  },
  cdaBottomLeft: {
    flex: 1,
    minWidth: 0,
    padding: 0,
  },
  cdaBottomRight: {
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
    gap: 4,
  },
  /** One row: table (shrinks) + chart (fixed) side by side. */
  cdaTableChartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 0,
  },
  /** Table column in table+chart row — takes remaining space so chart fits beside it. */
  cdaTableCol: {
    flex: 1,
    minWidth: 0,
  },
  /** Chart column in table+chart row — fixed width so both charts align on top of each other. */
  cdaChartCol: {
    width: 58,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  cdaTableWrap: {
    borderWidth: 0.5,
    borderColor: "#e5e7eb",
  },
  /** Compact title row for CDA tables (Overall / month name) — same scale as bottom quarter. */
  cdaTitleRowCompact: {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    fontWeight: 600,
    fontSize: 8,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 5,
    paddingRight: 5,
    textAlign: "center",
  },
  bottomQuarterTableCol: {
    flex: 1,
    minWidth: 0,
  },
  bottomQuarterChartCol: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  sprintDonutCol: {
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
  },
  sprintScheduleDateCol: {
    width: 40,
    flexShrink: 0,
  },
  sprintNoPanelData: {
    fontSize: 7,
    color: "#9ca3af",
  },
  /** Smaller cells so table fits in bottom 25%. */
  bottomQuarterCell: {
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 5,
    paddingRight: 5,
    fontSize: 8,
  },
  budgetBurnChartLabel: {
    fontSize: 6,
    textTransform: "uppercase",
    color: "#666",
    marginTop: 1,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  budgetBurnChartValue: {
    fontSize: 10,
    fontWeight: 700,
    color: "#060066",
    marginTop: 1,
    textAlign: "center",
  },
  notesPage: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    padding: 36,
    paddingBottom: 44,
    fontSize: 10,
    fontFamily: "Raleway",
  },
  /** JAKALA footer: fixed at bottom, fixed height so it doesn't stretch and create a gap above the blue line. */
  footerWrap: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 0,
    height: FOOTER_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: FOOTER_LINE_COLOR,
    paddingTop: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  footerLeft: {
    flex: 1,
  },
  footerBrand: {
    fontSize: 10,
    fontWeight: "bold",
    color: FOOTER_BRAND_COLOR,
  },
  footerCenter: {
    flex: 1,
    textAlign: "center",
    fontSize: 9,
    color: FOOTER_MUTED_COLOR,
  },
  footerRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  footerDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#d1d5db",
  },
  footerYear: {
    fontSize: 9,
    color: FOOTER_MUTED_COLOR,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 12,
  },
  // RAG (Project Status) block — right half of top row; column layout so header + rows stack vertically
  ragBlock: {
    width: "100%",
    flexDirection: "column",
  },
  ragTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: BIO_TITLE_COLOR,
    textAlign: "left",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  ragTitleLine: {
    height: 1,
    backgroundColor: BIO_TITLE_COLOR,
    marginBottom: 5,
  },
  ragHeaderRow: {
    flexDirection: "row",
    backgroundColor: BIO_TITLE_COLOR,
    minHeight: 16,
  },
  ragHeaderCell: {
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  ragHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#fff",
  },
  ragHeaderLabel: { width: 72 },
  ragHeaderRag: { width: 24, alignItems: "center", justifyContent: "center" },
  ragHeaderExplanation: { flex: 1, minWidth: 0 },
  ragDataRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#F5F5F5",
    minHeight: 14,
  },
  ragDataRowAlt: {
    backgroundColor: "#fff",
  },
  ragLabelCell: {
    width: 72,
    paddingVertical: 2,
    paddingHorizontal: 3,
    flexShrink: 0,
  },
  ragLabelText: {
    fontSize: 7,
    fontWeight: "bold",
    color: BIO_LABEL_COLOR,
  },
  ragPillCell: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    flexShrink: 0,
  },
  /** Pill/capsule shape like Float Stale / Actuals Stale alerts */
  ragPill: {
    width: 18,
    height: 8,
    borderRadius: 4,
  },
  ragExplanationCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  ragExplanationText: {
    fontSize: 7,
    color: BIO_VALUE_COLOR,
  },
  modularPhysicalPage: {
    overflow: "hidden",
    fontFamily: "Raleway",
  },
  modularScaledCanvas: {
    width: MODULAR_SLIDE_WIDTH_PX,
    height: MODULAR_SLIDE_HEIGHT_PX,
    transform: "scale(0.5)",
    transformOrigin: "0 0",
    paddingTop: MODULAR_PAD,
    paddingLeft: MODULAR_PAD,
    paddingRight: MODULAR_PAD,
    paddingBottom: 0,
    fontSize: 12,
    fontFamily: "Raleway",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  },
  modularPageInner: {
    position: "relative",
    width: "100%",
    height: MODULAR_SLIDE_HEIGHT_PX - MODULAR_PAD,
  },
  modularContent: {
    height: MODULAR_SLIDE_HEIGHT_PX - MODULAR_PAD - MODULAR_FOOTER_HEIGHT,
    flexDirection: "column",
    overflow: "hidden",
  },
  modularGrid: {
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
    gap: MODULAR_ROW_GAP_PX,
  },
  modularRowTall: {
    flexGrow: MODULAR_TALL_ROW_GROW,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: "row",
    minHeight: 0,
    gap: MODULAR_ROW_GAP_PX,
  },
  modularRowShort: {
    flexGrow: MODULAR_SHORT_ROW_GROW,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: "row",
    minHeight: 0,
    gap: MODULAR_ROW_GAP_PX,
  },
  modularCell: {
    minWidth: 0,
    height: "100%",
  },
  modularModuleBox: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "column",
    overflow: "hidden",
  },
  modularModuleHeader: {
    backgroundColor: BRAND_COLORS.header,
    color: BRAND_COLORS.onHeader,
    fontSize: 12,
    fontWeight: 600,
    textAlign: "center",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  modularModuleBody: {
    flex: 1,
    minHeight: 0,
    padding: 8,
    flexDirection: "column",
  },
  modularEmptySlot: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  modularEmptyText: {
    fontSize: 12,
    color: "#6b7280",
  },
  modularListSectionHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: "#374151",
    textTransform: "uppercase",
    marginBottom: 2,
    marginTop: 2,
  },
  modularTableText: {
    fontSize: 12,
  },
  modularBullet: {
    fontSize: 12,
    marginBottom: 3,
    lineHeight: 1.15,
  },
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    marginBottom: 8,
    flexShrink: 0,
  },
  compactHeaderTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: BIO_TITLE_COLOR,
    textTransform: "uppercase",
  },
  compactHeaderMeta: {
    flexDirection: "row",
    marginTop: 2,
    gap: 16,
  },
  compactHeaderMetaText: {
    fontSize: 11,
    color: BIO_VALUE_COLOR,
  },
  compactHeaderMetaLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: BIO_LABEL_COLOR,
  },
  compactRagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compactRagPill: {
    alignItems: "center",
    gap: 2,
  },
  compactRagLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: BIO_LABEL_COLOR,
  },
  compactRagDot: {
    width: 18,
    height: 8,
    borderRadius: 4,
  },
  modularTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 24,
  },
  modularBioTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: BIO_TITLE_COLOR,
    textAlign: "left",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  modularBioTitleLine: {
    height: 2,
    backgroundColor: BIO_TITLE_COLOR,
    marginBottom: 10,
  },
  modularBioCol: {
    flex: 1,
    padding: 8,
  },
  modularBioRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  modularBioLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: BIO_LABEL_COLOR,
    marginRight: 8,
  },
  modularBioValue: {
    fontSize: 14,
    fontWeight: "normal",
    color: BIO_VALUE_COLOR,
    flex: 1,
  },
  modularBioPeriodRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  modularBioPeriodLabel: {
    fontSize: 14,
    fontWeight: "normal",
    fontStyle: "italic",
    color: BIO_LABEL_COLOR,
    marginRight: 8,
  },
  modularBioPeriodValue: {
    fontSize: 14,
    fontWeight: "normal",
    fontStyle: "italic",
    color: BIO_VALUE_COLOR,
  },
  modularRagHeaderRow: {
    flexDirection: "row",
    backgroundColor: BIO_TITLE_COLOR,
    minHeight: 32,
  },
  modularRagHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  modularRagHeaderLabel: { width: 144 },
  modularRagHeaderRag: { width: 48, alignItems: "center", justifyContent: "center" },
  modularRagDataRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#F5F5F5",
    minHeight: 28,
  },
  modularRagLabelCell: {
    width: 144,
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  modularRagLabelText: {
    fontSize: 14,
    fontWeight: "bold",
    color: BIO_LABEL_COLOR,
  },
  modularRagPillCell: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    flexShrink: 0,
  },
  modularRagPill: {
    width: 36,
    height: 16,
    borderRadius: 8,
  },
  modularRagExplanationCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  modularRagExplanationText: {
    fontSize: 14,
    color: BIO_VALUE_COLOR,
  },
  modularFooterWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: MODULAR_FOOTER_HEIGHT,
    borderTopWidth: 2,
    borderTopColor: FOOTER_LINE_COLOR,
    paddingTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  modularFooterBrand: {
    fontSize: 20,
    fontWeight: "bold",
    color: FOOTER_BRAND_COLOR,
  },
  modularFooterCenter: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    color: FOOTER_MUTED_COLOR,
  },
  modularFooterYear: {
    fontSize: 18,
    color: FOOTER_MUTED_COLOR,
  },
  modularFooterDivider: {
    width: 2,
    height: 24,
    backgroundColor: "#d1d5db",
  },
});

export type RagStatus = "Red" | "Amber" | "Green";

export type StatusReportPDFData = {
  report: {
    reportDate: string;
    variation: string;
    completedActivities: string;
    upcomingActivities: string;
    risksIssuesDecisions: string;
    meetingNotes: string | null;
    ragOverall?: RagStatus | null;
    ragScope?: RagStatus | null;
    ragSchedule?: RagStatus | null;
    ragBudget?: RagStatus | null;
    ragOverallExplanation?: string | null;
    ragScopeExplanation?: string | null;
    ragScheduleExplanation?: string | null;
    ragBudgetExplanation?: string | null;
  };
  project: {
    name: string;
    clientName: string;
    clientSponsor: string | null;
    clientSponsor2: string | null;
    otherContact: string | null;
    keyStaffName: string | null;
    projectKeyRoles: Array<{ type: string; person: { name: string } }>;
  };
  period: string;
  today: string;
  budget?: {
    estBudgetHigh: number;
    estBudgetLow: number;
    spentDollars: number;
    remainingDollarsHigh: number;
    remainingDollarsLow: number;
    budgetedHoursHigh: number;
    budgetedHoursLow: number;
    actualHours: number;
    remainingHoursHigh: number;
    remainingHoursLow: number;
    burnPercentHigh: number | null;
  };
  cda?: {
    rows: Array<{ monthKey: string; monthLabel: string; planned: number; mtdActuals: number }>;
    overallBudget: { totalDollars: number; actualDollars: number } | null;
    totalPlanned: number;
    totalMtdActuals: number;
    totalRemaining: number;
    milestones?: Array<{
      id: string;
      phase: string;
      devStartDate: string;
      devEndDate: string;
      uatStartDate: string;
      uatEndDate: string;
      deployDate: string;
      completed: boolean;
    }>;
  };
  timeline?: {
    startDate: string;
    endDate: string;
    bars: Array<{
      phaseId?: string;
      rowIndex: number;
      label: string;
      startDate: string;
      endDate: string;
      color?: string | null;
      muted?: boolean;
    }>;
    markers: Array<{
      itemId?: string;
      phaseId?: string;
      label: string;
      date: string;
      shape?: string;
      rowIndex?: number;
      color?: string | null;
      muted?: boolean;
    }>;
  };
  /** Per-report visual overlay on the locked compact schedule (markerLabelLayout topPx is unscaled slide px). */
  timelineLayout?: import("@/lib/statusReportTimelineLayout").TimelineLayoutOverlay;
  /** When true, CDA Overall table omits Budget ($) row; first chart uses hours completion. */
  cdaReportHoursOnly?: boolean;
  /** When false, Standard report omits bottom budget table and burn chart. Default true. */
  showBudget?: boolean;
  panels?: ReportPanel[] | ModularPanelsDocument;
  /** Locked schedule source; omitted on legacy reports (treated as project timeline). */
  scheduleSource?: "timeline" | "plan";
  planDensity?: PlanReportDensity;
  includeDetailedPlan?: boolean;
  detailedPlan?: PlanJson;
  planAxis?: { kickoffDate: string; endDate: string };
  planMeetings?: PlanMeetingsSnapshot;
  planActivitiesCompleted?: PlanReportListSlice;
  planActivitiesUpcoming?: PlanReportListSlice;
  /** False when Plan is off or missing; list modules show enable-Plan copy. */
  planListsAvailable?: boolean;
};

const MODULAR_METRIC_LABELS: Record<string, string> = {
  planned: "Story Points Planned",
  completed: "Story Points Completed",
  inProgress: "Story Points In Progress",
  carryOver: "Carry Over To Next",
};

/**
 * CDA Overall Hours row (status report): Planned = Budget tab high hours, not sum of CDA monthly plan.
 * Remaining uses the same MTD actuals as the row (sum of CDA month actuals).
 */
export function cdaOverallHoursPlanned(data: StatusReportPDFData): number {
  const cda = data.cda;
  if (!cda) return 0;
  const bh = data.budget?.budgetedHoursHigh;
  if (bh != null && bh > 0) return bh;
  return cda.totalPlanned;
}

export function cdaOverallHoursRemaining(data: StatusReportPDFData): number {
  const cda = data.cda;
  if (!cda) return 0;
  return cdaOverallHoursPlanned(data) - cda.totalMtdActuals;
}

/** Percent of contract hours complete (MTD actuals vs budget hours), 0–100; null if no baseline. */
export function cdaContractHoursCompletePercent(data: StatusReportPDFData): number | null {
  const planned = cdaOverallHoursPlanned(data);
  const cda = data.cda;
  if (!cda || planned <= 0) return null;
  return Math.min(100, Math.max(0, (cda.totalMtdActuals / planned) * 100));
}

function formatNum(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "") || "0";
}
function formatDollars(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/** Two decimals for status report table (match copy-paste). */
function formatReportNum(n: number): string {
  return n.toFixed(2);
}

function getMonthFullName(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
}

function getMonthsForTimeline(startDate: string, endDate: string): string[] {
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

function timelineIconStroke(color: string) {
  return {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
}

/** Renders a timeline marker icon (same Lucide icons as Timeline tab) for PDF. */
function TimelineMarkerIconPdf({
  shape,
  size = TIMELINE_MARKER_ICON_SIZE,
  color = TIMELINE_MARKER,
}: {
  shape: string;
  size?: number;
  color?: string;
}) {
  const nodes = TIMELINE_MARKER_ICONS[shape] ?? TIMELINE_MARKER_ICONS.Pin;
  const stroke = timelineIconStroke(color);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0 }}
    >
      <G>
        {nodes.map((node, i) =>
          node.type === "path" ? (
            <Path key={i} d={node.d} {...stroke} />
          ) : node.type === "rect" ? (
            <Rect
              key={i}
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx={node.rx}
              {...stroke}
            />
          ) : (
            <Line
              key={i}
              x1={node.x1}
              y1={node.y1}
              x2={node.x2}
              y2={node.y2}
              {...stroke}
            />
          )
        )}
      </G>
    </Svg>
  );
}

function TimelineBlock({
  timeline,
  reportDate,
  scheduleSource,
  planDensity,
  labelOverlay,
  layoutScale = 1,
  fillAvailableHeight = false,
}: {
  timeline: NonNullable<StatusReportPDFData["timeline"]>;
  reportDate?: string;
  scheduleSource?: StatusReportPDFData["scheduleSource"];
  planDensity?: StatusReportPDFData["planDensity"];
  /** Offsets in markerLabelLayout are unscaled slide px (match getStatusReportTimelineMetrics before scale). */
  labelOverlay?: TimelineLayoutOverlay;
  layoutScale?: number;
  fillAvailableHeight?: boolean;
}) {
  const startMs = new Date(timeline.startDate).getTime();
  const endMs = new Date(timeline.endDate).getTime();
  const totalMs = endMs - startMs || 1;

  const positionPercent = (dateStr: string) =>
    Math.max(0, Math.min(100, ((new Date(dateStr).getTime() - startMs) / totalMs) * 100));
  const widthPercent = (startStr: string, endStr: string) =>
    Math.max(0, Math.min(100, ((new Date(endStr).getTime() - new Date(startStr).getTime()) / totalMs) * 100));

  const months = getMonthsForTimeline(timeline.startDate, timeline.endDate);

  const startYmd = timeline.startDate.slice(0, 10);
  const endYmd = timeline.endDate.slice(0, 10);
  const reportDateInRange =
    reportDate && reportDate >= startYmd && reportDate <= endYmd;
  const reportDatePercent = reportDateInRange ? positionPercent(reportDate) : null;

  const { weeksInMonths, monthBoundaryPositions } = getWeeksInMonthsForRange(
    months,
    startMs,
    endMs
  );

  const metrics = scaleStatusReportTimelineMetrics(
    getStatusReportTimelineMetrics(scheduleSource, { fillAvailableHeight, planDensity }),
    layoutScale
  );
  const baseMetrics = getStatusReportTimelineMetrics(scheduleSource, {
    fillAvailableHeight,
    planDensity,
  });
  const overlay = metrics.mode === "overlay";
  const lanes = metrics.mode === "lanes";
  const pinned = metrics.mode === "pinned";
  const fillBar = overlay || lanes;
  const stretchBars = fillBar && !fillAvailableHeight;
  const ROW_HEIGHT = metrics.rowHeightPx;
  const labelCol = metrics.labelColPx;
  const markerStep = timelineFillMarkerStep(metrics);
  const pinnedStackStepPx = pinnedLabelStackStepPx(baseMetrics.markerFontPx);
  const pinnedLabelHeightPx = pinnedLabelBlockHeightPx(baseMetrics.markerFontPx);
  const chartWidthPx = statusReportTimelineChartWidthPx(labelCol);
  const pinnedLayoutOpts = {
    markerTopPx: baseMetrics.markerTopPx,
    markerIconPx: baseMetrics.markerIconPx,
    stackStepPx: pinnedStackStepPx,
  };

  const chart = fillAvailableHeight ? expandScheduleEntriesToOwnRows(timeline) : timeline;
  const rowCap = fillAvailableHeight ? TIMELINE_FILL_ROW_MAX : undefined;
  const activeRows = fillAvailableHeight
    ? getActiveTimelineRows(chart, TIMELINE_FILL_ROW_MAX)
    : scheduleSource === "plan"
      ? getCompactPlanTimelineRows(timeline, reportDate)
      : getActiveTimelineRows(timeline);
  const monthHeaderPx = fillAvailableHeight ? metrics.monthFontPx + 8 : 12 * layoutScale;

  const pinnedRowData: Record<
    number,
    { layout: Record<string, { cxPct: number; topPx: number }>; heightPx: number }
  > = {};
  if (pinned) {
    for (const row of activeRows) {
      const markersInRow = getVisibleMarkersForRow(chart.markers, row, startYmd, endYmd, rowCap);
      const layout = resolvePinnedLabelLayout(
        markersInRow,
        labelOverlay,
        startYmd,
        endYmd,
        pinnedLayoutOpts
      );
      const ids = markersInRow
        .map((marker) => marker.itemId)
        .filter((id): id is string => Boolean(id));
      pinnedRowData[row] = {
        layout,
        heightPx:
          timelinePinnedRowHeightPx(
            baseMetrics.rowHeightPx,
            ids,
            layout,
            pinnedLabelHeightPx
          ) * layoutScale,
      };
    }
  }

  const totalRowChartHeightPx = pinned
    ? activeRows.reduce(
        (sum, row) => sum + (pinnedRowData[row]?.heightPx ?? ROW_HEIGHT),
        0
      )
    : activeRows.length * ROW_HEIGHT;

  const rowLayout = (markerCount: number, row?: number) =>
    timelinePhaseRowLayout({
      fillAvailableHeight,
      rowHeightPx:
        row != null && pinned
          ? (pinnedRowData[row]?.heightPx ?? ROW_HEIGHT)
          : Math.max(
              ROW_HEIGHT,
              fillAvailableHeight
                ? ROW_HEIGHT
                : metrics.markerTopPx + Math.max(markerCount, 1) * markerStep + 4
            ),
      lockHeight: lanes && !fillAvailableHeight,
    });

  const monthHeader = (
      <View style={[styles.timelineMonthRow, { height: monthHeaderPx }]}>
        {months.map((monthKey, i) => (
          <View
            key={monthKey}
            style={[styles.timelineMonthCell, { flex: weeksInMonths[i] ?? 1 }]}
          >
            <Text style={[styles.timelineMonthText, { fontSize: metrics.monthFontPx }]}>
              {statusReportMonthHeaderLabel(monthKey, months.length)}
            </Text>
          </View>
        ))}
      </View>
  );

  const barRows = (
      <View
        style={[
          styles.timelineBarRowsWrap,
          fillAvailableHeight ? { flex: 1, minHeight: 0 } : {},
        ]}
      >
        {reportDatePercent != null && (
          <View
            style={[
              styles.timelineReportDateLine,
              {
                left: `${reportDatePercent}%`,
                marginLeft: -1,
                ...(fillAvailableHeight
                  ? { bottom: 0 }
                  : { height: totalRowChartHeightPx + 2 }),
              },
            ]}
          />
        )}
        <View
          style={[
            styles.timelineBarRowsContent,
            fillAvailableHeight ? { flex: 1, flexDirection: "column", minHeight: 0 } : {},
          ]}
        >
        {activeRows.map((row) => {
        const clipped = getVisibleBarSegmentsForRow(chart.bars, row, startYmd, endYmd, rowCap);
        const markersInRow = getVisibleMarkersForRow(chart.markers, row, startYmd, endYmd, rowCap)
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
        const chartMarkers = fillAvailableHeight
          ? pinned
            ? markersInRow
            : pickSpacedTimelineMarkers(markersInRow, startYmd, endYmd)
          : lanes
            ? []
            : markersInRow;
        const rowHeightPx = pinnedRowData[row]?.heightPx ?? ROW_HEIGHT;
        const pinnedLayout = pinnedRowData[row]?.layout ?? {};
        const rowWash = timelinePhaseWash(clipped[0]?.bar.color);
        return (
          <View
            key={row}
            style={[
              styles.timelineBarRow,
              rowLayout(markersInRow.length, row),
              stretchBars
                ? { minHeight: ROW_HEIGHT }
                : fillAvailableHeight
                  ? pinned
                    ? { overflow: "hidden" }
                    : {}
                  : { overflow: "hidden" },
              rowWash ? { backgroundColor: rowWash } : {},
            ]}
          >
            <View style={styles.timelineRowMonthLinesLayer}>
              {monthBoundaryPositions.map((leftPct, i) => (
                <View
                  key={`v-${i}`}
                  style={[styles.timelineMonthBoundaryLine, { left: `${leftPct}%`, marginLeft: -0.5 }]}
                />
              ))}
            </View>
            {clipped.map(({ bar, visibleStart, visibleEnd }, i) => {
              const rawWidth = widthPercent(visibleStart, visibleEnd);
              const renderedWidth = Math.max(rawWidth, 4);
              const maxChars = Math.max(3, Math.floor(rawWidth * 1.2));
              const displayLabel =
                bar.label.length > maxChars
                  ? bar.label.slice(0, maxChars - 1) + "…"
                  : bar.label;
              const fill = bar.color ?? TIMELINE_BAR_BG;
              return (
              <View
                key={`bar-${i}`}
                style={[
                  styles.timelineBar,
                  fillBar && stretchBars
                    ? { top: 1, bottom: 1 }
                    : { top: metrics.barTopPx, height: metrics.barHeightPx ?? undefined },
                  {
                    left: `${positionPercent(visibleStart)}%`,
                    width: `${renderedWidth}%`,
                    backgroundColor: fill,
                    opacity: bar.muted ? 0.45 : 1,
                  },
                ]}
              >
                {!(fillAvailableHeight && labelCol > 0) && (
                <Text
                  style={[
                    styles.timelineBarText,
                    { fontSize: metrics.barFontPx, color: ganttBarLabelTextColor(fill) },
                  ]}
                >
                  {displayLabel}
                </Text>
                )}
              </View>
              );
            })}
            {pinned && chartMarkers.length > 0 && (
              <Svg
                width="100%"
                height={rowHeightPx}
                viewBox={`0 0 ${chartWidthPx} ${rowHeightPx}`}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: rowHeightPx, zIndex: 1 }}
              >
                {chartMarkers.map((m, i) => {
                  const itemId = m.itemId;
                  const box = itemId ? pinnedLayout[itemId] : undefined;
                  if (!box) return null;
                  const stroke = timelineMarkerPhaseColor(m, chart.bars) || "#1941FA";
                  const pinLeftPct = positionPercent(m.date);
                  const labelTop = box.topPx * layoutScale;
                  const pinX = (pinLeftPct / 100) * chartWidthPx;
                  const labelX = (box.cxPct / 100) * chartWidthPx;
                  return (
                    <Line
                      key={`leader-${i}`}
                      x1={pinX}
                      y1={timelinePinnedPinBottomY(metrics)}
                      x2={labelX}
                      y2={labelTop}
                      stroke={stroke}
                      strokeWidth={1}
                      opacity={m.muted ? 0.45 : 1}
                    />
                  );
                })}
              </Svg>
            )}
            {chartMarkers.map((m, i) => {
              if (pinned) {
                const itemId = m.itemId;
                const box = itemId ? pinnedLayout[itemId] : undefined;
                if (!box) return null;
                const stroke = timelineMarkerPhaseColor(m, chart.bars) || "#1941FA";
                const pinLeftPct = positionPercent(m.date);
                return (
                  <React.Fragment key={`m-${itemId ?? i}`}>
                    <View
                      style={{
                        position: "absolute",
                        left: `${pinLeftPct}%`,
                        marginLeft: -metrics.markerIconPx / 2,
                        top: metrics.markerTopPx,
                        zIndex: 2,
                        opacity: m.muted ? 0.45 : 1,
                      }}
                    >
                      <TimelineMarkerIconPdf
                        shape={m.shape ?? "Pin"}
                        size={metrics.markerIconPx}
                        color={stroke}
                      />
                    </View>
                    <View
                      style={{
                        position: "absolute",
                        left: `${box.cxPct}%`,
                        marginLeft: -metrics.markerColPx / 2,
                        top: box.topPx * layoutScale,
                        width: metrics.markerColPx,
                        minHeight: pinnedLabelHeightPx * layoutScale,
                        alignItems: "center",
                        zIndex: 2,
                        opacity: m.muted ? 0.45 : 1,
                        overflow: "hidden",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: metrics.markerFontPx,
                          color: stroke,
                          textAlign: "center",
                          width: metrics.markerColPx,
                          lineHeight: 1.25,
                        }}
                      >
                        {truncatePinnedLabelText(m.label, metrics.markerColPx, metrics.markerFontPx)}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              }

              const hangLeft = !fillBar && !fillAvailableHeight && timelineMarkerHangsLeft(i);
              const pinOnBar = overlay || fillAvailableHeight;
              const stackedTop = timelineMarkerStackTop(
                metrics.markerTopPx,
                i,
                markerStep,
                overlay && !fillAvailableHeight
              );
              return (
              <View
                key={`m-${i}`}
                style={
                  pinOnBar || (lanes && !fillAvailableHeight)
                    ? {
                        position: "absolute",
                        left: `${positionPercent(m.date)}%`,
                        marginLeft: -metrics.markerIconPx / 2,
                        top: stackedTop,
                        flexDirection: "column",
                        alignItems: "center",
                        minWidth: metrics.markerIconPx,
                        zIndex: 2,
                        opacity: m.muted ? 0.45 : 1,
                      }
                    : {
                        position: "absolute",
                        left: `${positionPercent(m.date)}%`,
                        marginLeft: hangLeft ? -metrics.markerColPx : 0,
                        top: stackedTop,
                        width: metrics.markerColPx,
                        flexDirection: "column",
                        alignItems: hangLeft ? "flex-end" : "flex-start",
                        zIndex: 2,
                        opacity: m.muted ? 0.45 : 1,
                      }
                }
              >
                <TimelineMarkerIconPdf shape={m.shape ?? "Pin"} size={metrics.markerIconPx} />
                {overlay && !fillAvailableHeight && (
                <View style={[styles.timelineMarkerLabelWrap, { maxWidth: metrics.markerColPx }]}>
                  <Text
                    style={[styles.timelineMarkerText, { fontSize: metrics.markerFontPx }]}
                    wrap={false}
                  >
                    {m.label}
                  </Text>
                </View>
                )}
                {!fillBar && !fillAvailableHeight && (
                <View style={[styles.timelineMarkerLabelWrap, { maxWidth: metrics.markerColPx }]}>
                  <Text
                    style={[
                      styles.timelineMarkerText,
                      { fontSize: metrics.markerFontPx },
                      { textAlign: hangLeft ? "right" : "left" },
                    ]}
                  >
                    {m.label}
                  </Text>
                </View>
                )}
              </View>
              );
            })}
          </View>
        );
      })}
        </View>
      </View>
  );

  return (
    <View
      style={[
        styles.timelineWrap,
        fillAvailableHeight ? { flex: 1, height: "100%", marginTop: 0 } : {},
      ]}
    >
      <View
        style={[
          styles.timelineBodyRow,
          fillAvailableHeight ? { flex: 1, minHeight: 0 } : {},
        ]}
      >
        {labelCol > 0 && (
          <View style={[styles.timelineLaneCol, { width: labelCol }]}>
            {reportDatePercent != null && (
              <View
                style={{
                  height: timelineReportDateRowPx(
                    fillAvailableHeight,
                    layoutScale,
                    MODULAR_CHROME_SCALE
                  ),
                }}
              />
            )}
            {metrics.topBandPx > 0 && <View style={{ height: metrics.topBandPx }} />}
            <View style={[styles.timelineLaneHeader, { height: monthHeaderPx }]}>
              <Text style={[styles.timelineLaneHeaderText, { fontSize: metrics.monthFontPx }]}>Phase</Text>
            </View>
            {activeRows.map((row) => {
              const clipped = getVisibleBarSegmentsForRow(chart.bars, row, startYmd, endYmd, rowCap);
              const markersInRow = getVisibleMarkersForRow(chart.markers, row, startYmd, endYmd, rowCap);
              return (
                <View key={`lane-${row}`} style={[styles.timelineLaneCell, rowLayout(markersInRow.length, row)]}>
                  <Text
                    style={[styles.timelineLaneLabel, { fontSize: metrics.barFontPx }]}
                    wrap={false}
                  >
                    {timelineLaneLabel(
                      clipped.map((seg) => seg.bar),
                      markersInRow,
                      row
                    )}
                  </Text>
                </View>
              );
            })}
            {metrics.bottomRailPx > 0 && <View style={{ height: metrics.bottomRailPx }} />}
          </View>
        )}
        <View
          style={[
            styles.timelineChartCol,
            fillAvailableHeight ? { flexDirection: "column", minHeight: 0 } : {},
          ]}
        >
          {reportDatePercent != null && (
            <View
              style={[
                styles.timelineReportDateLabelAbove,
                {
                  height: timelineReportDateRowPx(
                    fillAvailableHeight,
                    layoutScale,
                    MODULAR_CHROME_SCALE
                  ),
                  minHeight: timelineReportDateRowPx(
                    fillAvailableHeight,
                    layoutScale,
                    MODULAR_CHROME_SCALE
                  ),
                },
              ]}
            >
              <Text
                style={[
                  styles.timelineReportDateLabel,
                  {
                    left: `${reportDatePercent}%`,
                    marginLeft: -18,
                  },
                ]}
              >
                Report date
              </Text>
            </View>
          )}
          {monthHeader}
          {barRows}
        </View>
      </View>
    </View>
  );
}

/** Max milestones shown in the PDF export table (completed are dropped first). */
const MAX_MILESTONES_ON_PDF = 6;

function milestonesForPdfExport<T extends { completed: boolean }>(milestones: T[]): T[] {
  return [...milestones]
    .sort((a, b) => Number(a.completed) - Number(b.completed))
    .slice(0, MAX_MILESTONES_ON_PDF);
}

function getKeyRoleNames(data: StatusReportPDFData): { cad: string; pm: string; pgm: string; keyStaff: string } {
  const roles = data.project.projectKeyRoles || [];
  const cad = roles.find((r) => r.type === "CAD")?.person?.name ?? "";
  const pm = roles.filter((r) => r.type === "PM").map((r) => r.person?.name).filter(Boolean).join(", ") ?? "";
  const pgm = roles.find((r) => r.type === "PGM")?.person?.name ?? "";
  const keyStaff = data.project.keyStaffName ?? "";
  return { cad, pm, pgm, keyStaff };
}

function bulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Renders a line of text with links (bare URLs and [text](url)) as React-PDF children for use inside <Text>. */
function renderTextWithLinks(line: string): React.ReactNode[] {
  const segments = parseLinkSegments(line);
  return segments.map((seg, i) =>
    seg.type === "link" ? (
      <Link key={i} src={seg.href}>
        {seg.content}
      </Link>
    ) : (
      seg.content
    )
  );
}

const RAG_COLORS: Record<RagStatus, string> = {
  Red: "#dc2626",
  Amber: "#f59e0b",
  Green: "#22c55e",
};

function RagStatusBlock({
  data,
  layoutScale = 1,
}: {
  data: StatusReportPDFData;
  layoutScale?: number;
}) {
  const { report } = data;
  const rows: Array<{ label: string; status: RagStatus | null | undefined; explanation: string | null | undefined }> = [
    { label: "Overall", status: report.ragOverall, explanation: report.ragOverallExplanation },
    { label: "Scope", status: report.ragScope, explanation: report.ragScopeExplanation },
    { label: "Schedule", status: report.ragSchedule, explanation: report.ragScheduleExplanation },
    { label: "Budget", status: report.ragBudget, explanation: report.ragBudgetExplanation },
  ];
  const modular = layoutScale === MODULAR_CHROME_SCALE;
  return (
    <View style={styles.ragBlock}>
      <View style={modular ? styles.modularRagHeaderRow : styles.ragHeaderRow}>
        <View style={[styles.ragHeaderCell, modular ? styles.modularRagHeaderLabel : styles.ragHeaderLabel]}>
          <Text style={modular ? styles.modularRagHeaderText : styles.ragHeaderText}>Project Status</Text>
        </View>
        <View style={[styles.ragHeaderCell, modular ? styles.modularRagHeaderRag : styles.ragHeaderRag]} />
        <View style={[styles.ragHeaderCell, styles.ragHeaderExplanation]}>
          <Text style={modular ? styles.modularRagHeaderText : styles.ragHeaderText}>Explanation</Text>
        </View>
      </View>
      {rows.map((row, i) => (
        <View
          key={row.label}
          style={
            i % 2 === 1
              ? [modular ? styles.modularRagDataRow : styles.ragDataRow, styles.ragDataRowAlt]
              : modular
                ? styles.modularRagDataRow
                : styles.ragDataRow
          }
        >
          <View style={modular ? styles.modularRagLabelCell : styles.ragLabelCell}>
            <Text style={modular ? styles.modularRagLabelText : styles.ragLabelText}>{row.label}</Text>
          </View>
          <View style={modular ? styles.modularRagPillCell : styles.ragPillCell}>
            {row.status ? (
              <View
                style={[
                  modular ? styles.modularRagPill : styles.ragPill,
                  { backgroundColor: RAG_COLORS[row.status as RagStatus] },
                ]}
              />
            ) : null}
          </View>
          <View style={modular ? styles.modularRagExplanationCell : styles.ragExplanationCell}>
            <Text style={modular ? styles.modularRagExplanationText : styles.ragExplanationText}>
              {row.explanation?.trim() ? renderTextWithLinks(row.explanation.trim()) : "—"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Budget burn donut chart for PDF (matches Status report summary chart). Optional label for CDA (e.g. "Contract Hours Complete"). */
function BudgetBurnChartPDF({
  burnPercent,
  compact = false,
  label = "Budget burn ($)",
}: {
  burnPercent: number | null;
  compact?: boolean;
  label?: string;
}) {
  const size = compact ? 36 : 48;
  const r = compact ? 13 : 18;
  const stroke = compact ? 5 : 7;
  const clamped = burnPercent == null ? 0 : Math.min(100, Math.max(0, burnPercent));
  const cx = size / 2;
  const cy = size / 2;
  // Visible track on white background; blue for filled segment
  const trackStroke = "#9ca3af";
  const fillStroke = "#1941FA";

  // Use Path arc instead of Circle+strokeDasharray so the filled segment renders in PDF
  const p = clamped / 100;
  const angle = 2 * Math.PI * p;
  const startX = cx;
  const startY = cy - r;
  const endX = cx + r * Math.sin(angle);
  const endY = cy - r * Math.cos(angle);
  const largeArc = p > 0.5 ? 1 : 0;
  const arcPath =
    clamped >= 99.5
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${r} ${r} 0 0 1 ${cx} ${cy - r}`
      : `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;

  return (
    <View style={styles.bottomQuarterChartCol}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background track — visible gray on white */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={trackStroke}
            strokeWidth={stroke}
          />
          {/* Filled segment — blue arc (Path so it renders in PDF) */}
          {clamped > 0 && (
            <Path
              d={arcPath}
              fill="none"
              stroke={fillStroke}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      </View>
      <Text style={styles.budgetBurnChartValue}>
        {burnPercent != null ? `${burnPercent.toFixed(0)}%` : "—"}
      </Text>
      <Text style={styles.budgetBurnChartLabel}>
        {label}
      </Text>
    </View>
  );
}

function StatusReportFooter({ layoutScale = 1 }: { layoutScale?: number }) {
  const year = new Date().getFullYear();
  const modular = layoutScale === MODULAR_CHROME_SCALE;
  return (
    <View style={modular ? styles.modularFooterWrap : styles.footerWrap} fixed>
      <View style={styles.footerLeft}>
        <Text style={modular ? styles.modularFooterBrand : styles.footerBrand}>JAKALA</Text>
      </View>
      <Text style={modular ? styles.modularFooterCenter : styles.footerCenter}>Company Confidential</Text>
      <View style={styles.footerRight}>
        <View style={modular ? styles.modularFooterDivider : styles.footerDivider} />
        <Text style={modular ? styles.modularFooterYear : styles.footerYear}>{year}</Text>
      </View>
    </View>
  );
}

function modularPdfTitle(module: ReportModule): string {
  switch (module.type) {
    case "narrativeCompleted":
    case "planActivitiesCompleted":
      return "Completed Activities";
    case "narrativeUpcoming":
    case "planActivitiesUpcoming":
      return "Upcoming Activities";
    case "narrativeRisks":
      return "Risks / Issues / Decisions";
    case "planMeetings":
      return "Upcoming Meetings";
    case "storyPointMetrics":
      return "Key Metrics";
    case "donutKpi":
      return module.data.label || PANEL_META.donutKpi.label;
    case "budgetCompactDollars":
      return "Budget";
    case "budgetCompactHours":
      return "Hours";
    default:
      return PANEL_META[module.type].label;
  }
}

function ModularPdfEmptyCopy({ text }: { text: string }) {
  return <Text style={styles.modularEmptyText}>{text}</Text>;
}

function formatPlanPdfDate(date: string | null): string {
  return date ? formatMonthDay(date) : "TBD";
}

function ModularPdfPlanItems({
  items,
  overflowCount,
  showExtra,
}: {
  items: PlanReportListItem[];
  overflowCount: number;
  showExtra?: boolean;
}) {
  return (
    <View>
      {items.map((item) => (
        <Text key={item.id} style={styles.modularBullet}>
          • {formatPlanPdfDate(item.date)}
          {showExtra && item.extra ? ` ${item.extra}` : ""} — {item.label}
        </Text>
      ))}
      {overflowCount > 0 ? (
        <Text style={styles.modularEmptyText}>+{overflowCount} more</Text>
      ) : null}
    </View>
  );
}

function ModularPdfEmpty({ label }: { label: string }) {
  return <Text style={styles.modularEmptyText}>{label} — nothing to show yet.</Text>;
}

function ModularPdfModuleBody({
  module,
  data,
}: {
  module: ReportModule;
  data: StatusReportPDFData;
}) {
  switch (module.type) {
    case "sprintSchedule": {
      const schedule = module.data as SprintScheduleData | undefined;
      const scheduleRows = schedule?.rows ?? [];
      if (scheduleRows.length === 0) {
        return <ModularPdfEmpty label={PANEL_META.sprintSchedule.label} />;
      }
      return (
        <View>
          {scheduleRows.map((row, index) => {
            const alt = index % 2 === 1;
            const labelStyle = alt ? styles.srLabelCompactAlt : styles.srLabelCompact;
            const cellStyle = alt ? styles.srWhiteCompactAlt : styles.srWhiteCompact;
            return (
              <View key={index} style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.bottomQuarterCell, styles.srBorder, labelStyle, styles.sprintScheduleDateCol]}>
                  <Text style={[labelStyle, styles.modularTableText]}>{row.dateRange}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srBorder, cellStyle, { flex: 1 }]}>
                  <Text style={[cellStyle, styles.modularTableText]}>{row.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      );
    }
    case "storyPointMetrics": {
      const metrics = module.data as StoryPointsMetricsData | undefined;
      const systems = metrics?.systems ?? [];
      const metricRows = metrics?.rows ?? [];
      if (systems.length === 0) {
        return <ModularPdfEmpty label={PANEL_META.storyPointMetrics.label} />;
      }
      return (
        <View>
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1.5 }]}>
              <Text style={styles.srHeaderCompact}> </Text>
            </View>
            {systems.map((sys, i) => (
              <View key={i} style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={[styles.srHeaderCompact, { textAlign: "center" }]}>{sys.name}</Text>
              </View>
            ))}
          </View>
          {metricRows.map((row, rowIndex) => {
            const alt = rowIndex % 2 === 1;
            const labelStyle = alt ? styles.srLabelCompactAlt : styles.srLabelCompact;
            const cellStyle = alt ? styles.srWhiteCompactAlt : styles.srWhiteCompact;
            return (
              <View key={rowIndex} style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.bottomQuarterCell, styles.srBorder, labelStyle, { flex: 1.5 }]}>
                  <Text style={[labelStyle, styles.modularTableText]}>
                    {MODULAR_METRIC_LABELS[row.metric] ?? row.metric}
                  </Text>
                </View>
                {row.values.map((v, j) => (
                  <View key={j} style={[styles.bottomQuarterCell, styles.srBorder, cellStyle, { flex: 1 }]}>
                    <Text style={[cellStyle, styles.modularTableText, { textAlign: "center" }]}>{v}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      );
    }
    case "donutKpi": {
      const kpi = module.data as DonutKpiData;
      return <BudgetBurnChartPDF burnPercent={kpi.manualValue ?? 0} compact label={kpi.label} />;
    }
    case "narrativeCompleted":
      return (
        <>
          {bulletLines(data.report.completedActivities)
            .slice(0, 7)
            .map((line, i) => (
              <Text key={i} style={styles.modularBullet}>
                • {renderTextWithLinks(line)}
              </Text>
            ))}
        </>
      );
    case "narrativeUpcoming":
      return (
        <>
          {bulletLines(data.report.upcomingActivities)
            .slice(0, 7)
            .map((line, i) => (
              <Text key={i} style={styles.modularBullet}>
                • {renderTextWithLinks(line)}
              </Text>
            ))}
        </>
      );
    case "narrativeRisks":
      return (
        <>
          {bulletLines(data.report.risksIssuesDecisions)
            .slice(0, 7)
            .map((line, i) => (
              <Text key={i} style={styles.modularBullet}>
                • {renderTextWithLinks(line)}
              </Text>
            ))}
        </>
      );
    case "planMeetings": {
      const available = data.planListsAvailable !== false;
      const meetings = data.planMeetings ?? { needsScheduling: [], scheduled: [] };
      const capped = capMeetingsForDisplay(meetings);
      if (capped.needsScheduling.length === 0 && capped.scheduled.length === 0) {
        return <ModularPdfEmptyCopy text={planListEmptyMessage("meetings", available)} />;
      }
      return (
        <View>
          {capped.needsScheduling.length > 0 ? (
            <View>
              <Text style={styles.modularListSectionHeader}>Needs scheduling</Text>
              <ModularPdfPlanItems
                items={capped.needsScheduling}
                overflowCount={0}
                showExtra
              />
            </View>
          ) : null}
          {capped.scheduled.length > 0 ? (
            <View>
              <Text style={styles.modularListSectionHeader}>Scheduled</Text>
              <ModularPdfPlanItems items={capped.scheduled} overflowCount={0} showExtra />
            </View>
          ) : null}
          {capped.overflowCount > 0 ? (
            <Text style={styles.modularEmptyText}>+{capped.overflowCount} more</Text>
          ) : null}
        </View>
      );
    }
    case "planActivitiesCompleted": {
      const available = data.planListsAvailable !== false;
      const slice = data.planActivitiesCompleted ?? { items: [], overflowCount: 0 };
      if (slice.items.length === 0) {
        return <ModularPdfEmptyCopy text={planListEmptyMessage("completed", available)} />;
      }
      return (
        <ModularPdfPlanItems items={slice.items} overflowCount={slice.overflowCount} />
      );
    }
    case "planActivitiesUpcoming": {
      const available = data.planListsAvailable !== false;
      const slice = data.planActivitiesUpcoming ?? { items: [], overflowCount: 0 };
      if (slice.items.length === 0) {
        return <ModularPdfEmptyCopy text={planListEmptyMessage("upcoming", available)} />;
      }
      return (
        <ModularPdfPlanItems items={slice.items} overflowCount={slice.overflowCount} />
      );
    }
    case "ganttTimeline":
      if (data.timeline && timelineHasVisibleSchedule(data.timeline, TIMELINE_FILL_ROW_MAX)) {
        return (
          <TimelineBlock
            timeline={data.timeline}
            reportDate={data.report.reportDate}
            scheduleSource={data.scheduleSource}
            planDensity={data.planDensity}
            labelOverlay={data.timelineLayout}
            fillAvailableHeight
          />
        );
      }
      return <ModularPdfEmpty label={PANEL_META.ganttTimeline.label} />;
    case "budgetFinancials":
      if (!data.budget) {
        return <ModularPdfEmpty label={PANEL_META.budgetFinancials.label} />;
      }
      return (
        <View style={styles.bottomQuarterSection}>
          <View style={[styles.bottomQuarterTableCol, styles.table]}>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 0.5 }]}>
                <Text style={styles.srHeaderCompact}>{" "}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Est. Budget</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>$ Spent</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>$ Remaining</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Budgeted Hrs</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Actual Hrs</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Hrs Remaining</Text>
              </View>
            </View>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.bottomQuarterCell, styles.srLabelCompact, { flex: 0.5 }]}>
                <Text style={styles.srLabelCompact}>HIGH</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                <Text style={styles.srGreenCompact}>{formatDollars(data.budget.estBudgetHigh)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                <Text style={styles.srWhiteCompact}>{formatDollars(-data.budget.spentDollars)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                <Text style={styles.srGreenCompact}>{formatDollars(data.budget.remainingDollarsHigh)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.budgetedHoursHigh)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                <Text style={styles.srWhiteCompact}>{formatReportNum(-data.budget.actualHours)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.remainingHoursHigh)}</Text>
              </View>
            </View>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.bottomQuarterCell, styles.srLabelCompact, { flex: 0.5 }]}>
                <Text style={styles.srLabelCompact}>LOW</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                <Text style={styles.srGreenCompact}>{formatDollars(data.budget.estBudgetLow)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                <Text style={styles.srWhiteCompact}>{formatDollars(-data.budget.spentDollars)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                <Text style={styles.srGreenCompact}>{formatDollars(data.budget.remainingDollarsLow)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.budgetedHoursLow)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                <Text style={styles.srWhiteCompact}>{formatReportNum(-data.budget.actualHours)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.remainingHoursLow)}</Text>
              </View>
            </View>
          </View>
          <BudgetBurnChartPDF burnPercent={budgetDollarsBurnPercent(data.budget)} compact />
        </View>
      );
    case "budgetCompactDollars":
      if (!data.budget) {
        return <ModularPdfEmpty label={PANEL_META.budgetCompactDollars.label} />;
      }
      return (
        <View style={styles.bottomQuarterSection}>
          <View style={[styles.bottomQuarterTableCol, styles.table]}>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Est</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Spent</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Remaining</Text>
              </View>
            </View>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                <Text style={styles.srGreenCompact}>{formatDollars(data.budget.estBudgetHigh)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                <Text style={styles.srWhiteCompact}>{formatDollars(-data.budget.spentDollars)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                <Text style={styles.srGreenCompact}>{formatDollars(data.budget.remainingDollarsHigh)}</Text>
              </View>
            </View>
          </View>
          <BudgetBurnChartPDF burnPercent={budgetDollarsBurnPercent(data.budget)} compact />
        </View>
      );
    case "budgetCompactHours":
      if (!data.budget) {
        return <ModularPdfEmpty label={PANEL_META.budgetCompactHours.label} />;
      }
      return (
        <View style={styles.bottomQuarterSection}>
          <View style={[styles.bottomQuarterTableCol, styles.table]}>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Budgeted</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Actual</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                <Text style={styles.srHeaderCompact}>Remaining</Text>
              </View>
            </View>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.budgetedHoursHigh)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                <Text style={styles.srWhiteCompact}>{formatReportNum(-data.budget.actualHours)}</Text>
              </View>
              <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.remainingHoursHigh)}</Text>
              </View>
            </View>
          </View>
          <BudgetBurnChartPDF
            burnPercent={budgetHoursBurnPercent(data.budget)}
            compact
            label="Hours burn"
          />
        </View>
      );
    case "budgetBurnOnly":
      if (!data.budget) {
        return <ModularPdfEmpty label={PANEL_META.budgetBurnOnly.label} />;
      }
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <BudgetBurnChartPDF
            burnPercent={budgetDollarsBurnPercent(data.budget)}
            compact
            label="Budget used"
          />
        </View>
      );
    default:
      return <ModularPdfEmpty label={PANEL_META[module.type].label} />;
  }
}

function CompactModularPdfHeader({ data }: { data: StatusReportPDFData }) {
  const pills: Array<{ label: string; status: RagStatus | null | undefined }> = [
    { label: "Overall", status: data.report.ragOverall },
    { label: "Scope", status: data.report.ragScope },
    { label: "Schedule", status: data.report.ragSchedule },
    { label: "Budget", status: data.report.ragBudget },
  ];
  return (
    <View style={styles.compactHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.compactHeaderTitle}>{data.project.name.toUpperCase()}</Text>
        <View style={styles.compactHeaderMeta}>
          <Text style={styles.compactHeaderMetaText}>
            <Text style={styles.compactHeaderMetaLabel}>Period: </Text>
            {data.period}
          </Text>
          <Text style={styles.compactHeaderMetaText}>
            <Text style={styles.compactHeaderMetaLabel}>Report date: </Text>
            {data.today}
          </Text>
        </View>
      </View>
      <View style={styles.compactRagRow}>
        {pills.map((pill) => (
          <View key={pill.label} style={styles.compactRagPill}>
            <Text style={styles.compactRagLabel}>{pill.label}</Text>
            <View
              style={[
                styles.compactRagDot,
                {
                  backgroundColor: pill.status
                    ? RAG_COLORS[pill.status]
                    : "#e5e7eb",
                },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function ModularPdfGrid({
  doc,
  data,
  page,
}: {
  doc: ModularPanelsDocument;
  data: StatusReportPDFData;
  page: ModularLayoutPage | undefined;
}) {
  if (!page) return null;
  return (
    <View style={styles.modularGrid}>
      {page.rows.map((row) => {
        const weights = rowShapeWeights(row.shape);
        return (
          <View
            key={row.id}
            style={row.height === "tall" ? styles.modularRowTall : styles.modularRowShort}
          >
            {row.moduleIds.map((moduleId, i) => {
              const placedModule = moduleId ? doc.modules[moduleId] : undefined;
              return (
                <View
                  key={`${row.id}-${i}`}
                  style={[styles.modularCell, { flexGrow: weights[i] ?? 1, flexShrink: 1, flexBasis: 0 }]}
                >
                  {placedModule ? (
                    <View style={styles.modularModuleBox}>
                      <Text style={styles.modularModuleHeader}>{modularPdfTitle(placedModule)}</Text>
                      <View style={styles.modularModuleBody}>
                        <ModularPdfModuleBody module={placedModule} data={data} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.modularEmptySlot} />
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function ModularStatusReportDocument({ data }: { data: StatusReportPDFData }) {
  const { report, project, period, today } = data;
  const { cad, pm, pgm, keyStaff } = getKeyRoleNames(data);
  const bioTitle = project.name.toUpperCase();
  const doc = normalizeModularPanels(data.panels);

  return (
    <Document>
      <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.modularPhysicalPage} wrap={false}>
        <View style={styles.modularScaledCanvas}>
        <View style={styles.modularPageInner}>
          <View style={styles.modularContent}>
            <View style={styles.modularTopRow}>
              <View style={styles.topRowHalf}>
                <View style={styles.biographicalBlock}>
                  <Text style={styles.modularBioTitle}>{bioTitle}</Text>
                  <View style={styles.modularBioTitleLine} />
                  <View style={styles.bioColumns}>
                    <View style={styles.modularBioCol}>
                      <View style={styles.modularBioRow}>
                        <Text style={styles.modularBioLabel}>Account Director:</Text>
                        <Text style={styles.modularBioValue}>{cad || "—"}</Text>
                      </View>
                      <View style={styles.modularBioRow}>
                        <Text style={styles.modularBioLabel}>Project Manager:</Text>
                        <Text style={styles.modularBioValue}>{pm || "—"}</Text>
                      </View>
                      <View style={styles.modularBioRow}>
                        <Text style={styles.modularBioLabel}>Program Manager:</Text>
                        <Text style={styles.modularBioValue}>{pgm || "—"}</Text>
                      </View>
                      <View style={styles.modularBioRow}>
                        <Text style={styles.modularBioLabel}>Team Member:</Text>
                        <Text style={styles.modularBioValue}>{keyStaff || "—"}</Text>
                      </View>
                    </View>
                    <View style={styles.modularBioCol}>
                      <View style={styles.modularBioRow}>
                        <Text style={styles.modularBioLabel}>Today&apos;s Date:</Text>
                        <Text style={styles.modularBioValue}>{today}</Text>
                      </View>
                      <View style={styles.modularBioRow}>
                        <Text style={styles.modularBioLabel}>Client Sponsor:</Text>
                        <Text style={styles.modularBioValue}>{project.clientSponsor || "—"}</Text>
                      </View>
                      <View style={styles.modularBioRow}>
                        <Text style={styles.modularBioLabel}>Client Sponsor:</Text>
                        <Text style={styles.modularBioValue}>{project.clientSponsor2 || "—"}</Text>
                      </View>
                      <View style={styles.modularBioRow}>
                        <Text style={styles.modularBioLabel}>Other Contact:</Text>
                        <Text style={styles.modularBioValue}>{project.otherContact || "—"}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.modularBioPeriodRow}>
                    <Text style={styles.modularBioPeriodLabel}>Period:</Text>
                    <Text style={styles.modularBioPeriodValue}>{period}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.topRowHalf}>
                <RagStatusBlock data={data} layoutScale={MODULAR_CHROME_SCALE} />
              </View>
            </View>
            <ModularPdfGrid doc={doc} data={data} page={doc.layout.pages[0]} />
          </View>
          <StatusReportFooter layoutScale={MODULAR_CHROME_SCALE} />
        </View>
        </View>
      </Page>
      {shouldRenderModularPage2(doc) && (
        <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.modularPhysicalPage} wrap={false}>
          <View style={styles.modularScaledCanvas}>
          <View style={styles.modularPageInner}>
            <View style={styles.modularContent}>
              <CompactModularPdfHeader data={data} />
              <ModularPdfGrid doc={doc} data={data} page={doc.layout.pages[1]} />
            </View>
            <StatusReportFooter layoutScale={MODULAR_CHROME_SCALE} />
          </View>
          </View>
        </Page>
      )}
      {report.meetingNotes && report.meetingNotes.trim() && (
        <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.notesPage}>
          <Text style={styles.notesTitle}>Meeting notes</Text>
          {bulletLines(report.meetingNotes).map((line, i) => (
            <Text key={i} style={{ marginBottom: 6, lineHeight: 1.4 }}>
              {renderTextWithLinks(line)}
            </Text>
          ))}
          <StatusReportFooter />
        </Page>
      )}
    </Document>
  );
}

export function StatusReportDocument({ data }: { data: StatusReportPDFData }) {
  if (data.report.variation === "Modular") {
    return <ModularStatusReportDocument data={data} />;
  }

  const { report, project, period, today } = data;
  const { cad, pm, pgm, keyStaff } = getKeyRoleNames(data);

  const bioTitle = project.name.toUpperCase();
  const standardTimelineSlotHeightPx =
    report.variation !== "CDA" &&
    data.timeline &&
    timelineHasVisibleSchedule(data.timeline)
      ? statusReportTimelineSlotHeightPx({
          scheduleSource: data.scheduleSource,
          planDensity: data.planDensity,
          contentHeightPx:
            timelinePinnedContentHeightPx({
              timeline: data.timeline,
              scheduleSource: data.scheduleSource,
              planDensity: data.planDensity,
              labelOverlay: data.timelineLayout,
              reportDate: data.report.reportDate,
              layoutScale: 1,
            }) ?? undefined,
        })
      : 0;

  return (
    <Document>
      <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.page} wrap={false}>
        <View style={styles.pageInnerWrap}>
        <View style={styles.pageContentWrap}>
        <View style={styles.topRow}>
          <View style={styles.topRowHalf}>
            <View style={styles.biographicalBlock}>
              <Text style={styles.bioTitle}>{bioTitle}</Text>
              <View style={styles.bioTitleLine} />
              <View style={styles.bioColumns}>
                <View style={styles.bioCol}>
                  <View style={styles.bioRow}>
                    <Text style={styles.bioLabel}>Account Director:</Text>
                    <Text style={styles.bioValue}>{cad || "—"}</Text>
                  </View>
                  <View style={styles.bioRow}>
                    <Text style={styles.bioLabel}>Project Manager:</Text>
                    <Text style={styles.bioValue}>{pm || "—"}</Text>
                  </View>
                  <View style={styles.bioRow}>
                    <Text style={styles.bioLabel}>Program Manager:</Text>
                    <Text style={styles.bioValue}>{pgm || "—"}</Text>
                  </View>
                  <View style={styles.bioRow}>
                    <Text style={styles.bioLabel}>Team Member:</Text>
                    <Text style={styles.bioValue}>{keyStaff || "—"}</Text>
                  </View>
                </View>
                <View style={styles.bioCol}>
                  <View style={styles.bioRow}>
                    <Text style={styles.bioLabel}>Today&apos;s Date:</Text>
                    <Text style={styles.bioValue}>{today}</Text>
                  </View>
                  <View style={styles.bioRow}>
                    <Text style={styles.bioLabel}>Client Sponsor:</Text>
                    <Text style={styles.bioValue}>{project.clientSponsor || "—"}</Text>
                  </View>
                  <View style={styles.bioRow}>
                    <Text style={styles.bioLabel}>Client Sponsor:</Text>
                    <Text style={styles.bioValue}>{project.clientSponsor2 || "—"}</Text>
                  </View>
                  <View style={styles.bioRow}>
                    <Text style={styles.bioLabel}>Other Contact:</Text>
                    <Text style={styles.bioValue}>{project.otherContact || "—"}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.bioPeriodRow}>
                <Text style={styles.bioPeriodLabel}>Period:</Text>
                <Text style={styles.bioPeriodValue}>{period}</Text>
              </View>
            </View>
          </View>
          <View style={styles.topRowHalf}>
            <RagStatusBlock data={data} />
          </View>
        </View>

        <View style={styles.mainContentColumn}>
          <View
            style={[
              styles.mainContentPadding,
              {
                paddingBottom: standardTimelineSlotHeightPx,
              },
            ]}
          >
            <View style={styles.middleContent}>
              <View style={styles.threeCol}>
                <View style={styles.col}>
                  <Text style={styles.colTitle}>Completed Activities</Text>
                  {bulletLines(report.completedActivities).slice(0, 7).map((line, i) => (
                    <Text key={i} style={styles.bulletText}>• {renderTextWithLinks(line)}</Text>
                  ))}
                </View>
                <View style={styles.col}>
                  <Text style={styles.colTitle}>Upcoming Activities</Text>
                  {bulletLines(report.upcomingActivities).slice(0, 7).map((line, i) => (
                    <Text key={i} style={styles.bulletText}>• {renderTextWithLinks(line)}</Text>
                  ))}
                </View>
                <View style={styles.col}>
                  <Text style={styles.colTitle}>Risks / Issues / Decisions</Text>
                  {bulletLines(report.risksIssuesDecisions).slice(0, 7).map((line, i) => (
                    <Text key={i} style={styles.bulletText}>• {renderTextWithLinks(line)}</Text>
                  ))}
                </View>
              </View>
              <View style={styles.budgetSectionSpacer} />
            </View>
          </View>
          {report.variation !== "CDA" &&
            data.timeline &&
            timelineHasVisibleSchedule(data.timeline) && (
            <View style={styles.timelineSlotFixed}>
              <TimelineBlock
                timeline={data.timeline}
                reportDate={data.report.reportDate}
                scheduleSource={data.scheduleSource}
                planDensity={data.planDensity}
                labelOverlay={data.timelineLayout}
              />
            </View>
          )}
        </View>
        </View>
        <View style={styles.budgetBlockFixed}>
          <View style={styles.budgetSectionGap} />
          <View style={styles.budgetSectionPin}>
          {report.variation === "CDA" && data.cda && (() => {
            const reportMonthKey = data.report.reportDate.slice(0, 7);
            const currentMonthRow = data.cda.rows.find((r) => r.monthKey === reportMonthKey);
            const hoursOnly = data.cdaReportHoursOnly === true;
            /** Contract budget $ burned (actualDollars / totalDollars). */
            const contractBudgetBurnPercent =
              data.cda.overallBudget && data.cda.overallBudget.totalDollars > 0
                ? Math.min(100, Math.max(0, (data.cda.overallBudget.actualDollars / data.cda.overallBudget.totalDollars) * 100))
                : null;
            const contractHoursCompletePercent = cdaContractHoursCompletePercent(data);
            const overallFirstDonutPercent = hoursOnly ? contractHoursCompletePercent : contractBudgetBurnPercent;
            /** Selected month hours burned vs plan (mtdActuals / planned). */
            const currentMonthPercent =
              currentMonthRow && currentMonthRow.planned > 0
                ? Math.min(100, Math.max(0, (currentMonthRow.mtdActuals / currentMonthRow.planned) * 100))
                : null;
            const monthRemaining = currentMonthRow
              ? currentMonthRow.planned - currentMonthRow.mtdActuals
              : null;
            const currentMonthFull = getMonthFullName(reportMonthKey);
            return (
              <View style={styles.cdaBottomSection}>
                <View style={styles.cdaBottomLeft}>
                  {data.cda.milestones && data.cda.milestones.length > 0 ? (
                    <View style={[styles.table, styles.cdaTableWrap]}>
                      <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                        <View style={[styles.bottomQuarterCell, styles.srBorder, styles.cdaTitleRowCompact, { flex: 1 }]}>
                          <Text style={styles.cdaTitleRowCompact}>Milestones</Text>
                        </View>
                      </View>
                      <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                        <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompactNeutral, { flex: 1.2 }]}>
                          <Text style={styles.srHeaderCompactNeutral}>Phase</Text>
                        </View>
                        <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompactNeutral, { flex: 1.4 }]}>
                          <Text style={[styles.srHeaderCompactNeutral, { fontSize: 6 }]}>DEV</Text>
                        </View>
                        <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompactNeutral, { flex: 1.4 }]}>
                          <Text style={[styles.srHeaderCompactNeutral, { fontSize: 6 }]}>UAT</Text>
                        </View>
                        <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompactNeutral, { flex: 0.8 }]}>
                          <Text style={[styles.srHeaderCompactNeutral, { fontSize: 6 }]}>Deploy</Text>
                        </View>
                      </View>
                      {milestonesForPdfExport(data.cda.milestones).map((m, index) => {
                        const strikeStyle = m.completed ? styles.srStrikethrough : null;
                        const alt = index % 2 === 1;
                        const labelStyle = alt ? styles.srLabelCompactAlt : styles.srLabelCompact;
                        const cellStyle = alt ? styles.srWhiteCompactAlt : styles.srWhiteCompact;
                        const textStyle = [labelStyle, { fontSize: 7 }, ...(strikeStyle ? [strikeStyle] : [])];
                        const cellTextStyle = [cellStyle, { fontSize: 7 }, ...(strikeStyle ? [strikeStyle] : [])];
                        return (
                          <View key={m.id} style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                            <View style={[styles.bottomQuarterCell, styles.srBorder, labelStyle, { flex: 1.2 }]}>
                              <Text style={textStyle}>{m.phase}</Text>
                            </View>
                            <View style={[styles.bottomQuarterCell, styles.srBorder, cellStyle, { flex: 1.4 }]}>
                              <Text style={cellTextStyle}>{formatMonthDay(m.devStartDate)}–{formatMonthDay(m.devEndDate)}</Text>
                            </View>
                            <View style={[styles.bottomQuarterCell, styles.srBorder, cellStyle, { flex: 1.4 }]}>
                              <Text style={cellTextStyle}>{formatMonthDay(m.uatStartDate)}–{formatMonthDay(m.uatEndDate)}</Text>
                            </View>
                            <View style={[styles.bottomQuarterCell, styles.srBorder, cellStyle, { flex: 0.8 }]}>
                              <Text style={cellTextStyle}>{formatMonthDay(m.deployDate)}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={[styles.table, styles.cdaTableWrap]}>
                      <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                        <View style={[styles.bottomQuarterCell, styles.srBorder, styles.cdaTitleRowCompact, { flex: 1 }]}>
                          <Text style={styles.cdaTitleRowCompact}>Milestones</Text>
                        </View>
                      </View>
                      <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                        <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srLabelCompact, { flex: 1 }]}>
                          <Text style={[styles.srLabelCompact, { fontSize: 7 }]}>No milestones.</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.cdaBottomRight}>
                  <View style={styles.cdaTableChartRow}>
                    <View style={styles.cdaTableCol}>
                      <View style={[styles.table, styles.cdaTableWrap]}>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.cdaTitleRowCompact, { flex: 1 }]}>
                            <Text style={styles.cdaTitleRowCompact}>Overall</Text>
                          </View>
                        </View>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1.5 }]}>
                            <Text style={styles.srHeaderCompact}>Total Project</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1 }]}>
                            <Text style={styles.srHeaderCompact}>Planned</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1 }]}>
                            <Text style={styles.srHeaderCompact}>Actuals</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1 }]}>
                            <Text style={styles.srHeaderCompact}>Remaining</Text>
                          </View>
                        </View>
                        {!hoursOnly && (
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srLabelCompact, { flex: 1.5 }]}>
                            <Text style={styles.srLabelCompact}>Budget ($)</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srGreenCompact, { flex: 1 }]}>
                            <Text style={styles.srGreenCompact}>{data.cda.overallBudget ? formatDollars(data.cda.overallBudget.totalDollars) : "—"}</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srWhiteCompact, { flex: 1 }]}>
                            <Text style={styles.srWhiteCompact}>{data.cda.overallBudget ? formatDollars(-data.cda.overallBudget.actualDollars) : "—"}</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srGreenCompact, { flex: 1 }]}>
                            <Text style={styles.srGreenCompact}>{data.cda.overallBudget ? formatDollars(data.cda.overallBudget.totalDollars - data.cda.overallBudget.actualDollars) : "—"}</Text>
                          </View>
                        </View>
                        )}
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srLabelCompact, { flex: 1.5 }]}>
                            <Text style={styles.srLabelCompact}>Hours</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srBlueCompact, { flex: 1 }]}>
                            <Text style={styles.srBlueCompact}>{formatReportNum(cdaOverallHoursPlanned(data))}</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srWhiteCompact, { flex: 1 }]}>
                            <Text style={styles.srWhiteCompact}>{formatReportNum(-data.cda.totalMtdActuals)}</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srBlueCompact, { flex: 1 }]}>
                            <Text style={styles.srBlueCompact}>{formatReportNum(cdaOverallHoursRemaining(data))}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={styles.cdaChartCol}>
                      <BudgetBurnChartPDF
                        burnPercent={overallFirstDonutPercent}
                        compact
                        label={hoursOnly ? "Contract Hours Complete" : "Total Budget"}
                      />
                    </View>
                  </View>
                  <View style={styles.cdaTableChartRow}>
                    <View style={styles.cdaTableCol}>
                      <View style={[styles.table, styles.cdaTableWrap]}>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.cdaTitleRowCompact, { flex: 1 }]}>
                            <Text style={styles.cdaTitleRowCompact}>{currentMonthFull}</Text>
                          </View>
                        </View>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1.5 }]}>
                            <Text style={styles.srHeaderCompact}>Current Month</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1 }]}>
                            <Text style={styles.srHeaderCompact}>Planned</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1 }]}>
                            <Text style={styles.srHeaderCompact}>Actuals</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srHeaderCompact, { flex: 1 }]}>
                            <Text style={styles.srHeaderCompact}>Remaining</Text>
                          </View>
                        </View>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srLabelCompact, { flex: 1.5 }]}>
                            <Text style={styles.srLabelCompact}>Hours</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srBlueCompact, { flex: 1 }]}>
                            <Text style={styles.srBlueCompact}>{currentMonthRow ? formatReportNum(currentMonthRow.planned) : "—"}</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srWhiteCompact, { flex: 1 }]}>
                            <Text style={styles.srWhiteCompact}>{currentMonthRow ? formatReportNum(currentMonthRow.mtdActuals) : "—"}</Text>
                          </View>
                          <View style={[styles.bottomQuarterCell, styles.srBorder, styles.srBlueCompact, { flex: 1 }]}>
                            <Text style={styles.srBlueCompact}>{monthRemaining != null ? formatReportNum(monthRemaining) : "—"}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={styles.cdaChartCol}>
                      <BudgetBurnChartPDF burnPercent={currentMonthPercent} compact label={`${currentMonthFull} Hours`} />
                    </View>
                  </View>
                </View>
              </View>
            );
          })()}

          {report.variation === "Standard" && data.budget && data.showBudget !== false && (
          <View style={styles.bottomQuarterSection}>
            <View style={[styles.bottomQuarterTableCol, styles.table]}>
              {/* Header row — compact for bottom 25% */}
              <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 0.5 }]}>
                  <Text style={styles.srHeaderCompact}>{" "}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                  <Text style={styles.srHeaderCompact}>Est. Budget</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                  <Text style={styles.srHeaderCompact}>$ Spent</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                  <Text style={styles.srHeaderCompact}>$ Remaining</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                  <Text style={styles.srHeaderCompact}>Budgeted Hrs</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                  <Text style={styles.srHeaderCompact}>Actual Hrs</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srHeaderCompact, { flex: 1 }]}>
                  <Text style={styles.srHeaderCompact}>Hrs Remaining</Text>
                </View>
              </View>
              {/* HIGH row */}
              <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.bottomQuarterCell, styles.srLabelCompact, { flex: 0.5 }]}>
                  <Text style={styles.srLabelCompact}>HIGH</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                  <Text style={styles.srGreenCompact}>{formatDollars(data.budget.estBudgetHigh)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                  <Text style={styles.srWhiteCompact}>{formatDollars(-data.budget.spentDollars)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                  <Text style={styles.srGreenCompact}>{formatDollars(data.budget.remainingDollarsHigh)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                  <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.budgetedHoursHigh)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                  <Text style={styles.srWhiteCompact}>{formatReportNum(-data.budget.actualHours)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                  <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.remainingHoursHigh)}</Text>
                </View>
              </View>
              {/* LOW row */}
              <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.bottomQuarterCell, styles.srLabelCompact, { flex: 0.5 }]}>
                  <Text style={styles.srLabelCompact}>LOW</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                  <Text style={styles.srGreenCompact}>{formatDollars(data.budget.estBudgetLow)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                  <Text style={styles.srWhiteCompact}>{formatDollars(-data.budget.spentDollars)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srGreenCompact, { flex: 1 }]}>
                  <Text style={styles.srGreenCompact}>{formatDollars(data.budget.remainingDollarsLow)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                  <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.budgetedHoursLow)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srWhiteCompact, { flex: 1 }]}>
                  <Text style={styles.srWhiteCompact}>{formatReportNum(-data.budget.actualHours)}</Text>
                </View>
                <View style={[styles.bottomQuarterCell, styles.srBlueCompact, { flex: 1 }]}>
                  <Text style={styles.srBlueCompact}>{formatReportNum(data.budget.remainingHoursLow)}</Text>
                </View>
              </View>
            </View>
            <BudgetBurnChartPDF burnPercent={data.budget.burnPercentHigh} compact />
          </View>
        )}

          {report.variation === "Milestones" && (
            <View style={styles.bottomQuarterSection}>
              <View style={[styles.bottomQuarterTableCol, styles.table]}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.bottomQuarterCell, { flex: 1 }]}>Date</Text>
                  <Text style={[styles.tableCell, styles.bottomQuarterCell, { flex: 2 }]}>Description</Text>
                  <Text style={[styles.tableCell, styles.bottomQuarterCell]}>Status</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.bottomQuarterCell, { flex: 4 }]}>— Milestone data (future phase) —</Text>
                </View>
              </View>
              {data.budget && (
                <BudgetBurnChartPDF burnPercent={data.budget.burnPercentHigh} compact />
              )}
            </View>
          )}
          </View>
        </View>
        <StatusReportFooter />
        </View>
      </Page>

      {report.meetingNotes && report.meetingNotes.trim() && (
        <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.notesPage}>
          <Text style={styles.notesTitle}>Meeting notes</Text>
          {bulletLines(report.meetingNotes).map((line, i) => (
            <Text key={i} style={{ marginBottom: 6, lineHeight: 1.4 }}>{renderTextWithLinks(line)}</Text>
          ))}
          <StatusReportFooter />
        </Page>
      )}
    </Document>
  );
}
