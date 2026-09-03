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
