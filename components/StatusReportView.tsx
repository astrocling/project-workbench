"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BRAND_COLORS } from "@/lib/brandColors";
import { parseLinkSegments } from "@/lib/statusReportLinks";
import {
  isMeetingNotesHtml,
  sanitizeMeetingNotesHtml,
} from "@/lib/meetingNotesHtml";
import {
  type StatusReportPDFData,
  type RagStatus,
  cdaOverallHoursPlanned,
  cdaOverallHoursRemaining,
  cdaContractHoursCompletePercent,
} from "@/components/pdf/StatusReportDocument";
import {
  MODULAR_SLIDE_HEIGHT_PX,
  MODULAR_SLIDE_WIDTH_PX,
  PANEL_META,
  normalizeModularPanels,
  rowShapeWeights,
  type DonutKpiData,
  type ModularPanelsDocument,
  type ReportModule,
  type SprintScheduleData,
  type StoryPointsMetricsData,
} from "@/lib/reportPanels";
import { getWeeksInMonthsForRange } from "@/lib/monthUtils";
import { formatMonthDay } from "@/lib/formatIsoDate";
import {
  getActiveTimelineRows,
  getCompactPlanTimelineRows,
  getVisibleBarSegmentsForRow,
  getVisibleMarkersForRow,
  timelineHasVisibleSchedule,
} from "@/lib/plan/reportSchedule";
import {
  getStatusReportTimelineMetrics,
  statusReportMonthHeaderLabel,
  timelineLaneLabel,
  timelineMarkerHangsLeft,
} from "@/lib/statusReportTimelineLayout";
import { PlanPrintDocument } from "@/components/plan/PlanPrintDocument";
import { ganttBarLabelTextColor } from "@/lib/plan/ganttBarLabel";

// Mirror PDF layout: 16:9 slide, same colors and structure
const BIO_TITLE_COLOR = "#220088";
const BIO_LABEL_COLOR = "#220088";
const BIO_VALUE_COLOR = "#000000";
const BIO_BLOCK_BG = "#F5F5F5";
const FOOTER_LINE_COLOR = "#474797";
const FOOTER_BRAND_COLOR = "#474797";
const FOOTER_MUTED_COLOR = "#6b7280";
const TIMELINE_MONTH_BG = "#040966";
const TIMELINE_BAR_BG = "#1941FA";
const TIMELINE_REPORT_DATE = "#FF2020";
const TIMELINE_ROW_BORDER = "#d1d5db";
const TIMELINE_MONTH_DIVIDER = "#9ca3af";

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
const RAG_COLORS: Record<RagStatus, string> = {
  Red: "#dc2626",
  Amber: "#f59e0b",
  Green: "#22c55e",
};

function formatDollars(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
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
function bulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isHtmlContent(text: string): boolean {
  return text.trimStart().startsWith("<");
}

const SPRINT_METRIC_LABELS: Record<string, string> = {
  planned: "Story Points Planned",
  completed: "Story Points Completed",
  inProgress: "Story Points In Progress",
  carryOver: "Carry Over To Next",
};

function NarrativeColumnContent({
  text,
  size = "compact",
}: {
  text: string;
  size?: "compact" | "modular";
}) {
  const textClass =
    size === "modular" ? "text-[12px] leading-[1.25]" : "text-[7px] leading-[1.15]";
  if (isHtmlContent(text)) {
    return (
      <div
        className={`${textClass} [&_ul]:list-disc [&_ul]:pl-3 [&_li]:my-px [&_strong]:font-bold [&_b]:font-bold [&_a]:text-jblue-600 [&_a]:underline [&_p]:mb-px [&_p:last-child]:mb-0`}
        dangerouslySetInnerHTML={{ __html: sanitizeMeetingNotesHtml(text) }}
      />
    );
  }
  return (
    <>
      {bulletLines(text)
        .slice(0, 7)
        .map((line, i) => (
          <p key={i} className={textClass}>
            • <TextWithLinks line={line} />
          </p>
        ))}
    </>
  );
}
function getKeyRoleNames(data: StatusReportPDFData): { cad: string; pm: string; pgm: string; keyStaff: string } {
  const roles = data.project.projectKeyRoles || [];
  const cad = roles.find((r) => r.type === "CAD")?.person?.name ?? "";
  const pm = roles.filter((r) => r.type === "PM").map((r) => r.person?.name).filter(Boolean).join(", ") ?? "";
  const pgm = roles.find((r) => r.type === "PGM")?.person?.name ?? "";
  const keyStaff = data.project.keyStaffName ?? "";
  return { cad, pm, pgm, keyStaff };
}

function TextWithLinks({ line }: { line: string }) {
  const segments = parseLinkSegments(line);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" className="text-jblue-600 underline">
            {seg.content}
          </a>
        ) : (
          seg.content
        )
      )}
    </>
  );
}

