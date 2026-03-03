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
    spentDollars: number;
    remainingDollarsHigh: number;
    budgetedHoursHigh: number;
    actualHours: number;
    remainingHoursHigh: number;
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
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 0.5 }]}></Text>
              <Text style={styles.tableCell}>Est. Budget</Text>
              <Text style={styles.tableCell}>$ Spent</Text>
              <Text style={styles.tableCell}>$ Remaining</Text>
              <Text style={styles.tableCell}>Budgeted Hrs</Text>
              <Text style={styles.tableCell}>Actual Hrs</Text>
              <Text style={styles.tableCell}>Hrs Remaining</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 0.5, fontWeight: "bold" }]}>HIGH</Text>
              <Text style={styles.tableCell}>{formatDollars(data.budget.estBudgetHigh)}</Text>
              <Text style={styles.tableCell}>{formatDollars(-data.budget.spentDollars)}</Text>
              <Text style={styles.tableCell}>{formatDollars(data.budget.remainingDollarsHigh)}</Text>
              <Text style={styles.tableCell}>{formatNum(data.budget.budgetedHoursHigh)}</Text>
              <Text style={styles.tableCell}>{formatNum(-data.budget.actualHours)}</Text>
              <Text style={styles.tableCell}>{formatNum(data.budget.remainingHoursHigh)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 0.5 }]}></Text>
              <Text style={styles.tableCell}></Text>
              <Text style={styles.tableCell}></Text>
              <Text style={styles.tableCell}></Text>
              <Text style={[styles.tableCell, { textAlign: "center" }]}>
                {data.budget.burnPercentHigh != null ? `${data.budget.burnPercentHigh.toFixed(1)}% budget used` : "—"}
              </Text>
              <Text style={styles.tableCell}></Text>
            </View>
          </View>
        )}

        {report.variation === "CDA" && data.cda && (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>OVERALL</Text>
              <Text style={styles.tableCell}>Planned</Text>
              <Text style={styles.tableCell}>Actuals</Text>
              <Text style={styles.tableCell}>Remaining</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Budget ($)</Text>
              <Text style={styles.tableCell}>{data.cda.overallBudget ? formatDollars(data.cda.overallBudget.totalDollars) : "—"}</Text>
              <Text style={styles.tableCell}>{data.cda.overallBudget ? formatDollars(-data.cda.overallBudget.actualDollars) : "—"}</Text>
              <Text style={styles.tableCell}>{data.cda.overallBudget ? formatDollars(data.cda.overallBudget.totalDollars - data.cda.overallBudget.actualDollars) : "—"}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Hours</Text>
              <Text style={styles.tableCell}>{formatNum(data.cda.totalPlanned)}</Text>
              <Text style={styles.tableCell}>{formatNum(-data.cda.totalMtdActuals)}</Text>
              <Text style={styles.tableCell}>{formatNum(data.cda.totalRemaining)}</Text>
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
