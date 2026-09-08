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

/**
 * Timeline-tab reports zoom to recent months. Plan-source reports keep the full
 * project start→end so earlier phases are not clipped out of the create/render gate.
 */
export function resolveReportTimelineAxis(opts: {
  scheduleSource: ScheduleSource;
  projectStartYmd: string;
  projectEndYmd: string;
  reportDate: Date;
  previousMonths: number;
}): TimelineAxisInput {
  if (opts.scheduleSource === "plan") {
    return { startDate: opts.projectStartYmd, endDate: opts.projectEndYmd };
  }
  const months = Math.min(4, Math.max(1, opts.previousMonths));
  const minStartDate = new Date(
    Date.UTC(opts.reportDate.getUTCFullYear(), opts.reportDate.getUTCMonth() - months, 1)
  );
  const minStartStr = minStartDate.toISOString().slice(0, 10);
  const startDate =
    opts.projectStartYmd < minStartStr ? minStartStr : opts.projectStartYmd;
  return { startDate, endDate: opts.projectEndYmd };
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
