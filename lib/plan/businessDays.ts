/**
 * UTC calendar-day utilities for Project Plan business-day math.
 * Aligns with lib/weekUtils.ts and lib/float/excludedDays.ts conventions.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse `YYYY-MM-DD` as UTC midnight. */
export function parseYmd(s: string): Date {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new Error(`Invalid YYYY-MM-DD date: ${s}`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid YYYY-MM-DD date: ${s}`);
  }
  return d;
}

/** Format a Date as UTC `YYYY-MM-DD`. */
export function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when the UTC calendar day is Saturday or Sunday. */
export function isWeekendYmd(ymd: string): boolean {
  const w = parseYmd(ymd).getUTCDay();
  return w === 0 || w === 6;
}

/** Add calendar days (negative to subtract). */
export function addCalendarDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return formatYmd(d);
}

function isBusinessDay(ymd: string, nonWorkingYmds: Set<string>): boolean {
  return !isWeekendYmd(ymd) && !nonWorkingYmds.has(ymd);
}

/**
 * Advance by `days` business days (weekends + `nonWorkingYmds` skipped).
 * Negative `days` moves backward.
 */
export function addBusinessDays(
  ymd: string,
  days: number,
  nonWorkingYmds: Set<string>
): string {
  if (days === 0) return ymd;
  const direction = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  let current = ymd;
  while (remaining > 0) {
    current = addCalendarDays(current, direction);
    if (isBusinessDay(current, nonWorkingYmds)) {
      remaining--;
    }
  }
  return current;
}

/** Inclusive count of business days between start and end. */
export function countBusinessDays(
  startYmd: string,
  endYmd: string,
  nonWorkingYmds: Set<string>
): number {
  if (startYmd > endYmd) return 0;
  let count = 0;
  for (const ymd of expandYmdRange(startYmd, endYmd)) {
    if (isBusinessDay(ymd, nonWorkingYmds)) count++;
  }
  return count;
}

/** Signed calendar days from `fromYmd` to `toYmd` (0 when equal). */
export function calendarDayDelta(fromYmd: string, toYmd: string): number {
  return Math.round((parseYmd(toYmd).getTime() - parseYmd(fromYmd).getTime()) / MS_PER_DAY);
}

/** Shift an inclusive date range by calendar days (duration preserved). */
export function shiftYmdRange(
  startYmd: string,
  endYmd: string,
  deltaDays: number
): { startDate: string; endDate: string } {
  return {
    startDate: addCalendarDays(startYmd, deltaDays),
    endDate: addCalendarDays(endYmd, deltaDays),
  };
}

/** Keep a 1-day minimum when a resize would invert the range. */
export function clampYmdRange(
  startYmd: string,
  endYmd: string,
  resized: "start" | "end"
): { startDate: string; endDate: string } {
  if (startYmd <= endYmd) return { startDate: startYmd, endDate: endYmd };
  if (resized === "start") return { startDate: endYmd, endDate: endYmd };
  return { startDate: startYmd, endDate: startYmd };
}

/** Inclusive UTC `YYYY-MM-DD` dates from start through end. */
export function expandYmdRange(start: string, end: string): string[] {
  const d0 = parseYmd(start);
  const d1 = parseYmd(end);
  if (d0.getTime() > d1.getTime()) return [];
  const out: string[] = [];
  for (let t = d0.getTime(); t <= d1.getTime(); t += MS_PER_DAY) {
    out.push(formatYmd(new Date(t)));
  }
  return out;
}
