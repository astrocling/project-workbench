/** Format YYYY-MM-DD (or ISO datetime) as MM/DD without timezone day-shift. */
export function formatMonthDay(isoDate: string): string {
  const datePart = isoDate.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (match) {
    return `${match[2]}/${match[3]}`;
  }
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${String(m).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

/** True if the calendar date falls on Thursday (4) or Friday (5), using date-only parsing. */
export function isThursdayOrFriday(isoDate: string): boolean {
  const datePart = isoDate.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const day = Number(match[3]);
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    return dow === 4 || dow === 5;
  }
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const dow = d.getDay();
  return dow === 4 || dow === 5;
}

/** Day name for deploy-date flag (Thu/Fri), using date-only parsing. */
export function getDeployDayName(isoDate: string): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const datePart = isoDate.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const day = Number(match[3]);
    return names[new Date(Date.UTC(y, m - 1, day)).getUTCDay()] ?? "";
  }
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return names[d.getDay()] ?? "";
}
