import { getMonthsInRange } from "@/lib/monthUtils";
import { formatWeekKey, formatWeekShort, getWeekStartDate } from "@/lib/weekUtils";
import {
  addCalendarDays,
  expandYmdRange,
  formatYmd,
  parseYmd,
} from "@/lib/plan/businessDays";

export type PlanScale = "day" | "week" | "month";

export type ScaleColumn = {
  key: string;
  label: string;
  startYmd: string;
  endYmd: string;
};

const EIGHT_WEEKS_DAYS = 56;
const SIX_MONTHS_DAYS = 183;

/**
 * Adaptive chart granularity per spec:
 * - under 8 weeks → day columns
 * - 8 weeks to ~6 months → week columns
 * - 6+ months → month columns
 */
export function getPlanScale(startYmd: string, endYmd: string): PlanScale {
  const dayCount = expandYmdRange(startYmd, endYmd).length;
  if (dayCount <= EIGHT_WEEKS_DAYS) return "day";
  if (dayCount <= SIX_MONTHS_DAYS) return "week";
  return "month";
}

/** Column headers for the plan chart at the scale chosen by {@link getPlanScale}. */
export function getScaleColumns(
  startYmd: string,
  endYmd: string
): ScaleColumn[] {
  const scale = getPlanScale(startYmd, endYmd);

  if (scale === "day") {
    return expandYmdRange(startYmd, endYmd).map((ymd) => {
      const d = parseYmd(ymd);
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      return {
        key: ymd,
        label: `${month}/${day.toString().padStart(2, "0")}`,
        startYmd: ymd,
        endYmd: ymd,
      };
    });
  }

  if (scale === "week") {
    const columns: ScaleColumn[] = [];
    let weekStart = getWeekStartDate(parseYmd(startYmd));
    const planEndMs = parseYmd(endYmd).getTime();

    while (weekStart.getTime() <= planEndMs) {
      const weekStartYmd = formatWeekKey(weekStart);
      const weekEndYmd = addCalendarDays(weekStartYmd, 6);
      columns.push({
        key: weekStartYmd,
        label: formatWeekShort(weekStart),
        startYmd: weekStartYmd < startYmd ? startYmd : weekStartYmd,
        endYmd: weekEndYmd > endYmd ? endYmd : weekEndYmd,
      });
      weekStart = new Date(weekStart);
      weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    }

    return columns;
  }

  return getMonthsInRange(parseYmd(startYmd), parseYmd(endYmd)).map(
    ({ monthKey, label }) => {
      const [y, m] = monthKey.split("-").map(Number);
      const monthStartYmd = `${y}-${String(m).padStart(2, "0")}-01`;
      const monthEndYmd = formatYmd(new Date(Date.UTC(y, m, 0)));
      return {
        key: monthKey,
        label,
        startYmd: monthStartYmd < startYmd ? startYmd : monthStartYmd,
        endYmd: monthEndYmd > endYmd ? endYmd : monthEndYmd,
      };
    }
  );
}
