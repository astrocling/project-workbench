/**
 * Week and as-of date utilities for Project Workbench.
 * All data is tracked by week starting Monday (weekStartDate).
 * As-of date is system-controlled: end of previous week (Sunday 23:59).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the Monday 00:00 (UTC) for the week containing the given date.
 */
export function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // Monday = start
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the as-of date: end of previous week (Sunday 23:59:59.999 UTC).
 * Users cannot edit this. To-date rollups use only weeks where weekStartDate <= asOfDate.
 */
export function getAsOfDate(now?: Date): Date {
  const n = now ?? new Date();
  const weekStart = getWeekStartDate(n);
  const prevSunday = new Date(weekStart);
  prevSunday.setUTCDate(prevSunday.getUTCDate() - 1);
  prevSunday.setUTCHours(23, 59, 59, 999);
  return prevSunday;
}

/**
 * Returns completed weeks: weekStartDate <= asOfDate.
 * Never includes current week in to-date rollups.
 */
export function getCompletedWeeks(
  projectStart: Date,
  projectEnd?: Date | null,
  asOf?: Date
): Date[] {
  const asOfDate = asOf ?? getAsOfDate();
  const start = getWeekStartDate(projectStart);
  const end = projectEnd
    ? getWeekStartDate(projectEnd)
    : getWeekStartDate(new Date());
  const weeks: Date[] = [];
  let current = new Date(start);
  while (current <= end && current <= asOfDate) {
    weeks.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return weeks;
}

/**
 * Returns future weeks: weekStartDate > asOfDate.
 */
export function getFutureWeeks(
  projectStart: Date,
  projectEnd?: Date | null,
  asOf?: Date
): Date[] {
  const asOfDate = asOf ?? getAsOfDate();
  const start = getWeekStartDate(projectStart);
  const end = projectEnd
    ? getWeekStartDate(projectEnd)
    : getWeekStartDate(new Date());
  const weeks: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    if (current > asOfDate) weeks.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return weeks;
}

/**
 * Returns all weeks from project start to end (or today if no end).
 */
export function getAllWeeks(
  projectStart: Date,
  projectEnd?: Date | null
): Date[] {
  const start = getWeekStartDate(projectStart);
  const end = projectEnd
    ? getWeekStartDate(projectEnd)
    : getWeekStartDate(new Date());
  const weeks: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    weeks.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return weeks;
}

/**
 * Returns true if weekStartDate <= asOfDate (completed week).
 */
export function isCompletedWeek(weekStartDate: Date, asOf?: Date): boolean {
  const asOfDate = asOf ?? getAsOfDate();
  const ws = getWeekStartDate(weekStartDate);
  return ws <= asOfDate;
}

/**
 * Returns true if weekStartDate > asOfDate (future week).
 */
export function isFutureWeek(weekStartDate: Date, asOf?: Date): boolean {
  const asOfDate = asOf ?? getAsOfDate();
  const ws = getWeekStartDate(weekStartDate);
  return ws > asOfDate;
}

/**
 * Returns true if this is the current in-progress week.
 */
export function isCurrentWeek(weekStartDate: Date, now?: Date): boolean {
  const today = now ?? new Date();
  const currentWeekStart = getWeekStartDate(today);
  const ws = getWeekStartDate(weekStartDate);
  return ws.getTime() === currentWeekStart.getTime();
}

/**
 * Parse a date from a column header string (returns the date as-is, no week normalization).
 * Used when the header represents Float's week start (Sunday).
 */
function parseHeaderDate(header: string): Date | null {
  const s = header.trim();
  const monthNames: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  // Float format: "26 Jan 2025", "8 Mar 2026" (Float uses Sunday as week start). Parse in UTC so week is server-TZ independent.
  const floatMatch = s.match(
    /^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})$/i
  );
  if (floatMatch) {
    const [, d, mon, y] = floatMatch;
    const month = monthNames[mon!.toLowerCase()]! - 1;
    const date = new Date(
      Date.UTC(parseInt(y!, 10), month, parseInt(d!, 10))
    );
    if (!isNaN(date.getTime())) return date;
  }
  // ISO-like: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = new Date(
      parseInt(y!, 10),
      parseInt(m!, 10) - 1,
      parseInt(d!, 10)
    );
    if (!isNaN(date.getTime())) return date;
  }
  // US: MM/DD/YYYY
  const usMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    const date = new Date(
      parseInt(y!, 10),
      parseInt(m!, 10) - 1,
      parseInt(d!, 10)
    );
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

/**
 * Parse Float CSV date column header. Float uses weeks Sunday–Saturday; the header is the Sunday.
 * Returns our week start (Monday) = Float's Sunday + 1 day. Uses UTC so result is server-TZ independent.
 */
export function parseFloatWeekHeader(header: string): Date | null {
  const floatSunday = parseHeaderDate(header);
  if (!floatSunday) return null;
  const monday = new Date(floatSunday);
  monday.setUTCDate(monday.getUTCDate() + 1);
  return getWeekStartDate(monday);
}

/**
 * Parse date column header to weekStartDate (Monday). Accepts formats like "2025-02-17", "26 Jan 2025".
 */
export function parseWeekHeader(header: string): Date | null {
  const date = parseHeaderDate(header);
  if (!date) return null;
  return getWeekStartDate(date);
}

/**
 * Format week start date as YYYY-MM-DD for display/keys.
 */
export function formatWeekKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Format week start date as M/DD for compact column headers (e.g. 2/17, 12/01).
 * Uses UTC to match week boundaries.
 */
export function formatWeekShort(date: Date): string {
  const d = new Date(date);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${month}/${day.toString().padStart(2, "0")}`;
}
