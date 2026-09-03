import { parseYmd } from "@/lib/plan/businessDays";

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
