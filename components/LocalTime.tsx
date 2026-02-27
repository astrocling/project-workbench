"use client";

/**
 * Renders an ISO date string in the user's local timezone.
 * Use this for timestamps that are rendered in server components (e.g. production)
 * so the time is shown in the viewer's local time, not the server's (e.g. UTC).
 */
export function LocalTime({ isoDate }: { isoDate: string | Date | null }) {
  if (isoDate == null) return <>Never</>;
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  return <>{d.toLocaleString()}</>;
}
