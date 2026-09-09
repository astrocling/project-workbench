/** Half-day PTO matches GET /api/projects/[id]/resourcing (hours < 8). */
export const HALF_DAY_HOURS = 8;

/**
 * Given day entries for a person in a week, returns sorted weekday pills
 * { dayLabel, isHalf } (weekends omitted).
 */
export function getDayPills(
  days: { date: string; hours: number | null }[]
): { dayLabel: string; isHalf: boolean }[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayOnly = days
    .map((d) => {
      const dt = new Date(d.date + "T12:00:00.000Z");
      const dow = dt.getUTCDay();
      if (dow === 0 || dow === 6) return null;
      return {
        dow,
        dayLabel: labels[dow]!,
        isHalf: d.hours != null && d.hours < HALF_DAY_HOURS,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  weekdayOnly.sort((a, b) => a.dow - b.dow);
  return weekdayOnly.map(({ dayLabel, isHalf }) => ({ dayLabel, isHalf }));
}

/** Initials from a full name, e.g. "Andrei Perciun" → "AP". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

const UTC_WEEKDAY_LETTERS = ["S", "M", "T", "W", "R", "F", "S"] as const;

/** Single-letter weekday for a UTC calendar day `YYYY-MM-DD`. */
export function utcWeekdayLetter(dateYmd: string): string {
  const dt = new Date(dateYmd + "T12:00:00.000Z");
  return UTC_WEEKDAY_LETTERS[dt.getUTCDay()] ?? "";
}

/** Sorted unique weekday letters, e.g. `M, T, W`. */
export function formatWeekdayLetters(dates: string[]): string {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  return unique.map(utcWeekdayLetter).filter(Boolean).join(", ");
}

function weekdaySuffix(dates: string[]): string {
  const letters = formatWeekdayLetters(dates);
  return letters ? ` (${letters})` : "";
}

export function formatPtoHoverLine(
  name: string,
  entries: { date: string; hours: number | null; isPartial: boolean }[]
): string {
  const suffix = weekdaySuffix(entries.map((e) => e.date));
  const dayCount = entries.length;
  const hoursPartial = entries
    .filter((e) => e.isPartial)
    .reduce((s, e) => s + (e.hours ?? 0), 0);
  if (entries.some((e) => e.isPartial)) {
    return `${name}: partial PTO (${hoursPartial}h this week)${suffix}`;
  }
  return `${name}: ${dayCount} day(s) PTO${suffix}`;
}

export function formatHolidayHoverLine(label: string, dates: string[]): string {
  return `${label}${weekdaySuffix(dates)}`;
}
