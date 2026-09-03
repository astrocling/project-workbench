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

  const bars = datedPhases.map((phase) => {
    const startDates = phase.items.map((item) => item.startDate);
    const endDates = phase.items.map((item) => item.endDate);
    return {
      rowIndex: phaseRowIndex(phase.order),
      label: phase.name,
      startDate: minDate(startDates),
      endDate: maxDate(endDates),
      color: null,
    };
  });

  if (density === "phases") {
    return { bars, markers: [] };
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

  return { bars, markers };
}
