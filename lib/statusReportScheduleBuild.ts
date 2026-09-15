import type { PlanPhaseJson } from "@/lib/plan/serialize";
import {
  compactPlanToSchedule,
  timelineHasVisibleSchedule,
  type PlanReportDensity,
  type ReportScheduleSlice,
} from "@/lib/plan/reportSchedule";
import type { ScheduleSource, StatusReportSnapshot } from "@/lib/statusReportPdfData";

export type TimelineAxisInput = {
  startDate: string;
  endDate: string;
};

export type LegacyTimelineBar = {
  rowIndex: number;
  label: string;
  startDate: string;
  endDate: string;
  color: string | null;
};

export type LegacyTimelineMarker = {
  label: string;
  date: string;
  shape: string;
  rowIndex: number;
};

export function shouldUseLockedTimeline(
  snapshot: StatusReportSnapshot | null,
  rebuildTimelineFromProject?: boolean
): boolean {
  return snapshot?.timeline !== undefined && !rebuildTimelineFromProject;
}

export function shouldBuildTimelineFromPlan(
  scheduleSource: ScheduleSource,
  timelineLocked: boolean
): boolean {
  return !timelineLocked && scheduleSource === "plan";
}

export function shouldBuildTimelineFromLegacy(
  scheduleSource: ScheduleSource,
  timelineLocked: boolean
): boolean {
  return !timelineLocked && scheduleSource === "timeline";
}

export function shouldClipLockedTimelineToPreviousMonths(
  scheduleSource: ScheduleSource
): boolean {
  return scheduleSource === "timeline";
}

export function earliestScheduleWorkYmd(timeline: {
  bars: Array<{ startDate: string }>;
  markers: Array<{ date: string }>;
}): string | undefined {
  const dates = [
    ...timeline.bars.map((bar) => bar.startDate.slice(0, 10)),
    ...timeline.markers.map((marker) => marker.date.slice(0, 10)),
  ]
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();
  return dates[0];
}

export const PLAN_REPORT_LOOKAHEAD_DEFAULT = 2;

function clampMonthCount(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(4, Math.max(1, Math.trunc(value)));
}

function ymd(year: number, monthIndex: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonthYmd(year: number, monthIndex: number): string {
  return ymd(year, monthIndex, 1);
}

function lastDayOfMonthYmd(year: number, monthIndex: number): string {
  return ymd(year, monthIndex + 1, 0);
}

function maxYmd(a: string, b: string): string {
  return a > b ? a : b;
}

function minYmd(a: string, b: string): string {
  return a < b ? a : b;
}

/**
 * Timeline-tab reports zoom to recent months through project end.
 * Plan-source reports window around the report date, never before Plan kickoff,
 * and never past Plan end (or project end).
 */
export function resolveReportTimelineAxis(opts: {
  scheduleSource: ScheduleSource;
  projectStartYmd: string;
  projectEndYmd: string;
  reportDate: Date;
  previousMonths: number;
  lookaheadMonths?: number;
  planKickoffYmd?: string;
  planEndYmd?: string;
  /** First bar/key-date on the compact schedule; empty kickoff months are not shown. */
  planWorkStartYmd?: string;
  windowStartYmd?: string;
  windowEndYmd?: string;
}): TimelineAxisInput {
  const lookback = clampMonthCount(opts.previousMonths, 1);
  if (opts.scheduleSource !== "plan") {
    const minStartDate = new Date(
      Date.UTC(opts.reportDate.getUTCFullYear(), opts.reportDate.getUTCMonth() - lookback, 1)
    );
    const minStartStr = minStartDate.toISOString().slice(0, 10);
    const startDate =
      opts.projectStartYmd < minStartStr ? minStartStr : opts.projectStartYmd;
    return { startDate, endDate: opts.projectEndYmd };
  }

  const lookahead = clampMonthCount(opts.lookaheadMonths, PLAN_REPORT_LOOKAHEAD_DEFAULT);
  const kickoff = opts.planKickoffYmd ?? opts.projectStartYmd;
  const work = opts.planWorkStartYmd?.slice(0, 10);
  const workFloor = work
    ? firstDayOfMonthYmd(Number(work.slice(0, 4)), Number(work.slice(5, 7)) - 1)
    : kickoff;
  const floor = maxYmd(maxYmd(kickoff, opts.projectStartYmd), workFloor);
  const ceil = minYmd(opts.planEndYmd ?? opts.projectEndYmd, opts.projectEndYmd);
  const year = opts.reportDate.getUTCFullYear();
  const month = opts.reportDate.getUTCMonth();
  const autoStart = firstDayOfMonthYmd(year, month - lookback);
  const autoEnd = lastDayOfMonthYmd(year, month + lookahead);
  const authorStart = opts.windowStartYmd?.slice(0, 10);
  const authorEnd = opts.windowEndYmd?.slice(0, 10);
  const windowStart = authorStart ? maxYmd(autoStart, authorStart) : autoStart;
  const windowEnd = authorEnd ? minYmd(autoEnd, authorEnd) : autoEnd;
  let startDate = maxYmd(floor, windowStart);
  let endDate = minYmd(ceil, windowEnd);
  if (startDate > endDate) {
    startDate = maxYmd(floor, autoStart);
    endDate = minYmd(ceil, autoEnd);
    if (startDate > endDate) {
      startDate = floor;
      endDate = ceil >= floor ? ceil : floor;
    }
  }
  return { startDate, endDate };
}

export function buildPlanTimelineCandidate(
  phases: PlanPhaseJson[],
  density: PlanReportDensity,
  axis: TimelineAxisInput
): NonNullable<StatusReportSnapshot["timeline"]> | undefined {
  const schedule = compactPlanToSchedule(phases, density);
  if (!schedule) {
    return undefined;
  }
  return assemblePlanTimeline(schedule, axis);
}

export function assemblePlanTimeline(
  schedule: ReportScheduleSlice,
  axis: TimelineAxisInput
): NonNullable<StatusReportSnapshot["timeline"]> | undefined {
  const candidate = {
    startDate: axis.startDate,
    endDate: axis.endDate,
    bars: schedule.bars,
    markers: schedule.markers,
  };
  return timelineHasVisibleSchedule(candidate) ? candidate : undefined;
}

export function buildLegacyTimeline(
  bars: LegacyTimelineBar[],
  markers: LegacyTimelineMarker[],
  axis: TimelineAxisInput
): NonNullable<StatusReportSnapshot["timeline"]> {
  return {
    startDate: axis.startDate,
    endDate: axis.endDate,
    bars,
    markers,
  };
}

/**
 * Gate for Plan-sourced schedules: a timeline must draw at least one bar segment or in-axis
 * marker on rows 1–4. Marker-only Plan key-date schedules pass.
 */
export function isValidPlanTimeline(
  timeline: StatusReportSnapshot["timeline"] | undefined
): timeline is NonNullable<StatusReportSnapshot["timeline"]> {
  return timeline != null && timelineHasVisibleSchedule(timeline);
}