function RagStatusBlock({ data }: { data: StatusReportPDFData }) {
  const { report } = data;
  const rows: Array<{ label: string; status: RagStatus | null | undefined; explanation: string | null | undefined }> = [
    { label: "Overall", status: report.ragOverall, explanation: report.ragOverallExplanation },
    { label: "Scope", status: report.ragScope, explanation: report.ragScopeExplanation },
    { label: "Schedule", status: report.ragSchedule, explanation: report.ragScheduleExplanation },
    { label: "Budget", status: report.ragBudget, explanation: report.ragBudgetExplanation },
  ];
  return (
    <div className="w-full flex flex-col">
      <div className="flex flex-row bg-[#220088] min-h-[16px]">
        <div className="w-[72px] py-0.5 px-1 flex-shrink-0">
          <span className="text-[9px] font-bold text-white">Project Status</span>
        </div>
        <div className="w-6 flex-shrink-0" />
        <div className="flex-1 min-w-0 py-0.5 px-1">
          <span className="text-[9px] font-bold text-white">Explanation</span>
        </div>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex flex-row items-center border-b border-gray-200 min-h-[14px] ${i % 2 === 1 ? "bg-white" : "bg-[#F5F5F5]"}`}
        >
          <div className="w-[72px] py-0.5 px-1 flex-shrink-0">
            <span className="text-[7px] font-bold" style={{ color: BIO_LABEL_COLOR }}>
              {row.label}
            </span>
          </div>
          <div className="w-6 flex items-center justify-center flex-shrink-0 py-0.5">
            {row.status ? (
              <span
                className="inline-block w-[18px] h-2 rounded-full"
                style={{ backgroundColor: RAG_COLORS[row.status as RagStatus] }}
              />
            ) : null}
          </div>
          <div className="flex-1 min-w-0 py-0.5 px-1 text-[7px]" style={{ color: BIO_VALUE_COLOR }}>
            {row.explanation?.trim() ? <TextWithLinks line={row.explanation.trim()} /> : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function BudgetBurnDonut({
  burnPercent,
  compact = false,
  xcompact = false,
  label = "Budget burn ($)",
}: {
  burnPercent: number | null;
  compact?: boolean;
  xcompact?: boolean;
  label?: string;
}) {
  const size = xcompact ? 26 : compact ? 36 : 48;
  const r = xcompact ? 9 : compact ? 13 : 18;
  const stroke = xcompact ? 4 : compact ? 5 : 7;
  const clamped = burnPercent == null ? 0 : Math.min(100, Math.max(0, burnPercent));
  const circumference = 2 * Math.PI * r;
  const filled = (clamped / 100) * circumference;
  const gap = circumference - filled;
  const percentText = burnPercent != null ? `${burnPercent.toFixed(0)}%` : "—";
  const textSize = xcompact ? "text-[6px]" : compact ? "text-[8px]" : "text-[10px]";
  return (
    <div className="flex flex-col items-center justify-center flex-shrink-0">
      <div className="relative inline-block" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={stroke}
          />
          {clamped > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#1941FA"
              strokeWidth={stroke}
              strokeDasharray={`${filled} ${gap}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-bold ${textSize} pointer-events-none`}
          style={{ color: "#060066" }}
        >
          {percentText}
        </span>
      </div>
      <span className="text-[6px] uppercase tracking-wide text-gray-500 mt-0.5 text-center">{label}</span>
    </div>
  );
}

function TimelineBlock({
  timeline,
  reportDate,
  scheduleSource,
  className,
}: {
  timeline: NonNullable<StatusReportPDFData["timeline"]>;
  reportDate?: string;
  scheduleSource?: StatusReportPDFData["scheduleSource"];
  className?: string;
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
  const reportDateInRange = reportDate && reportDate >= startYmd && reportDate <= endYmd;
  const reportDatePercent = reportDateInRange ? positionPercent(reportDate) : null;

  const { weeksInMonths, monthBoundaryPositions } = getWeeksInMonthsForRange(
    months,
    startMs,
    endMs
  );

  const metrics = getStatusReportTimelineMetrics(scheduleSource);
  const ROW_HEIGHT_PX = metrics.rowHeightPx;
  const overlay = metrics.mode === "overlay";
  const lanes = metrics.mode === "lanes";
  const fillBar = overlay || lanes;
  const labelCol = metrics.labelColPx;

  const activeRows =
    scheduleSource === "plan"
      ? getCompactPlanTimelineRows(timeline, reportDate)
      : getActiveTimelineRows(timeline);

  return (
    <div className={`w-full border border-[#d1d5db] relative ${className ?? "mt-1"}`}>
      <div className="flex flex-row items-stretch">
        {labelCol > 0 && (
          <div
            className="shrink-0 border-r border-[#d1d5db] flex flex-col"
            style={{ width: labelCol }}
          >
            {reportDatePercent != null && <div className="h-2" />}
            <div
              className="px-1 flex items-center"
              style={{ height: 12, backgroundColor: TIMELINE_MONTH_BG }}
            >
              <span className="font-bold text-white uppercase leading-none" style={{ fontSize: 6 }}>
                Phase
              </span>
            </div>
            {activeRows.map((row) => {
              const clipped = getVisibleBarSegmentsForRow(timeline.bars, row, startYmd, endYmd);
              const markersInRow = getVisibleMarkersForRow(timeline.markers, row, startYmd, endYmd);
              return (
                <div
                  key={`lane-${row}`}
                  className="px-1 border-b border-[#d1d5db] flex items-center"
                  style={{ height: ROW_HEIGHT_PX }}
                >
                  <span
                    className="font-semibold leading-tight block w-full"
                    style={{
                      fontSize: metrics.barFontPx,
                      color: "#060066",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timelineLaneLabel(
                      clipped.map((seg) => seg.bar),
                      markersInRow,
                      row
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="min-w-0 flex-1 relative">
      {reportDatePercent != null && (
        <div className="relative h-2 w-full">
          <span
            className="absolute text-[5px] font-bold whitespace-nowrap"
            style={{ left: `calc(${reportDatePercent}% - 18px)`, color: TIMELINE_REPORT_DATE }}
          >
            Report date
          </span>
        </div>
      )}
      <div
        className="grid gap-0 w-full"
        style={{
          backgroundColor: TIMELINE_MONTH_BG,
          height: 12,
          gridTemplateColumns: weeksInMonths.map((w) => `${w}fr`).join(" "),
        }}
      >
        {months.map((monthKey) => (
          <div key={monthKey} className="px-0.5 flex items-center justify-center min-w-0">
            <span
              className="font-bold text-white uppercase leading-none"
              style={{ fontSize: metrics.monthFontPx }}
            >
              {statusReportMonthHeaderLabel(monthKey, months.length)}
            </span>
          </div>
        ))}
      </div>
      <div className="relative">
        {reportDatePercent != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 -ml-px"
            style={{
              left: `${reportDatePercent}%`,
              backgroundColor: TIMELINE_REPORT_DATE,
              height: activeRows.length * ROW_HEIGHT_PX + 2,
            }}
          />
        )}
        {activeRows.map((row) => {
          const clipped = getVisibleBarSegmentsForRow(timeline.bars, row, startYmd, endYmd);
          const markersInRow = getVisibleMarkersForRow(timeline.markers, row, startYmd, endYmd)
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
          const chartMarkers = lanes ? [] : markersInRow;
          return (
            <div
              key={row}
              className={`border-b border-[#d1d5db] relative${fillBar ? "" : " overflow-hidden"}`}
              style={fillBar && !lanes ? { minHeight: ROW_HEIGHT_PX } : { height: ROW_HEIGHT_PX }}
            >
              <div className="absolute inset-0 pointer-events-none">
                {monthBoundaryPositions.map((leftPct, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px -ml-px"
                    style={{ left: `${leftPct}%`, backgroundColor: TIMELINE_MONTH_DIVIDER }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 z-[1]">
                {clipped.map(({ bar, visibleStart, visibleEnd }, i) => {
                  const rawWidth = widthPercent(visibleStart, visibleEnd);
                  const renderedWidth = Math.max(rawWidth, 4);
                  const fill = bar.color ?? TIMELINE_BAR_BG;
                  return (
                  <div
                    key={`bar-${i}`}
                    className={`absolute rounded flex items-center px-1.5 overflow-hidden min-w-0${fillBar ? " top-[2px] bottom-[2px]" : ""}`}
                    style={{
                      ...(fillBar
                        ? {}
                        : { top: metrics.barTopPx, height: metrics.barHeightPx ?? undefined }),
                      left: `${positionPercent(visibleStart)}%`,
                      width: `${renderedWidth}%`,
                      backgroundColor: fill,
                      opacity: bar.muted ? 0.45 : 1,
                    }}
                  >
                    <span
                      className="font-semibold leading-none block w-full"
                      style={{
                        fontSize: metrics.barFontPx,
                        color: ganttBarLabelTextColor(fill),
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {bar.label}
                    </span>
                  </div>
                  );
                })}
              </div>
              {chartMarkers.map((m, i) => {
                const hangLeft = !fillBar && timelineMarkerHangsLeft(i);
                return (
                  <div
                    key={`m-${i}`}
                    className={`absolute z-[2] flex flex-col${overlay ? " items-center min-w-[11px]" : ""}`}
                    style={
                      overlay
                        ? {
                            left: `calc(${positionPercent(m.date)}% - ${metrics.markerIconPx / 2}px)`,
                            top: metrics.markerTopPx,
                            opacity: m.muted ? 0.45 : 1,
                          }
                        : lanes
                          ? {
                              left: `calc(${positionPercent(m.date)}% - ${metrics.markerIconPx / 2}px)`,
                              top: metrics.markerTopPx,
                              opacity: m.muted ? 0.45 : 1,
                            }
                        : {
                            left: `${positionPercent(m.date)}%`,
                            top: metrics.markerTopPx,
                            width: metrics.markerColPx,
                            marginLeft: hangLeft ? -metrics.markerColPx : 0,
                            alignItems: hangLeft ? "flex-end" : "flex-start",
                            opacity: m.muted ? 0.45 : 1,
                          }
                    }
                  >
                    <svg
                      width={metrics.markerIconPx}
                      height={metrics.markerIconPx}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FF2020"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0"
                    >
                      {(TIMELINE_MARKER_ICONS[m.shape ?? "Pin"] ?? TIMELINE_MARKER_ICONS.Pin).map((node, ni) =>
                        node.type === "path" ? (
                          <path key={ni} d={node.d} />
                        ) : (
                          <line key={ni} x1={node.x1} y1={node.y1} x2={node.x2} y2={node.y2} />
                        )
                      )}
                    </svg>
                    {overlay && (
                    <span
                      className="font-medium text-gray-600 bg-gray-100 px-0.5 rounded truncate"
                      style={{
                        fontSize: metrics.markerFontPx,
                        maxWidth: metrics.markerColPx,
                      }}
                    >
                      {m.label}
                    </span>
                    )}
                    {!fillBar && (
                    <span
                      className="font-medium text-gray-700 bg-white px-0.5 rounded leading-tight text-right"
                      style={{
                        fontSize: metrics.markerFontPx,
                        maxWidth: metrics.markerColPx,
                        textAlign: hangLeft ? "right" : "left",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {m.label}
                    </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
        </div>
      </div>
    </div>
  );
}

const MAX_MILESTONES_ON_PDF = 6;
function milestonesForExport<T extends { completed: boolean }>(milestones: T[]): T[] {
  return [...milestones]
    .sort((a, b) => Number(a.completed) - Number(b.completed))
    .slice(0, MAX_MILESTONES_ON_PDF);
}

function ModularModuleBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full min-h-0 flex flex-col border border-gray-200 overflow-hidden">
      <div
        className="shrink-0 text-center py-0.5 px-1 text-[9px] font-semibold"
        style={{ backgroundColor: BRAND_COLORS.header, color: BRAND_COLORS.onHeader }}
      >
        {title}
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden p-1">{children}</div>
    </div>
  );
}

function ModularEmptyState({ label }: { label: string }) {
  return (
    <p className="text-[11px] text-gray-500 leading-snug">
      {label} — nothing to show yet.
    </p>
  );
}

function ModularSprintSchedule({ data }: { data: SprintScheduleData }) {
  if (data.rows.length === 0) {
    return <ModularEmptyState label={PANEL_META.sprintSchedule.label} />;
  }
  return (
    <div className="h-full w-full border border-gray-200">
      {data.rows.map((row, i) => (
        <div
          key={i}
          className="flex flex-row text-[8px] border-t border-gray-200 first:border-t-0"
          style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f3f4f6" }}
        >
          <div className="w-20 flex-shrink-0 py-0.5 px-1 font-semibold">{row.dateRange}</div>
          <div className="flex-1 py-0.5 px-1">{row.label}</div>
        </div>
      ))}
    </div>
  );
}

function ModularStoryPointMetrics({ data }: { data: StoryPointsMetricsData }) {
  if (data.systems.length === 0) {
    return <ModularEmptyState label={PANEL_META.storyPointMetrics.label} />;
  }
  return (
    <div className="h-full w-full border border-gray-200">
      <div
        className="flex flex-row text-[8px] font-semibold"
        style={{ backgroundColor: BRAND_COLORS.header, color: BRAND_COLORS.onHeader }}
      >
        <div className="flex-[1.5] py-0.5 px-1" />
        {data.systems.map((sys, i) => (
          <div key={i} className="flex-1 py-0.5 px-1 text-center">
            {sys.name}
          </div>
        ))}
      </div>
      {data.rows.map((row, i) => (
        <div
          key={i}
          className="flex flex-row text-[8px] border-t border-gray-200"
          style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f3f4f6" }}
        >
          <div className="flex-[1.5] py-0.5 px-1 font-semibold">
            {SPRINT_METRIC_LABELS[row.metric] ?? row.metric}
          </div>
          {row.values.map((v, j) => (
            <div key={j} className="flex-1 py-0.5 px-1 text-center tabular-nums">
              {v}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StandardBudgetTable({
  budget,
  tableClass = "text-[8px]",
}: {
  budget: NonNullable<StatusReportPDFData["budget"]>;
  tableClass?: string;
}) {
  return (
    <div className="flex flex-row items-start gap-2 h-full min-h-0">
      <div className="flex-1 min-w-0 border border-gray-200">
        <div
          className={`flex flex-row ${tableClass} font-semibold`}
          style={{ backgroundColor: BRAND_COLORS.header, color: BRAND_COLORS.onHeader }}
        >
          <div className="flex-[0.5] py-0.5 px-1"></div>
          <div className="flex-1 py-0.5 px-1">Est. Budget</div>
          <div className="flex-1 py-0.5 px-1">$ Spent</div>
          <div className="flex-1 py-0.5 px-1">$ Remaining</div>
          <div className="flex-1 py-0.5 px-1">Budgeted Hrs</div>
          <div className="flex-1 py-0.5 px-1">Actual Hrs</div>
          <div className="flex-1 py-0.5 px-1">Hrs Remaining</div>
        </div>
        <div className={`flex flex-row ${tableClass} border-t border-gray-200`}>
          <div className="flex-[0.5] py-0.5 px-1 font-semibold">HIGH</div>
          <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>{formatDollars(budget.estBudgetHigh)}</div>
          <div className="flex-1 py-0.5 px-1 text-right">{formatDollars(-budget.spentDollars)}</div>
          <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>{formatDollars(budget.remainingDollarsHigh)}</div>
          <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(budget.budgetedHoursHigh)}</div>
          <div className="flex-1 py-0.5 px-1 text-right">{formatReportNum(-budget.actualHours)}</div>
          <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(budget.remainingHoursHigh)}</div>
        </div>
        <div className={`flex flex-row ${tableClass} border-t border-gray-200`}>
          <div className="flex-[0.5] py-0.5 px-1 font-semibold">LOW</div>
          <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>{formatDollars(budget.estBudgetLow)}</div>
          <div className="flex-1 py-0.5 px-1 text-right">{formatDollars(-budget.spentDollars)}</div>
          <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>{formatDollars(budget.remainingDollarsLow)}</div>
          <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(budget.budgetedHoursLow)}</div>
          <div className="flex-1 py-0.5 px-1 text-right">{formatReportNum(-budget.actualHours)}</div>
          <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(budget.remainingHoursLow)}</div>
        </div>
      </div>
      <BudgetBurnDonut burnPercent={budget.burnPercentHigh} compact />
    </div>
  );
}

function ModularModuleBody({
  module,
  data,
}: {
  module: ReportModule;
  data: StatusReportPDFData;
}) {
  switch (module.type) {
    case "sprintSchedule":
      return <ModularSprintSchedule data={module.data} />;
    case "storyPointMetrics":
      return <ModularStoryPointMetrics data={module.data} />;
    case "donutKpi": {
      const kpi = module.data as DonutKpiData;
      return (
        <div className="h-full w-full flex items-center justify-center">
          <BudgetBurnDonut burnPercent={kpi.manualValue ?? 0} compact label={kpi.label} />
        </div>
      );
    }
    case "narrativeCompleted":
      return <NarrativeColumnContent text={data.report.completedActivities} size="modular" />;
    case "narrativeUpcoming":
      return <NarrativeColumnContent text={data.report.upcomingActivities} size="modular" />;
    case "narrativeRisks":
      return <NarrativeColumnContent text={data.report.risksIssuesDecisions} size="modular" />;
    case "ganttTimeline":
      if (data.timeline && timelineHasVisibleSchedule(data.timeline)) {
        return (
          <TimelineBlock
            timeline={data.timeline}
            reportDate={data.report.reportDate}
            scheduleSource={data.scheduleSource}
            className="h-full mt-0"
          />
        );
      }
      return <ModularEmptyState label={PANEL_META.ganttTimeline.label} />;
    case "budgetFinancials":
      if (data.budget) {
        return <StandardBudgetTable budget={data.budget} tableClass="text-[9px]" />;
      }
      return <ModularEmptyState label={PANEL_META.budgetFinancials.label} />;
    default:
      return <ModularEmptyState label={PANEL_META[module.type].label} />;
  }
}

function modularModuleTitle(module: ReportModule): string {
  switch (module.type) {
    case "narrativeCompleted":
      return "Completed Activities";
    case "narrativeUpcoming":
      return "Upcoming Activities";
    case "narrativeRisks":
      return "Risks / Issues / Decisions";
    case "storyPointMetrics":
      return "Key Metrics";
    case "donutKpi":
      return module.data.label || PANEL_META.donutKpi.label;
    default:
      return PANEL_META[module.type].label;
  }
}

function ModularPage1Grid({
  doc,
  data,
}: {
  doc: ModularPanelsDocument;
  data: StatusReportPDFData;
}) {
  const page = doc.layout.pages[0];
  if (!page) return null;
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {page.rows.map((row) => {
        const weights = rowShapeWeights(row.shape);
        return (
          <div
            key={row.id}
            className="flex flex-row gap-3 min-w-0"
            style={
              row.height === "tall"
                ? { flex: "1 1 0", minHeight: 0 }
                : { flexShrink: 0, height: 168 }
            }
          >
            {row.moduleIds.map((moduleId, i) => {
              const module = moduleId ? doc.modules[moduleId] : undefined;
              return (
                <div
                  key={`${row.id}-${i}`}
                  className="min-w-0 h-full"
                  style={{ flex: `${weights[i] ?? 1} 1 0` }}
                >
                  {module ? (
                    <ModularModuleBox title={modularModuleTitle(module)}>
                      <ModularModuleBody module={module} data={data} />
                    </ModularModuleBox>
                  ) : (
                    <div className="h-full w-full border border-gray-200 bg-white" />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export type StatusReportViewRefs = {
  slideRef?: React.RefObject<HTMLDivElement | null>;
  meetingNotesRef?: React.RefObject<HTMLDivElement | null>;
  planDetailRef?: React.RefObject<HTMLDivElement | null>;
};

export function StatusReportView({
  data,
  slideRef,
  meetingNotesRef,
  planDetailRef,
}: {
  data: StatusReportPDFData;
} & StatusReportViewRefs) {
  const { report, project, period, today } = data;
  const { cad, pm, pgm, keyStaff } = getKeyRoleNames(data);
  const bioTitle = project.name.toUpperCase();
  const isModular = report.variation === "Modular";
  const modularDoc = isModular ? normalizeModularPanels(data.panels) : null;

  const slideWidth = isModular ? MODULAR_SLIDE_WIDTH_PX : 720;
  const slideHeight = isModular ? MODULAR_SLIDE_HEIGHT_PX : slideWidth * (9 / 16); // 16:9 aspect
  const notesWidth = 720;
  const previewScaleMax = 1.5;
  const previewScaleMin = 1.0;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Visual-only scale for the in-app preview (PDF export captures at its own scale).
  const slideScale = useMemo(() => {
    if (!containerWidth) return isModular ? 0.5 : previewScaleMax;
    // Leave a little breathing room so we don't kiss the edges.
    const available = Math.max(0, containerWidth - 24);
    const fit = available / slideWidth;
    if (isModular) return Math.min(previewScaleMax, Math.max(0.25, fit));
    return Math.min(previewScaleMax, Math.max(previewScaleMin, fit));
  }, [containerWidth, isModular, slideWidth]);

  const scaledHeight = slideHeight * slideScale;

  return (
    <div
      className="status-report-view bg-white text-black font-sans overflow-visible"
      style={{ fontFamily: "var(--font-raleway), sans-serif" }}
    >
      {/* Main slide — 16:9 aspect; scaled up for readability, spacing unchanged */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto"
      >
        {/* Important: don't apply maxWidth here; transforms don't affect layout sizing and can cause visual overflow. */}
        <div className="w-fit" style={{ width: slideWidth * slideScale, minHeight: scaledHeight, marginInline: "auto" }}>
          <div
            ref={slideRef}
            className="status-report-slide relative border border-gray-200 origin-top"
            data-slide-width={slideWidth}
            data-slide-height={slideHeight}
            style={{
              width: slideWidth,
              height: slideHeight,
              aspectRatio: "16/9",
              minHeight: isModular ? MODULAR_SLIDE_HEIGHT_PX : 360,
              transform: `scale(${slideScale})`,
              // Important: scaling from center causes the left edge to go negative and get clipped.
              // Scale from top-left so it expands rightward and stays fully visible in the scroll container.
              transformOrigin: "top left",
            }}
          >
        <div className="h-full flex flex-col pt-6 px-6 pb-8 text-[9px]">
          <div className="flex flex-row items-start gap-3 mb-1.5">
            {/* Left: biographical block — extra flex so labels/values have room and wrap less */}
            <div className="min-w-0 flex-[1.35]">
              <div className="w-full min-w-0">
                <h2
                  className="text-[9px] font-bold uppercase mb-0.5"
                  style={{ color: BIO_TITLE_COLOR }}
                >
                  {bioTitle}
                </h2>
                <div className="h-px mb-1" style={{ backgroundColor: BIO_TITLE_COLOR }} />
                <div className="flex flex-row gap-1" style={{ backgroundColor: BIO_BLOCK_BG }}>
                  <div className="flex-1 min-w-0 p-1 flex flex-col gap-0.5">
                    <div className="flex flex-row items-baseline gap-1 min-w-0">
                      <span className="text-[7px] font-bold shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Account Director:</span>
                      <span className="text-[7px] min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{cad || "—"}</span>
                    </div>
                    <div className="flex flex-row items-baseline gap-1 min-w-0">
                      <span className="text-[7px] font-bold shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Project Manager:</span>
                      <span className="text-[7px] min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{pm || "—"}</span>
                    </div>
                    <div className="flex flex-row items-baseline gap-1 min-w-0">
                      <span className="text-[7px] font-bold shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Program Manager:</span>
                      <span className="text-[7px] min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{pgm || "—"}</span>
                    </div>
                    <div className="flex flex-row items-baseline gap-1 min-w-0">
                      <span className="text-[7px] font-bold shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Team Member:</span>
                      <span className="text-[7px] min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{keyStaff || "—"}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 p-1 flex flex-col gap-0.5">
                    <div className="flex flex-row items-baseline gap-1 min-w-0">
                      <span className="text-[7px] font-bold shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Today&apos;s Date:</span>
                      <span className="text-[7px] min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{today}</span>
                    </div>
                    <div className="flex flex-row items-baseline gap-1 min-w-0">
                      <span className="text-[7px] font-bold shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Client Sponsor:</span>
                      <span className="text-[7px] min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{project.clientSponsor || "—"}</span>
                    </div>
                    <div className="flex flex-row items-baseline gap-1 min-w-0">
                      <span className="text-[7px] font-bold shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Client Sponsor:</span>
                      <span className="text-[7px] min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{project.clientSponsor2 || "—"}</span>
                    </div>
                    <div className="flex flex-row items-baseline gap-1 min-w-0">
                      <span className="text-[7px] font-bold shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Other Contact:</span>
                      <span className="text-[7px] min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{project.otherContact || "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-row items-baseline gap-1 mt-0.5 min-w-0">
                  <span className="text-[7px] italic shrink-0 whitespace-nowrap" style={{ color: BIO_LABEL_COLOR }}>Period:</span>
                  <span className="text-[7px] italic min-w-0 break-words" style={{ color: BIO_VALUE_COLOR }}>{period}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <RagStatusBlock data={data} />
            </div>
          </div>

          {isModular && modularDoc ? (
            <ModularPage1Grid doc={modularDoc} data={data} />
          ) : (
            <>
          {/* Three columns: completed / upcoming / risks — tight spacing to fit 7 items */}
          <div className="flex flex-row gap-3 mb-0 flex-1 min-h-0">
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              <h3 className="text-[9px] font-bold mb-0.5 shrink-0" style={{ color: "#060066" }}>Completed Activities</h3>
              <div className="flex-1 min-h-0 flex flex-col gap-px">
                <NarrativeColumnContent text={report.completedActivities} />
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              <h3 className="text-[9px] font-bold mb-0.5 shrink-0" style={{ color: "#060066" }}>Upcoming Activities</h3>
              <div className="flex-1 min-h-0 flex flex-col gap-px">
                <NarrativeColumnContent text={report.upcomingActivities} />
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              <h3 className="text-[9px] font-bold mb-0.5 shrink-0" style={{ color: "#060066" }}>Risks / Issues / Decisions</h3>
              <div className="flex-1 min-h-0 flex flex-col gap-px">
                <NarrativeColumnContent text={report.risksIssuesDecisions} />
              </div>
            </div>
          </div>

          {/* Timeline (non-CDA with visible bars or markers) */}
          {report.variation !== "CDA" &&
            data.timeline &&
            timelineHasVisibleSchedule(data.timeline) && (
            <div className="mt-2 flex-shrink-0">
              <TimelineBlock
                timeline={data.timeline}
                reportDate={data.report.reportDate}
                scheduleSource={data.scheduleSource}
              />
            </div>
          )}
            </>
          )}

          {!isModular && (
          <div className="mt-1 flex-shrink-0">
            {report.variation === "CDA" && data.cda && (() => {
              const reportMonthKey = data.report.reportDate.slice(0, 7);
              const currentMonthRow = data.cda.rows.find((r) => r.monthKey === reportMonthKey);
              const hoursOnly = data.cdaReportHoursOnly === true;
              const contractBudgetBurnPercent =
                data.cda.overallBudget && data.cda.overallBudget.totalDollars > 0
                  ? Math.min(100, Math.max(0, (data.cda.overallBudget.actualDollars / data.cda.overallBudget.totalDollars) * 100))
                  : null;
              const contractHoursCompletePercent = cdaContractHoursCompletePercent(data);
              const overallFirstDonutPercent = hoursOnly ? contractHoursCompletePercent : contractBudgetBurnPercent;
              const currentMonthPercent =
                currentMonthRow && currentMonthRow.planned > 0
                  ? Math.min(100, Math.max(0, (currentMonthRow.mtdActuals / currentMonthRow.planned) * 100))
                  : null;
              const monthRemaining = currentMonthRow ? currentMonthRow.planned - currentMonthRow.mtdActuals : null;
              const currentMonthFull = getMonthFullName(reportMonthKey);
              return (
                <div className="flex flex-row items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {data.cda.milestones && data.cda.milestones.length > 0 ? (
                      <div className="border border-gray-200">
                        <div className="bg-white text-center py-0.5 px-0.5 text-[7px] font-semibold" style={{ color: BRAND_COLORS.onWhite }}>
                          Milestones
                        </div>
                        <div className="flex flex-row text-[6px] font-semibold" style={{ backgroundColor: BRAND_COLORS.header, color: BRAND_COLORS.onHeader }}>
                          <div className="flex-[1.2] py-0.5 px-0.5">Phase</div>
                          <div className="flex-[1.4] py-0.5 px-0.5">DEV</div>
                          <div className="flex-[1.4] py-0.5 px-0.5">UAT</div>
                          <div className="flex-[0.8] py-0.5 px-0.5">Deploy</div>
                        </div>
                        {milestonesForExport(data.cda.milestones).map((m, index) => {
                          const alt = index % 2 === 1;
                          return (
                            <div
                              key={m.id}
                              className={`flex flex-row text-[6px] ${alt ? "bg-gray-100" : "bg-white"}`}
                            >
                              <div className="flex-[1.2] py-0.5 px-0.5 font-semibold border border-gray-200">
                                <span className={m.completed ? "line-through" : ""}>{m.phase}</span>
                              </div>
                              <div className={`flex-[1.4] py-0.5 px-0.5 border border-gray-200 text-right ${m.completed ? "line-through" : ""}`}>
                                {formatMonthDay(m.devStartDate)}–{formatMonthDay(m.devEndDate)}
                              </div>
                              <div className={`flex-[1.4] py-0.5 px-0.5 border border-gray-200 text-right ${m.completed ? "line-through" : ""}`}>
                                {formatMonthDay(m.uatStartDate)}–{formatMonthDay(m.uatEndDate)}
                              </div>
                              <div className={`flex-[0.8] py-0.5 px-0.5 border border-gray-200 text-right ${m.completed ? "line-through" : ""}`}>
                                {formatMonthDay(m.deployDate)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border border-gray-200">
                        <div className="bg-white text-center py-0.5 px-0.5 text-[7px] font-semibold">Milestones</div>
                        <div className="text-[6px] font-semibold py-0.5 px-0.5 border border-gray-200">No milestones.</div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex flex-row items-center gap-1.5">
                      <div className="flex-1 min-w-0 border border-gray-200">
                        <div className="text-center py-0.5 px-0.5 text-[7px] font-semibold">Overall</div>
                        <div className="flex flex-row text-[6px] font-semibold" style={{ backgroundColor: BRAND_COLORS.header, color: BRAND_COLORS.onHeader }}>
                          <div className="flex-[1.5] py-0.5 px-0.5">Total Project</div>
                          <div className="flex-1 py-0.5 px-0.5">Planned</div>
                          <div className="flex-1 py-0.5 px-0.5">Actuals</div>
                          <div className="flex-1 py-0.5 px-0.5">Remaining</div>
                        </div>
                        {!hoursOnly && (
                        <div className="flex flex-row text-[6px] font-semibold border-t border-gray-200">
                          <div className="flex-[1.5] py-0.5 px-0.5">Budget ($)</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>
                            {data.cda.overallBudget ? formatDollars(data.cda.overallBudget.totalDollars) : "—"}
                          </div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ color: BRAND_COLORS.onWhite }}>{data.cda.overallBudget ? formatDollars(-data.cda.overallBudget.actualDollars) : "—"}</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>
                            {data.cda.overallBudget ? formatDollars(data.cda.overallBudget.totalDollars - data.cda.overallBudget.actualDollars) : "—"}
                          </div>
                        </div>
                        )}
                        <div className="flex flex-row text-[6px] font-semibold border-t border-gray-200">
                          <div className="flex-[1.5] py-0.5 px-0.5">Hours</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(cdaOverallHoursPlanned(data))}</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ color: BRAND_COLORS.onWhite }}>{formatReportNum(-data.cda.totalMtdActuals)}</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(cdaOverallHoursRemaining(data))}</div>
                        </div>
                      </div>
                      <BudgetBurnDonut
                        burnPercent={overallFirstDonutPercent}
                        compact
                        label={hoursOnly ? "Contract Hours Complete" : "Total Budget"}
                      />
                    </div>
                    <div className="flex flex-row items-center gap-1.5">
                      <div className="flex-1 min-w-0 border border-gray-200">
                        <div className="text-center py-0.5 px-0.5 text-[7px] font-semibold">{currentMonthFull}</div>
                        <div className="flex flex-row text-[6px] font-semibold" style={{ backgroundColor: BRAND_COLORS.header, color: BRAND_COLORS.onHeader }}>
                          <div className="flex-[1.5] py-0.5 px-0.5">Current Month</div>
                          <div className="flex-1 py-0.5 px-0.5">Planned</div>
                          <div className="flex-1 py-0.5 px-0.5">Actuals</div>
                          <div className="flex-1 py-0.5 px-0.5">Remaining</div>
                        </div>
                        <div className="flex flex-row text-[6px] font-semibold border-t border-gray-200">
                          <div className="flex-[1.5] py-0.5 px-0.5">Hours</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{currentMonthRow ? formatReportNum(currentMonthRow.planned) : "—"}</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ color: BRAND_COLORS.onWhite }}>{currentMonthRow ? formatReportNum(currentMonthRow.mtdActuals) : "—"}</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{monthRemaining != null ? formatReportNum(monthRemaining) : "—"}</div>
                        </div>
                      </div>
                      <BudgetBurnDonut burnPercent={currentMonthPercent} compact label={`${currentMonthFull} Hours`} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {report.variation === "Standard" && data.budget && data.showBudget !== false && (
              <StandardBudgetTable budget={data.budget} />
            )}

            {report.variation === "Milestones" && (
              <div className="flex flex-row items-start gap-2">
                <div className="flex-1 min-w-0 border border-gray-200">
                  <div className="flex flex-row text-[8px] font-semibold" style={{ backgroundColor: "#060066", color: "#fff" }}>
                    <div className="flex-1 py-1 px-1">Date</div>
                    <div className="flex-[2] py-1 px-1">Description</div>
                    <div className="flex-1 py-1 px-1">Status</div>
                  </div>
                  <div className="py-1 px-1 text-[8px]">— Milestone data (future phase) —</div>
                </div>
                {data.budget && <BudgetBurnDonut burnPercent={data.budget.burnPercentHigh} compact />}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="absolute left-6 right-6 bottom-1.5 h-[14px] border-t flex flex-row items-center pt-0.5"
          style={{ borderColor: FOOTER_LINE_COLOR }}
        >
          <div className="flex-1">
            <span className="text-[10px] font-bold" style={{ color: FOOTER_BRAND_COLOR }}>JAKALA</span>
          </div>
          <div className="flex-1 text-center text-[9px]" style={{ color: FOOTER_MUTED_COLOR }}>Company Confidential</div>
          <div className="flex-1 flex flex-row items-center justify-end gap-2">
            <div className="w-px h-3 bg-gray-300" />
            <span className="text-[9px]" style={{ color: FOOTER_MUTED_COLOR }}>{new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
        </div>
      </div>

      {/* Meeting notes — no overflow/max-height so full content is visible and PDF capture gets everything */}
      {report.meetingNotes && report.meetingNotes.trim() && (
        <div
          ref={meetingNotesRef}
          className="mx-auto mt-8 pt-9 px-9 pb-11 text-[10px] overflow-visible min-h-0"
          style={{ width: notesWidth, maxWidth: notesWidth }}
        >
          <h2 className="text-sm font-bold uppercase mb-0.5" style={{ color: BIO_TITLE_COLOR }}>Meeting Notes</h2>
          <div className="h-px mb-3" style={{ backgroundColor: BIO_TITLE_COLOR }} />
          {isMeetingNotesHtml(report.meetingNotes) ? (
            <div
              className="meeting-notes-html overflow-visible [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_b]:font-bold [&_a]:text-jblue-600 [&_a]:underline [&_p]:mb-2 [&_p:last-child]:mb-0"
              style={{ fontFamily: "inherit" }}
              dangerouslySetInnerHTML={{
                __html: sanitizeMeetingNotesHtml(report.meetingNotes),
              }}
            />
          ) : (
            <>
              {bulletLines(report.meetingNotes).map((line, i) => (
                <p key={i} className="mb-1.5 leading-snug">
                  <TextWithLinks line={line} />
                </p>
              ))}
            </>
          )}
          <div className="mt-4 pt-2 border-t flex flex-row items-center" style={{ borderColor: FOOTER_LINE_COLOR }}>
            <span className="text-[10px] font-bold" style={{ color: FOOTER_BRAND_COLOR }}>JAKALA</span>
            <span className="flex-1 text-center text-[9px]" style={{ color: FOOTER_MUTED_COLOR }}>Company Confidential</span>
            <span className="text-[9px]" style={{ color: FOOTER_MUTED_COLOR }}>{new Date().getFullYear()}</span>
          </div>
        </div>
      )}

      {data.includeDetailedPlan && data.detailedPlan && (
        <div ref={planDetailRef} className="mx-auto mt-8 overflow-visible">
          <PlanPrintDocument
            plan={data.detailedPlan}
            projectName={project.name}
            assumptions={data.detailedPlan.assumptions}
            chartOnly
          />
        </div>
      )}

    </div>
  );
}
