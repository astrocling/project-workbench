"use client";

import React from "react";
import { BRAND_COLORS } from "@/lib/brandColors";
import { parseLinkSegments } from "@/lib/statusReportLinks";
import {
  isMeetingNotesHtml,
  sanitizeMeetingNotesHtml,
} from "@/lib/meetingNotesHtml";
import type { StatusReportPDFData, RagStatus } from "@/components/pdf/StatusReportDocument";

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
function formatMonthDay(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${String(m).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
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
  const circumference = 2 * Math.PI * r;
  const filled = (clamped / 100) * circumference;
  const gap = circumference - filled;
  const percentText = burnPercent != null ? `${burnPercent.toFixed(0)}%` : "—";
  const textSize = compact ? "text-[8px]" : "text-[10px]";
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
  type Bar = (typeof timeline.bars)[number];
  const barsByRow: Bar[][] = [[], [], [], []];
  for (const bar of timeline.bars) {
    if (bar.rowIndex >= 1 && bar.rowIndex <= 4) barsByRow[bar.rowIndex - 1].push(bar);
  }
  const startYmd = timeline.startDate.slice(0, 10);
  const endYmd = timeline.endDate.slice(0, 10);
  const reportDateInRange = reportDate && reportDate >= startYmd && reportDate <= endYmd;
  const reportDatePercent = reportDateInRange ? positionPercent(reportDate) : null;
  const monthBoundaryPositions =
    months.length > 1 ? Array.from({ length: months.length - 1 }, (_, i) => ((i + 1) / months.length) * 100) : [];

  return (
    <div className="mt-1 w-full border border-[#d1d5db] relative">
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
      <div className="flex flex-row" style={{ backgroundColor: TIMELINE_MONTH_BG }}>
        {months.map((monthKey) => (
          <div key={monthKey} className="flex-1 py-0.5 px-0.5 text-center">
            <span className="text-[6px] font-bold text-white uppercase">
              {getMonthFullName(monthKey).toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <div className="relative">
        {reportDatePercent != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 -ml-px"
            style={{ left: `${reportDatePercent}%`, backgroundColor: TIMELINE_REPORT_DATE, height: 64 }}
          />
        )}
        {[0, 1, 2, 3].map((rowIdx) => (
          <div
            key={rowIdx}
            className="flex flex-row min-h-4 border-b border-[#d1d5db] relative"
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
            {barsByRow[rowIdx].map((bar, i) => (
              <div
                key={`bar-${i}`}
                className="absolute top-0.5 bottom-0.5 rounded-sm flex items-center px-0.5 opacity-[0.82]"
                style={{
                  left: `${positionPercent(bar.startDate)}%`,
                  width: `${widthPercent(bar.startDate, bar.endDate)}%`,
                  backgroundColor: TIMELINE_BAR_BG,
                }}
              >
                <span className="text-[5px] text-white font-semibold truncate">{bar.label}</span>
              </div>
            ))}
            {timeline.markers
              .filter((m) => (m.rowIndex ?? 1) === rowIdx + 1)
              .map((m, i) => (
                <div
                  key={`m-${i}`}
                  className="absolute flex flex-col items-center min-w-[11px]"
                  style={{ left: `calc(${positionPercent(m.date)}% - 5.5px)` }}
                >
                  <div
                    className="w-[11px] h-[11px] rounded-full border-2 border-[#FF2020] flex-shrink-0"
                    style={{ borderColor: TIMELINE_REPORT_DATE }}
                  />
                  <span className="text-[5px] font-medium text-gray-600 bg-gray-100 px-0.5 rounded max-w-[52px] truncate">
                    {m.label}
                  </span>
                </div>
              ))}
          </div>
        ))}
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

export type StatusReportViewRefs = {
  slideRef?: React.RefObject<HTMLDivElement | null>;
  meetingNotesRef?: React.RefObject<HTMLDivElement | null>;
};

export function StatusReportView({
  data,
  slideRef,
  meetingNotesRef,
}: {
  data: StatusReportPDFData;
} & StatusReportViewRefs) {
  const { report, project, period, today } = data;
  const { cad, pm, pgm, keyStaff } = getKeyRoleNames(data);
  const bioTitle = project.name.toUpperCase();

  const slideScale = 1.25;
  const slideWidth = 720;
  const slideHeight = slideWidth * (9 / 16); // 16:9 aspect
  const scaledHeight = slideHeight * slideScale;

  return (
    <div
      className="status-report-view bg-white text-black font-sans overflow-visible"
      style={{ fontFamily: "Raleway, sans-serif" }}
    >
      {/* Main slide — 16:9 aspect; scaled up for readability, spacing unchanged */}
      <div className="flex justify-center" style={{ width: "100%" }}>
        <div style={{ width: slideWidth * slideScale, maxWidth: "100%", minHeight: scaledHeight }}>
          <div
            ref={slideRef}
            className="status-report-slide relative border border-gray-200 origin-top"
            style={{
              width: 720,
              aspectRatio: "16/9",
              minHeight: 360,
              transform: `scale(${slideScale})`,
              transformOrigin: "top center",
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

          {/* Three columns: completed / upcoming / risks — tight spacing to fit 7 items */}
          <div className="flex flex-row gap-3 mb-0 flex-1 min-h-0">
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              <h3 className="text-[9px] font-bold mb-0.5 shrink-0" style={{ color: "#060066" }}>Completed Activities</h3>
              <div className="flex-1 min-h-0 flex flex-col gap-px">
                {bulletLines(report.completedActivities)
                  .slice(0, 7)
                  .map((line, i) => (
                    <p key={i} className="text-[7px] leading-[1.15]">
                      • <TextWithLinks line={line} />
                    </p>
                  ))}
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              <h3 className="text-[9px] font-bold mb-0.5 shrink-0" style={{ color: "#060066" }}>Upcoming Activities</h3>
              <div className="flex-1 min-h-0 flex flex-col gap-px">
                {bulletLines(report.upcomingActivities)
                  .slice(0, 7)
                  .map((line, i) => (
                    <p key={i} className="text-[7px] leading-[1.15]">
                      • <TextWithLinks line={line} />
                    </p>
                  ))}
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              <h3 className="text-[9px] font-bold mb-0.5 shrink-0" style={{ color: "#060066" }}>Risks / Issues / Decisions</h3>
              <div className="flex-1 min-h-0 flex flex-col gap-px">
                {bulletLines(report.risksIssuesDecisions)
                  .slice(0, 7)
                  .map((line, i) => (
                    <p key={i} className="text-[7px] leading-[1.15]">
                      • <TextWithLinks line={line} />
                    </p>
                  ))}
              </div>
            </div>
          </div>

          {/* Timeline (non-CDA with bars) */}
          {report.variation !== "CDA" && data.timeline && data.timeline.bars.length > 0 && (
            <div className="mt-2 flex-shrink-0">
              <TimelineBlock timeline={data.timeline} reportDate={data.report.reportDate} />
            </div>
          )}

          {/* Budget section — pinned above footer; CDA layout tightened to leave room for 7 activity items */}
          <div className="mt-1 flex-shrink-0">
            {report.variation === "CDA" && data.cda && (() => {
              const reportMonthKey = data.report.reportDate.slice(0, 7);
              const currentMonthRow = data.cda.rows.find((r) => r.monthKey === reportMonthKey);
              const contractBudgetBurnPercent =
                data.cda.overallBudget && data.cda.overallBudget.totalDollars > 0
                  ? Math.min(100, Math.max(0, (data.cda.overallBudget.actualDollars / data.cda.overallBudget.totalDollars) * 100))
                  : null;
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
                        <div className="flex flex-row text-[6px] font-semibold border-t border-gray-200">
                          <div className="flex-[1.5] py-0.5 px-0.5">Hours</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(data.cda.totalPlanned)}</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ color: BRAND_COLORS.onWhite }}>{formatReportNum(-data.cda.totalMtdActuals)}</div>
                          <div className="flex-1 py-0.5 px-0.5 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(data.cda.totalRemaining)}</div>
                        </div>
                      </div>
                      <BudgetBurnDonut burnPercent={contractBudgetBurnPercent} compact label="Total Budget" />
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

            {report.variation === "Standard" && data.budget && (
              <div className="flex flex-row items-start gap-2">
                <div className="flex-1 min-w-0 border border-gray-200">
                  <div className="flex flex-row text-[8px] font-semibold" style={{ backgroundColor: BRAND_COLORS.header, color: BRAND_COLORS.onHeader }}>
                    <div className="flex-[0.5] py-0.5 px-1"></div>
                    <div className="flex-1 py-0.5 px-1">Est. Budget</div>
                    <div className="flex-1 py-0.5 px-1">$ Spent</div>
                    <div className="flex-1 py-0.5 px-1">$ Remaining</div>
                    <div className="flex-1 py-0.5 px-1">Budgeted Hrs</div>
                    <div className="flex-1 py-0.5 px-1">Actual Hrs</div>
                    <div className="flex-1 py-0.5 px-1">Hrs Remaining</div>
                  </div>
                  <div className="flex flex-row text-[8px] border-t border-gray-200">
                    <div className="flex-[0.5] py-0.5 px-1 font-semibold">HIGH</div>
                    <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>{formatDollars(data.budget.estBudgetHigh)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right">{formatDollars(-data.budget.spentDollars)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>{formatDollars(data.budget.remainingDollarsHigh)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(data.budget.budgetedHoursHigh)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right">{formatReportNum(-data.budget.actualHours)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(data.budget.remainingHoursHigh)}</div>
                  </div>
                  <div className="flex flex-row text-[8px] border-t border-gray-200">
                    <div className="flex-[0.5] py-0.5 px-1 font-semibold">LOW</div>
                    <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>{formatDollars(data.budget.estBudgetLow)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right">{formatDollars(-data.budget.spentDollars)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.overallBudget, color: BRAND_COLORS.onHeader }}>{formatDollars(data.budget.remainingDollarsLow)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(data.budget.budgetedHoursLow)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right">{formatReportNum(-data.budget.actualHours)}</div>
                    <div className="flex-1 py-0.5 px-1 text-right" style={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.onAccent }}>{formatReportNum(data.budget.remainingHoursLow)}</div>
                  </div>
                </div>
                <BudgetBurnDonut burnPercent={data.budget.burnPercentHigh} compact />
              </div>
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
          className="w-full max-w-[720px] mx-auto mt-8 pt-9 px-9 pb-11 text-[10px] overflow-visible min-h-0"
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

    </div>
  );
}
