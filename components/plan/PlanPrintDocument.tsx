"use client";

import type { CSSProperties } from "react";

import {
  ganttBarLabelTextColor,
  ganttMarkFillColor,
  MEETING_VIOLET,
} from "@/lib/plan/ganttBarLabel";
import { isWeekendYmd } from "@/lib/plan/businessDays";
import {
  formatPlanDurationLabel,
  formatPlanPrintDate,
  formatPlanPrintRange,
  phaseItemDateRange,
  planInclusiveDayCount,
  printGanttColWidth,
} from "@/lib/plan/printLayout";
import { positionPercent, widthPercent } from "@/lib/plan/positioning";
import { getPlanAxisRange, getPlanScale, getScaleColumns } from "@/lib/plan/scale";
import type { PlanJson } from "@/lib/plan/serialize";
import { flattenVisibleRows } from "@/lib/plan/tree";
import { isPointType } from "@/lib/plan/types";
import { PLAN_PDF_PAGE_H_PT, PLAN_PDF_PAGE_W_PT } from "@/lib/planPdfCapture";

const PAGE: CSSProperties = {
  width: PLAN_PDF_PAGE_W_PT,
  height: PLAN_PDF_PAGE_H_PT,
  background: "#ffffff",
  color: "#0f172a",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  boxSizing: "border-box",
  padding: "22px 28px 18px",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const TYPE_LEGEND: { type: string; label: string }[] = [
  { type: "waiting_on_client", label: "Waiting on client" },
  { type: "milestone", label: "Milestone" },
  { type: "sign_off", label: "Sign-off" },
  { type: "hard_deadline", label: "Hard deadline" },
];

export function PlanPrintDocument({
  plan,
  projectName,
  assumptions,
  chartOnly = false,
}: {
  plan: PlanJson;
  projectName: string;
  assumptions: string[];
  chartOnly?: boolean;
}) {
  const rows = flattenVisibleRows(plan.phases, new Set());
  const axis = getPlanAxisRange(plan);
  const scale = getPlanScale(axis.startYmd, axis.endYmd);
  const columns = getScaleColumns(axis.startYmd, axis.endYmd, scale);
  const durationDays = planInclusiveDayCount(plan.kickoffDate, plan.endDate);
  const built = new Date().toISOString().slice(0, 10);
  const pageCount = chartOnly ? 1 : 2;

  return (
    <>
      <div data-plan-print-page="chart" style={PAGE}>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "#040966",
            textTransform: "uppercase",
          }}
        >
          Project plan · {projectName}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 700 }}>
          Kickoff to launch, {formatPlanPrintRange(plan.kickoffDate, plan.endDate)}
        </p>
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 12,
            paddingBottom: 10,
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <Metric label="Kickoff" value={formatPlanPrintDate(plan.kickoffDate)} />
          <Metric label="Launch" value={formatPlanPrintDate(plan.endDate)} />
          <Metric label="Duration" value={formatPlanDurationLabel(durationDays)} />
        </div>

        <p
          style={{
            margin: "10px 0 6px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          Timeline
        </p>
        <PrintGantt
          rows={rows}
          axisStart={axis.startYmd}
          axisEnd={axis.endYmd}
          columns={columns}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 14px",
            marginTop: 8,
            fontSize: 9,
            color: "#475569",
          }}
        >
          {plan.phases.map((phase) => (
            <span key={phase.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 1,
                  background: phase.color,
                }}
              />
              {phase.name}
            </span>
          ))}
          {TYPE_LEGEND.map((entry) => (
            <span key={entry.type}>{entry.label}</span>
          ))}
        </div>
        <PrintFooter builtYmd={built} page={1} pages={pageCount} />
      </div>

      {!chartOnly && (
      <div data-plan-print-page="detail" style={{ ...PAGE, overflow: "hidden" }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "#040966",
          }}
        >
          Phase detail
        </p>
        <div style={{ flex: 1, overflow: "hidden", marginTop: 8, fontSize: 10, lineHeight: 1.35 }}>
          {plan.phases.map((phase, index) => {
            const range = phaseItemDateRange(phase.items);
            return (
              <div key={phase.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>
                    {index + 1}. {phase.name}
                  </span>
                  <span style={{ fontWeight: 600, color: "#475569" }}>
                    {range ? formatPlanPrintRange(range.start, range.end) : "—"}
                  </span>
                </div>
                {phase.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      paddingLeft: 12,
                      marginTop: 2,
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ color: "#475569", whiteSpace: "nowrap" }}>
                      {formatPlanPrintRange(item.startDate, item.endDate)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <p
          style={{
            margin: "8px 0 4px",
            fontSize: 14,
            fontWeight: 700,
            color: "#040966",
          }}
        >
          Assumptions & notes
        </p>
        {assumptions.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, lineHeight: 1.4 }}>
            {assumptions.map((line) => (
              <li key={line} style={{ marginBottom: 4 }}>
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>No assumptions recorded.</p>
        )}
        <PrintFooter builtYmd={built} page={2} pages={pageCount} />
      </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          fontWeight: 700,
          color: "#64748b",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function PrintFooter({
  builtYmd,
  page,
  pages,
}: {
  builtYmd: string;
  page: number;
  pages: number;
}) {
  return (
    <p
      style={{
        margin: "auto 0 0",
        paddingTop: 8,
        fontSize: 8,
        color: "#94a3b8",
      }}
    >
      Built {formatPlanPrintDate(builtYmd)} · dates in UTC · page {page} of {pages}
    </p>
  );
}

function PrintGantt({
  rows,
  axisStart,
  axisEnd,
  columns,
}: {
  rows: ReturnType<typeof flattenVisibleRows>;
  axisStart: string;
  axisEnd: string;
  columns: ReturnType<typeof getScaleColumns>;
}) {
  const nameWidth = 168;
  const axisWidth = PLAN_PDF_PAGE_W_PT - 56 - nameWidth;
  const colWidth = printGanttColWidth(axisWidth, columns.length);
  const rowH = Math.max(12, Math.min(18, 310 / Math.max(rows.length, 1)));

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", height: 22 }}>
        <div style={{ width: nameWidth, flexShrink: 0 }} />
        <div style={{ display: "flex", width: axisWidth }}>
          {columns.map((col, i) => (
            <div
              key={col.key}
              style={{
                width: colWidth,
                flexShrink: 0,
                fontSize: 8,
                fontWeight: 700,
                color: "#ffffff",
                background: "#040966",
                textAlign: "center",
                lineHeight: "22px",
                borderRight: i < columns.length - 1 ? "1px solid rgba(255,255,255,0.25)" : undefined,
                overflow: "hidden",
              }}
            >
              {col.label}
            </div>
          ))}
        </div>
      </div>
      <div>
        {rows.map((row) => {
          const isPhase = row.kind === "phase";
          const label = isPhase ? row.phase.name : row.item!.label;
          const color = row.phase.color;
          return (
            <div key={isPhase ? `p-${row.phase.id}` : `i-${row.item!.id}`} style={{ display: "flex", height: rowH }}>
              <div
                style={{
                  width: nameWidth,
                  flexShrink: 0,
                  fontSize: 8,
                  fontWeight: isPhase ? 700 : 500,
                  paddingLeft: isPhase ? 0 : 8 + row.depth * 8,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  lineHeight: `${rowH}px`,
                }}
              >
                {label}
              </div>
              <div style={{ position: "relative", width: axisWidth, height: rowH }}>
                <div style={{ display: "flex", position: "absolute", inset: 0 }}>
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      style={{
                        width: colWidth,
                        flexShrink: 0,
                        borderRight: "1px solid #f1f5f9",
                        background: isWeekendYmd(col.startYmd) && col.startYmd === col.endYmd ? "#f8fafc" : undefined,
                      }}
                    />
                  ))}
                </div>
                {isPhase ? (
                  <PhaseBar phase={row.phase} axisStart={axisStart} axisEnd={axisEnd} />
                ) : (
                  <ItemBar item={row.item!} color={color} axisStart={axisStart} axisEnd={axisEnd} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhaseBar({
  phase,
  axisStart,
  axisEnd,
}: {
  phase: PlanJson["phases"][number];
  axisStart: string;
  axisEnd: string;
}) {
  const range = phaseItemDateRange(phase.items);
  if (!range) return null;
  const left = positionPercent(range.start, axisStart, axisEnd);
  const width = widthPercent(range.start, range.end, axisStart, axisEnd);
  return (
    <div
      style={{
        position: "absolute",
        top: 3,
        bottom: 3,
        left: `${left}%`,
        width: `${width}%`,
        minWidth: 2,
        borderRadius: 2,
        background: phase.color,
        opacity: 0.35,
      }}
    />
  );
}

function ItemBar({
  item,
  color,
  axisStart,
  axisEnd,
}: {
  item: PlanJson["phases"][number]["items"][number];
  color: string;
  axisStart: string;
  axisEnd: string;
}) {
  const fill = ganttMarkFillColor(color, item.type === "meeting");
  const point = isPointType(item.type, item.meetingStatus);
  if (point) {
    const left = positionPercent(item.startDate, axisStart, axisEnd);
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${left}%`,
          width: 8,
          height: 8,
          marginTop: -4,
          marginLeft: -4,
          transform: "rotate(45deg)",
          background: fill,
        }}
      />
    );
  }
  const left = positionPercent(item.startDate, axisStart, axisEnd);
  const width = widthPercent(item.startDate, item.endDate, axisStart, axisEnd);
  const waiting = item.type === "waiting_on_client";
  const unscheduled = item.type === "meeting" && item.meetingStatus === "unscheduled";
  const textColor = waiting || unscheduled ? "#0f172a" : ganttBarLabelTextColor(fill);
  return (
    <div
      style={{
        position: "absolute",
        top: 3,
        bottom: 3,
        left: `${left}%`,
        width: `${width}%`,
        minWidth: 2,
        borderRadius: 2,
        background: waiting || unscheduled ? "transparent" : fill,
        border: waiting || unscheduled ? `1px dashed ${unscheduled ? MEETING_VIOLET : color}` : undefined,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          padding: "0 4px",
          fontSize: 7,
          fontWeight: 600,
          color: textColor,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.label}
      </span>
    </div>
  );
}
