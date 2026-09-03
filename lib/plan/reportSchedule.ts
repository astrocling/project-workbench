import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";

export type PlanReportDensity = "phases" | "phases_and_key_dates";

export type ReportScheduleSlice = {
  bars: Array<{
    rowIndex: number;
    label: string;
    startDate: string;
    endDate: string;
    color: string | null;
  }>;
  markers: Array<{
    label: string;
    date: string;
    shape: string;
    rowIndex: number;
  }>;
};

function phaseRowIndex(order: number): number {
  return (order % 4) + 1;
}

function isKeyDateMarker(item: PlanItemJson): boolean {
  if (item.type === "milestone" || item.type === "sign_off" || item.type === "hard_deadline") {
    return true;
  }
  return item.type === "meeting" && item.meetingStatus === "scheduled";
}

function markerShape(item: PlanItemJson): string {
  switch (item.type) {
    case "milestone":
      return "Pin";
    case "sign_off":
      return "ThumbsUp";
    case "hard_deadline":
      return "BadgeAlert";
    case "meeting":
      return "Rocket";
    default:
      return "Pin";
  }
}

function minDate(dates: string[]): string {
  return dates.reduce((min, d) => (d < min ? d : min));
}

function maxDate(dates: string[]): string {
  return dates.reduce((max, d) => (d > max ? d : max));
}

export function compactPlanToSchedule(
  phases: PlanPhaseJson[],
  density: PlanReportDensity
): ReportScheduleSlice | null {
  const datedPhases = phases.filter((phase) => phase.items.length > 0);
  if (datedPhases.length === 0) {
    return null;
  }

  const bars = datedPhases
    .map((phase) => {
      const startDates = phase.items.map((item) => item.startDate);
      const endDates = phase.items.map((item) => item.endDate);
      const startDate = minDate(startDates);
      const endDate = maxDate(endDates);
      // Point-only phases render as markers only (no zero-length / one-day bars).
      if (startDate >= endDate) {
        return null;
      }
      return {
        rowIndex: phaseRowIndex(phase.order),
        label: phase.name,
        startDate,
        endDate,
        color: null,
      };
    })
    .filter((bar): bar is NonNullable<typeof bar> => bar != null);

  if (density === "phases") {
    return bars.length > 0 ? { bars, markers: [] } : null;
  }

  const markers = datedPhases.flatMap((phase) => {
    const rowIndex = phaseRowIndex(phase.order);
    return phase.items
      .filter(isKeyDateMarker)
      .map((item) => ({
        label: item.label,
        date: item.startDate,
        shape: markerShape(item),
        rowIndex,
      }));
  });

  return bars.length === 0 && markers.length === 0 ? null : { bars, markers };
}

type ScheduleBar = {
  startDate: string;
  endDate: string;
};
type ScheduleMarker = {
  date: string;
};

export type TimelineAxisSlice = {
  startDate: string;
  endDate: string;
  bars: ScheduleBar[];
  markers: ScheduleMarker[];
};

/** Clip a bar to the axis; returns null when nothing is visible (zero-length or fully outside). */
export function getVisibleBarSegment(
  bar: Pick<ScheduleBar, "startDate" | "endDate">,
  axisStart: string,
  axisEnd: string
): { visibleStart: string; visibleEnd: string } | null {
  const startYmd = axisStart.slice(0, 10);
  const endYmd = axisEnd.slice(0, 10);
  const visibleStart = bar.startDate > startYmd ? bar.startDate : startYmd;
  const visibleEnd = bar.endDate < endYmd ? bar.endDate : endYmd;
  if (visibleStart < visibleEnd) {
    return { visibleStart, visibleEnd };
  }
  return null;
}

export function isMarkerInAxis(
  marker: Pick<ScheduleMarker, "date">,
  axisStart: string,
  axisEnd: string
): boolean {
  const startYmd = axisStart.slice(0, 10);
  const endYmd = axisEnd.slice(0, 10);
  const date = marker.date.slice(0, 10);
  return date >= startYmd && date <= endYmd;
}

/** True when at least one bar segment or marker is visible on the timeline axis. */
export function timelineHasVisibleSchedule(timeline: TimelineAxisSlice): boolean {
  const startYmd = timeline.startDate.slice(0, 10);
  const endYmd = timeline.endDate.slice(0, 10);
  for (const bar of timeline.bars) {
    if (getVisibleBarSegment(bar, startYmd, endYmd)) {
      return true;
    }
  }
  for (const marker of timeline.markers) {
    if (isMarkerInAxis(marker, startYmd, endYmd)) {
      return true;
    }
  }
  return false;
}
