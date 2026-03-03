import React from "react";
import path from "path";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  Svg,
  Circle,
  Path,
} from "@react-pdf/renderer";
import { BRAND_COLORS } from "@/lib/brandColors";

Font.register({
  family: "Raleway",
  fonts: [
    {
      src: path.join(process.cwd(), "node_modules/@fontsource/raleway/files/raleway-latin-400-normal.woff"),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), "node_modules/@fontsource/raleway/files/raleway-latin-700-normal.woff"),
      fontWeight: 700,
    },
    {
      src: path.join(process.cwd(), "node_modules/@fontsource/raleway/files/raleway-latin-400-italic.woff"),
      fontWeight: 400,
      fontStyle: "italic",
    },
  ],
});

// 16:9 slide in points (e.g. 8" x 4.5" at 90pt/inch → 720 x 405)
const PAGE_WIDTH = 720;
const PAGE_HEIGHT = 405;
/** Max height for table + chart block on Non-CDA exports (bottom 1/4 of slide). */
const BOTTOM_QUARTER_HEIGHT = PAGE_HEIGHT / 4;

const BIO_TITLE_COLOR = "#220088";
const BIO_LABEL_COLOR = "#220088";
const BIO_VALUE_COLOR = "#000000";
const BIO_BLOCK_BG = "#F5F5F5";

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    paddingTop: 24,
    paddingLeft: 24,
    paddingRight: 24,
    paddingBottom: 8,
    fontSize: 9,
    fontFamily: "Raleway",
    flexDirection: "column",
  },
  /** Row containing bio (left 50%) and RAG block (right 50%). Both sections align to top; bio keeps full multi-row layout. */
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
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
  /** Wraps content below bio so middle can grow and table+chart sit at bottom. */
  mainContentColumn: {
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
  },
  /** Activities + timeline; grows to push table+chart to bottom. */
  middleContent: {
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#060066",
  },
  threeCol: {
    flexDirection: "row",
    marginBottom: 10,
    gap: 12,
    flex: 1,
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
  bulletText: {
    fontSize: 8,
    marginBottom: 2,
    lineHeight: 1.3,
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
  timelinePlaceholder: {
    marginTop: 8,
    padding: 8,
    fontSize: 8,
    color: "#888",
  },
  /** Container for table + chart on Non-CDA: bottom 25% of slide. */
  bottomQuarterSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    height: BOTTOM_QUARTER_HEIGHT,
    maxHeight: BOTTOM_QUARTER_HEIGHT,
    marginTop: 4,
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
    fontSize: 10,
    fontFamily: "Raleway",
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
    minHeight: 18,
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
    minHeight: 16,
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
    fontSize: 9,
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
    fontSize: 9,
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
  };
};

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
              {row.explanation?.trim() || "—"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Budget burn donut chart for PDF (matches Status report summary chart). */
function BudgetBurnChartPDF({
  burnPercent,
  compact = false,
}: {
  burnPercent: number | null;
  compact?: boolean;
}) {
  const size = compact ? 48 : 64;
  const r = compact ? 18 : 24;
  const stroke = compact ? 7 : 10;
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
        {burnPercent != null ? `${burnPercent.toFixed(1)}%` : "—"}
      </Text>
      <Text style={styles.budgetBurnChartLabel}>
        Budget burn ($)
      </Text>
    </View>
  );
}

export function StatusReportDocument({ data }: { data: StatusReportPDFData }) {
  const { report, project, period, today } = data;
  const { cad, pm, pgm, keyStaff } = getKeyRoleNames(data);

  const bioTitle = project.name.toUpperCase();

  return (
    <Document>
      <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.page}>
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
                    <Text style={styles.bioLabel}>Today's Date:</Text>
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
          <View style={styles.middleContent}>
            <View style={styles.threeCol}>
              <View style={styles.col}>
                <Text style={styles.colTitle}>Completed activities</Text>
                {bulletLines(report.completedActivities).slice(0, 6).map((line, i) => (
                  <Text key={i} style={styles.bulletText}>• {line}</Text>
                ))}
              </View>
              <View style={styles.col}>
                <Text style={styles.colTitle}>Upcoming activities</Text>
                {bulletLines(report.upcomingActivities).slice(0, 6).map((line, i) => (
                  <Text key={i} style={styles.bulletText}>• {line}</Text>
                ))}
              </View>
              <View style={styles.col}>
                <Text style={styles.colTitle}>Risks / Issues / Decisions</Text>
                {bulletLines(report.risksIssuesDecisions).slice(0, 6).map((line, i) => (
                  <Text key={i} style={styles.bulletText}>• {line}</Text>
                ))}
              </View>
            </View>

            {report.variation === "CDA" && data.cda && (
              <View style={styles.table}>
                {/* OVERALL title row — match CDA copy-paste section (one cell spanning full width) */}
                <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srTitleRow, { flex: 1 }]}>
                    <Text style={styles.srTitleRow}>OVERALL</Text>
                  </View>
                </View>
                {/* Header row */}
                <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1.5 }]}>
                    <Text style={styles.srHeader}>Total Project</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                    <Text style={styles.srHeader}>Planned</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                    <Text style={styles.srHeader}>Actuals</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                    <Text style={styles.srHeader}>Remaining</Text>
                  </View>
                </View>
                {/* Budget ($) row — green for Planned/Remaining, white for Actuals */}
                <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srLabelMedium, { flex: 1.5 }]}>
                    <Text style={styles.srLabelMedium}>Budget ($)</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srGreen, { flex: 1 }]}>
                    <Text style={styles.srGreen}>{data.cda.overallBudget ? formatDollars(data.cda.overallBudget.totalDollars) : "—"}</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srWhite, { flex: 1 }]}>
                    <Text style={styles.srWhite}>{data.cda.overallBudget ? formatDollars(-data.cda.overallBudget.actualDollars) : "—"}</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srGreen, { flex: 1 }]}>
                    <Text style={styles.srGreen}>{data.cda.overallBudget ? formatDollars(data.cda.overallBudget.totalDollars - data.cda.overallBudget.actualDollars) : "—"}</Text>
                  </View>
                </View>
                {/* Hours row — blue for Planned/Remaining, white for Actuals */}
                <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srLabelMedium, { flex: 1.5 }]}>
                    <Text style={styles.srLabelMedium}>Hours</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srBlue, { flex: 1 }]}>
                    <Text style={styles.srBlue}>{formatReportNum(data.cda.totalPlanned)}</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srWhite, { flex: 1 }]}>
                    <Text style={styles.srWhite}>{formatReportNum(-data.cda.totalMtdActuals)}</Text>
                  </View>
                  <View style={[styles.srCellBase, styles.srBorder, styles.srBlue, { flex: 1 }]}>
                    <Text style={styles.srBlue}>{formatReportNum(data.cda.totalRemaining)}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.timelinePlaceholder}>
              High-Level Timeline (placeholder for future phase)
            </View>
          </View>

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
      </Page>

      {report.meetingNotes && report.meetingNotes.trim() && (
        <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.notesPage}>
          <Text style={styles.notesTitle}>Meeting notes</Text>
          {bulletLines(report.meetingNotes).map((line, i) => (
            <Text key={i} style={{ marginBottom: 6, lineHeight: 1.4 }}>{line}</Text>
          ))}
        </Page>
      )}
    </Document>
  );
}
