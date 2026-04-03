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
