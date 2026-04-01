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
  G,
} from "@react-pdf/renderer";
import { BRAND_COLORS } from "@/lib/brandColors";
import { getWeeksInMonthsForRange } from "@/lib/monthUtils";
import { parseLinkSegments } from "@/lib/statusReportLinks";

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
/** Small gap between budget block and footer (in points; ~5px). */
const BUDGET_FOOTER_GAP = 5;
/** Content area height: page minus top padding and footer so budget sits flush above footer. */
const MAIN_CONTENT_HEIGHT = PAGE_HEIGHT - 24 - FOOTER_HEIGHT;
/** Space to reserve at bottom of main column so content doesn't overlap the fixed budget block (content-sized budget + gap). */
const BUDGET_BLOCK_RESERVED = 70;
/** Height reserved for the timeline so it can be pinned above the budget; month row + 4 bar rows + report date. */
const TIMELINE_SLOT_HEIGHT = 85;

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
const TIMELINE_MARKER_LABEL_BG = "#f3f4f6"; // white/90 equivalent for label pill
const TIMELINE_ROW_BORDER = "#d1d5db"; // surface-300 — stronger than surface-200 for visibility
const TIMELINE_MONTH_DIVIDER = "#9ca3af"; // vertical month boundaries (surface-400)

/** Lucide icon path/line data for timeline markers (same icons as Timeline tab). viewBox 0 0 24 24. */
type IconNode = { type: "path"; d: string } | { type: "line"; x1: number; y1: number; x2: number; y2: number };
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
};
const TIMELINE_MARKER_ICON_SIZE = 11;

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
    paddingVertical: 2,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  timelineMonthText: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
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
    minHeight: 16,
    borderBottomWidth: 1,
    borderBottomColor: TIMELINE_ROW_BORDER,
    position: "relative",
    zIndex: 1,
  },
  timelineBar: {
    position: "absolute",
    top: 1,
    bottom: 1,
    backgroundColor: TIMELINE_BAR_BG,
    opacity: 0.82,
    borderRadius: 1,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  timelineBarText: {
    fontSize: 5,
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
    fontSize: 5,
    color: TIMELINE_MARKER_LABEL,
    fontWeight: 500,
  },
  timelineMarkerLabelWrap: {
    flexDirection: "row",
    flexWrap: "nowrap",
    overflow: "hidden",
    backgroundColor: TIMELINE_MARKER_LABEL_BG,
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderRadius: 1,
    marginTop: 0,
    maxWidth: 52,
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
    bars: Array<{ rowIndex: number; label: string; startDate: string; endDate: string; color?: string | null }>;
    markers: Array<{ label: string; date: string; shape?: string; rowIndex?: number }>;
  };
  /** When true, CDA Overall table omits Budget ($) row; first chart uses hours completion. */
  cdaReportHoursOnly?: boolean;
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

const TIMELINE_ICON_STROKE = { stroke: TIMELINE_MARKER, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

/** Renders a timeline marker icon (same Lucide icons as Timeline tab) for PDF. */
function TimelineMarkerIconPdf({ shape }: { shape: string }) {
  const nodes = TIMELINE_MARKER_ICONS[shape] ?? TIMELINE_MARKER_ICONS.Pin;
  return (
    <Svg
      width={TIMELINE_MARKER_ICON_SIZE}
      height={TIMELINE_MARKER_ICON_SIZE}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0 }}
    >
      <G>
        {nodes.map((node, i) =>
          node.type === "path" ? (
            <Path key={i} d={node.d} {...TIMELINE_ICON_STROKE} />
          ) : (
            <Line
              key={i}
              x1={node.x1}
              y1={node.y1}
              x2={node.x2}
              y2={node.y2}
              {...TIMELINE_ICON_STROKE}
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
}: {
  timeline: NonNullable<StatusReportPDFData["timeline"]>;
  reportDate?: string;
}) {
  const startMs = new Date(timeline.startDate).getTime();
  const endMs = new Date(timeline.endDate).getTime();
  const totalMs = endMs - startMs || 1;

  const positionPercent = (dateStr: string) =>
    Math.max(0, Math.min(100, ((new Date(dateStr).getTime() - startMs) / totalMs) * 100));
  const widthPercent = (startStr: string, endStr: string) =>
    Math.max(0, Math.min(100, ((new Date(endStr).getTime() - new Date(startStr).getTime()) / totalMs) * 100));

  const months = getMonthsForTimeline(timeline.startDate, timeline.endDate);
  const barsByRow: typeof timeline.bars[] = [[], [], [], []];
  for (const bar of timeline.bars) {
    if (bar.rowIndex >= 1 && bar.rowIndex <= 4) {
      barsByRow[bar.rowIndex - 1].push(bar);
    }
  }

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

  type TimelineBar = (typeof timeline.bars)[number];
  /** Clip each bar to the visible range so position/width match the axis. */
  function getVisibleBarSegments(rowBars: TimelineBar[]) {
    const clipped: { bar: TimelineBar; visibleStart: string; visibleEnd: string }[] = [];
    for (const bar of rowBars) {
      const visibleStart = bar.startDate > startYmd ? bar.startDate : startYmd;
      const visibleEnd = bar.endDate < endYmd ? bar.endDate : endYmd;
      if (visibleStart < visibleEnd) {
        clipped.push({ bar, visibleStart, visibleEnd });
      }
    }
    return clipped;
  }

  const ROW_HEIGHT = 20;
  const ROW_BAR_TOP = 2;
  const ROW_BAR_BOTTOM = 2;

  return (
    <View style={styles.timelineWrap}>
      {/* Report date label above the header row, aligned to the red line position */}
      {reportDatePercent != null && (
        <View style={styles.timelineReportDateLabelAbove}>
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
      <View style={styles.timelineMonthRow}>
        {months.map((monthKey, i) => (
          <View
            key={monthKey}
            style={[styles.timelineMonthCell, { flex: weeksInMonths[i] ?? 1 }]}
          >
            <Text style={styles.timelineMonthText}>{getMonthFullName(monthKey).toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <View style={styles.timelineBarRowsWrap}>
        {/* Red line only in bar area so it does not go into the header */}
        {reportDatePercent != null && (
          <View
            style={[
              styles.timelineReportDateLine,
              {
                left: `${reportDatePercent}%`,
                marginLeft: -1,
                height: 64,
              },
            ]}
          />
        )}
        <View style={styles.timelineBarRowsContent}>
        {[0, 1, 2, 3].map((rowIdx) => {
        const rowBars = barsByRow[rowIdx] ?? [];
        const clipped = getVisibleBarSegments(rowBars);
        const markersInRow = timeline.markers.filter((m) => (m.rowIndex ?? 1) === rowIdx + 1);
        return (
          <View
            key={rowIdx}
            style={[styles.timelineBarRow, { minHeight: ROW_HEIGHT }]}
          >
            {/* Vertical month lines as first child so they paint behind bars and markers */}
            <View style={styles.timelineRowMonthLinesLayer}>
              {monthBoundaryPositions.map((leftPct, i) => (
                <View
                  key={`v-${i}`}
                  style={[styles.timelineMonthBoundaryLine, { left: `${leftPct}%`, marginLeft: -0.5 }]}
                />
              ))}
            </View>
            {clipped.map(({ bar, visibleStart, visibleEnd }, i) => (
              <View
                key={`bar-${i}`}
                style={[
                  styles.timelineBar,
                  {
                    left: `${positionPercent(visibleStart)}%`,
                    width: `${widthPercent(visibleStart, visibleEnd)}%`,
                    top: ROW_BAR_TOP,
                    bottom: ROW_BAR_BOTTOM,
                    backgroundColor: bar.color ?? TIMELINE_BAR_BG,
                  },
                ]}
              >
                <Text style={styles.timelineBarText}>
                  {bar.label}
                </Text>
              </View>
            ))}
            {markersInRow.map((m, i) => (
              <View
                key={`m-${i}`}
                style={[
                  {
                    position: "absolute",
                    left: `${positionPercent(m.date)}%`,
                    marginLeft: -TIMELINE_MARKER_ICON_SIZE / 2,
                    top: 0,
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: TIMELINE_MARKER_ICON_SIZE,
                  },
                ]}
              >
                <TimelineMarkerIconPdf shape={m.shape ?? "Pin"} />
                <View style={styles.timelineMarkerLabelWrap}>
                  <Text style={styles.timelineMarkerText} wrap={false}>{m.label}</Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
        </View>
      </View>
    </View>
  );
}

/** Format ISO date string as MM/DD for PDF milestones table. */
function formatMonthDay(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${String(m).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
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

function RagStatusBlock({ data }: { data: StatusReportPDFData }) {
  const { report } = data;
  const rows: Array<{ label: string; status: RagStatus | null | undefined; explanation: string | null | undefined }> = [
    { label: "Overall", status: report.ragOverall, explanation: report.ragOverallExplanation },
    { label: "Scope", status: report.ragScope, explanation: report.ragScopeExplanation },
    { label: "Schedule", status: report.ragSchedule, explanation: report.ragScheduleExplanation },
    { label: "Budget", status: report.ragBudget, explanation: report.ragBudgetExplanation },
  ];
  return (
    <View style={styles.ragBlock}>
      <View style={styles.ragHeaderRow}>
        <View style={[styles.ragHeaderCell, styles.ragHeaderLabel]}>
          <Text style={styles.ragHeaderText}>Project Status</Text>
        </View>
        <View style={[styles.ragHeaderCell, styles.ragHeaderRag]} />
        <View style={[styles.ragHeaderCell, styles.ragHeaderExplanation]}>
          <Text style={styles.ragHeaderText}>Explanation</Text>
        </View>
      </View>
      {rows.map((row, i) => (
        <View
          key={row.label}
          style={i % 2 === 1 ? [styles.ragDataRow, styles.ragDataRowAlt] : styles.ragDataRow}
        >
          <View style={styles.ragLabelCell}>
            <Text style={styles.ragLabelText}>{row.label}</Text>
          </View>
          <View style={styles.ragPillCell}>
            {row.status ? (
              <View
                style={[
                  styles.ragPill,
                  { backgroundColor: RAG_COLORS[row.status as RagStatus] },
                ]}
              />
            ) : null}
          </View>
          <View style={styles.ragExplanationCell}>
            <Text style={styles.ragExplanationText}>
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

function StatusReportFooter() {
  const year = new Date().getFullYear();
  return (
    <View style={styles.footerWrap} fixed>
      <View style={styles.footerLeft}>
        <Text style={styles.footerBrand}>JAKALA</Text>
      </View>
      <Text style={styles.footerCenter}>Company Confidential</Text>
      <View style={styles.footerRight}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerYear}>{year}</Text>
      </View>
    </View>
  );
}

export function StatusReportDocument({ data }: { data: StatusReportPDFData }) {
  const { report, project, period, today } = data;
  const { cad, pm, pgm, keyStaff } = getKeyRoleNames(data);

  const bioTitle = project.name.toUpperCase();

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
              ...(!(report.variation !== "CDA" && data.timeline && data.timeline.bars.length > 0)
                ? [{ paddingBottom: 0 }]
                : []),
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
          {report.variation !== "CDA" && data.timeline && data.timeline.bars.length > 0 && (
            <View style={styles.timelineSlotFixed}>
              <TimelineBlock timeline={data.timeline} reportDate={data.report.reportDate} />
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

          {report.variation === "Standard" && data.budget && (
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
