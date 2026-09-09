import {
  addCalendarDays,
  calendarDayDelta,
  clampYmdRange,
  parseYmd,
  shiftYmdRange,
} from "@/lib/plan/businessDays";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function planRangeMs(planStartYmd: string, planEndYmd: string): number {
  const startMs = parseYmd(planStartYmd).getTime();
  const endMs = parseYmd(planEndYmd).getTime();
  return Math.max(MS_PER_DAY, endMs - startMs);
}

/** Left-edge position (0–100) for a date on the plan axis. */
export function positionPercent(
  dateYmd: string,
  planStartYmd: string,
  planEndYmd: string
): number {
  const startMs = parseYmd(planStartYmd).getTime();
  const totalMs = planRangeMs(planStartYmd, planEndYmd);
  const t = parseYmd(dateYmd).getTime();
  return Math.max(0, Math.min(100, ((t - startMs) / totalMs) * 100));
}

/** Axis percent for a today marker, clamped to the plan when the date is outside. */
export function todayMarkerPercent(
  todayYmd: string,
  planStartYmd: string,
  planEndYmd: string
): number {
  if (todayYmd < planStartYmd) return 0;
  if (todayYmd > planEndYmd) return 100;
  return positionPercent(todayYmd, planStartYmd, planEndYmd);
}

/** Bar width (0–100) for an inclusive start/end range on the plan axis. */
export function widthPercent(
  startYmd: string,
  endYmd: string,
  planStartYmd: string,
  planEndYmd: string
): number {
  const startMs = parseYmd(startYmd).getTime();
  const endMs = parseYmd(endYmd).getTime() + MS_PER_DAY;
  const totalMs = planRangeMs(planStartYmd, planEndYmd);
  return Math.max(0, Math.min(100, ((endMs - startMs) / totalMs) * 100));
}

/** Inverse of `positionPercent`: UTC day at a 0–100 axis percent (clamped). */
export function ymdAtPercent(
  percent: number,
  planStartYmd: string,
  planEndYmd: string
): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const startMs = parseYmd(planStartYmd).getTime();
  const totalMs = planRangeMs(planStartYmd, planEndYmd);
  const days = Math.round((clamped / 100) * (totalMs / MS_PER_DAY));
  const ymd = addCalendarDays(planStartYmd, days);
  return ymd > planEndYmd ? planEndYmd : ymd;
}

/** UTC day under a pointer on an axis whose left edge is `axisLeft` and width is `axisWidth`. */
export function ymdAtClientX(
  clientX: number,
  axisLeft: number,
  axisWidth: number,
  planStartYmd: string,
  planEndYmd: string
): string {
  const width = Math.max(1, axisWidth);
  const percent = ((clientX - axisLeft) / width) * 100;
  return ymdAtPercent(percent, planStartYmd, planEndYmd);
}

export type GanttDragKind = "move" | "resize-start" | "resize-end";

export function applyGanttDrag(args: {
  kind: GanttDragKind;
  originStart: string;
  originEnd: string;
  originYmd: string;
  currentYmd: string;
  point: boolean;
}): { startDate: string; endDate: string } {
  if (args.point || args.kind === "move") {
    const delta = calendarDayDelta(args.originYmd, args.currentYmd);
    if (args.point) {
      const ymd = shiftYmdRange(args.originStart, args.originStart, delta).startDate;
      return { startDate: ymd, endDate: ymd };
    }
    return shiftYmdRange(args.originStart, args.originEnd, delta);
  }
  if (args.kind === "resize-start") {
    return clampYmdRange(args.currentYmd, args.originEnd, "start");
  }
  return clampYmdRange(args.originStart, args.currentYmd, "end");
}
