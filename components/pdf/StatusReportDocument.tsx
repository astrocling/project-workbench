import React from "react";
import path from "path";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
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

const BIO_TITLE_COLOR = "#220088";
const BIO_LABEL_COLOR = "#220088";
const BIO_VALUE_COLOR = "#000000";
const BIO_BLOCK_BG = "#F5F5F5";

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    padding: 24,
    fontSize: 9,
    fontFamily: "Raleway",
  },
  biographicalBlock: {
    width: "50%",
    marginBottom: 12,
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
  timelinePlaceholder: {
    marginTop: 8,
    padding: 8,
    borderWidth: 0.5,
    borderColor: "#ccc",
    fontSize: 8,
    color: "#888",
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
});

export type StatusReportPDFData = {
  report: {
    reportDate: string;
    variation: string;
    completedActivities: string;
    upcomingActivities: string;
    risksIssuesDecisions: string;
    meetingNotes: string | null;
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

export function StatusReportDocument({ data }: { data: StatusReportPDFData }) {
  const { report, project, period, today } = data;
  const { cad, pm, pgm, keyStaff } = getKeyRoleNames(data);

  const bioTitle = project.name.toUpperCase();

  return (
    <Document>
      <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.page}>
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

        <Text style={styles.sectionTitle}>Project Status</Text>
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

        {report.variation === "Standard" && data.budget && (
          <View style={styles.table}>
            {/* Header row — match Status report summary / copy-paste table */}
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 0.5 }]}>
                <Text style={styles.srHeader}>{" "}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                <Text style={styles.srHeader}>Est. Budget</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                <Text style={styles.srHeader}>$ Spent</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                <Text style={styles.srHeader}>$ Remaining</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                <Text style={styles.srHeader}>Budgeted Hrs</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                <Text style={styles.srHeader}>Actual Hrs</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srHeader, { flex: 1 }]}>
                <Text style={styles.srHeader}>Hrs Remaining</Text>
              </View>
            </View>
            {/* HIGH row */}
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.srCellBase, styles.srBorder, styles.srLabel, { flex: 0.5 }]}>
                <Text style={styles.srLabel}>HIGH</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srGreen, { flex: 1 }]}>
                <Text style={styles.srGreen}>{formatDollars(data.budget.estBudgetHigh)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srWhite, { flex: 1 }]}>
                <Text style={styles.srWhite}>{formatDollars(-data.budget.spentDollars)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srGreen, { flex: 1 }]}>
                <Text style={styles.srGreen}>{formatDollars(data.budget.remainingDollarsHigh)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srBlue, { flex: 1 }]}>
                <Text style={styles.srBlue}>{formatReportNum(data.budget.budgetedHoursHigh)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srWhite, { flex: 1 }]}>
                <Text style={styles.srWhite}>{formatReportNum(-data.budget.actualHours)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srBlue, { flex: 1 }]}>
                <Text style={styles.srBlue}>{formatReportNum(data.budget.remainingHoursHigh)}</Text>
              </View>
            </View>
            {/* LOW row */}
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.srCellBase, styles.srBorder, styles.srLabel, { flex: 0.5 }]}>
                <Text style={styles.srLabel}>LOW</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srGreen, { flex: 1 }]}>
                <Text style={styles.srGreen}>{formatDollars(data.budget.estBudgetLow)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srWhite, { flex: 1 }]}>
                <Text style={styles.srWhite}>{formatDollars(-data.budget.spentDollars)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srGreen, { flex: 1 }]}>
                <Text style={styles.srGreen}>{formatDollars(data.budget.remainingDollarsLow)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srBlue, { flex: 1 }]}>
                <Text style={styles.srBlue}>{formatReportNum(data.budget.budgetedHoursLow)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srWhite, { flex: 1 }]}>
                <Text style={styles.srWhite}>{formatReportNum(-data.budget.actualHours)}</Text>
              </View>
              <View style={[styles.srCellBase, styles.srBorder, styles.srBlue, { flex: 1 }]}>
                <Text style={styles.srBlue}>{formatReportNum(data.budget.remainingHoursLow)}</Text>
              </View>
            </View>
          </View>
        )}

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

        {report.variation === "Milestones" && (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 1 }]}>Date</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Description</Text>
              <Text style={styles.tableCell}>Status</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 4 }]}>— Milestone data (future phase) —</Text>
            </View>
          </View>
        )}

        <View style={styles.timelinePlaceholder}>
          High-Level Timeline (placeholder for future phase)
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
