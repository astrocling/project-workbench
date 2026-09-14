import { expandYmdRange, parseYmd } from "@/lib/plan/businessDays";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatPlanPrintDate(ymd: string): string {
  const d = parseYmd(ymd);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatPlanPrintShort(ymd: string): string {
  const d = parseYmd(ymd);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatPlanPrintRange(startYmd: string, endYmd: string): string {
  if (startYmd === endYmd) return formatPlanPrintDate(startYmd);
  return `${formatPlanPrintShort(startYmd)} – ${formatPlanPrintShort(endYmd)}`;
}

/** Inclusive calendar-day count → "N days" or nearest-half weeks. */
export function formatPlanDurationLabel(inclusiveDays: number): string {
  const days = Math.max(0, Math.round(inclusiveDays));
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  const weeks = Math.round((days / 7) * 2) / 2;
  const label = Number.isInteger(weeks) ? String(weeks) : weeks.toFixed(1);
  return `${label} week${weeks === 1 ? "" : "s"}`;
}

export function printGanttColWidth(paneWidth: number, columnCount: number): number {
  const n = Math.max(columnCount, 1);
  if (paneWidth <= 0) return 1;
  return paneWidth / n;
}

export function phaseItemDateRange(
  items: { startDate: string; endDate: string }[]
): { start: string; end: string } | null {
  if (items.length === 0) return null;
  let start = items[0]!.startDate;
  let end = items[0]!.endDate;
  for (const item of items) {
    if (item.startDate < start) start = item.startDate;
    if (item.endDate > end) end = item.endDate;
  }
  return { start, end };
}

export function planInclusiveDayCount(kickoffYmd: string, endYmd: string): number {
  return expandYmdRange(kickoffYmd, endYmd).length;
}
