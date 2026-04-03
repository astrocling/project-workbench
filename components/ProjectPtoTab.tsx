"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Toggle } from "@/components/Toggle";
import { HALF_DAY_HOURS, getDayPills, getInitials } from "@/lib/ptoDisplayUtils";
import { formatWeekKey, getWeekStartDate } from "@/lib/weekUtils";

/** Matches app/api/projects/[id]/resourcing/route.ts after day-level payload. */
type PtoHolidayEntry = {
  personId: string;
  type: "PTO" | "HOLIDAY";
  date: string;
  hours: number | null;
  label: string | null;
  isPartial: boolean;
};

type PtoHolidayByWeek = Record<string, PtoHolidayEntry[]>;

function toDateKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Returns all PTO entries across the project date range for a given personId.
// Each entry represents one calendar day.
// Groups by weekStartDate for the list view.
function getPtoByWeekForPerson(
  ptoHolidayByWeek: PtoHolidayByWeek,
  personId: string
): Record<string, { date: string; hours: number | null }[]> {
  const out: Record<string, { date: string; hours: number | null }[]> = {};
  for (const [weekKey, list] of Object.entries(ptoHolidayByWeek)) {
    const days: { date: string; hours: number | null }[] = [];
    for (const e of list) {
      if (e.type !== "PTO" || e.personId !== personId) continue;
      days.push({ date: e.date, hours: e.hours });
    }
    if (days.length > 0) out[weekKey] = days;
  }
  return out;
}

// Returns all people with any PTO in a given week, filtered to project members.
function getPeopleOutInWeek(
  ptoHolidayByWeek: PtoHolidayByWeek,
  weekKey: string,
  memberIds: string[]
): { personId: string; days: { date: string; hours: number | null }[] }[] {
  const set = new Set(memberIds);
  const byPerson = new Map<string, Map<string, { date: string; hours: number | null }>>();
  const list = ptoHolidayByWeek[weekKey] ?? [];
  for (const e of list) {
    if (e.type !== "PTO" || !set.has(e.personId)) continue;
    let m = byPerson.get(e.personId);
    if (!m) {
      m = new Map();
      byPerson.set(e.personId, m);
    }
    if (!m.has(e.date)) m.set(e.date, { date: e.date, hours: e.hours });
  }
  return [...byPerson.entries()].map(([personId, days]) => ({
    personId,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

/** Regional / team holidays for project members in a week (weekday rows only from API). */
function getPeopleHolidaysInWeek(
  ptoHolidayByWeek: PtoHolidayByWeek,
  weekKey: string,
  memberIds: string[]
): { personId: string; days: { date: string; label: string | null }[] }[] {
  const set = new Set(memberIds);
  const byPerson = new Map<string, Map<string, { date: string; label: string | null }>>();
  const list = ptoHolidayByWeek[weekKey] ?? [];
  for (const e of list) {
    if (e.type !== "HOLIDAY" || !set.has(e.personId)) continue;
    let m = byPerson.get(e.personId);
    if (!m) {
      m = new Map();
      byPerson.set(e.personId, m);
    }
    if (!m.has(e.date)) m.set(e.date, { date: e.date, label: e.label });
  }
  return [...byPerson.entries()].map(([personId, days]) => ({
    personId,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

export type PersonWeekTimeOffDay = {
  date: string;
  kind: "PTO" | "HOLIDAY";
  hours: number | null;
  label: string | null;
};

/** PTO + holidays for each project member in one week, one row per person in the list UI. */
function getPeopleTimeOffInWeek(
  ptoHolidayByWeek: PtoHolidayByWeek,
  weekKey: string,
  memberIds: string[]
): { personId: string; days: PersonWeekTimeOffDay[] }[] {
  const set = new Set(memberIds);
  const byPerson = new Map<string, Map<string, PersonWeekTimeOffDay>>();
  const list = ptoHolidayByWeek[weekKey] ?? [];
  for (const e of list) {
    if (e.type !== "PTO" && e.type !== "HOLIDAY") continue;
    if (!set.has(e.personId)) continue;
    const kind: "PTO" | "HOLIDAY" = e.type === "HOLIDAY" ? "HOLIDAY" : "PTO";
    const dedupeKey = `${e.date}\0${kind}`;
    let inner = byPerson.get(e.personId);
    if (!inner) {
      inner = new Map();
      byPerson.set(e.personId, inner);
    }
    if (!inner.has(dedupeKey)) {
      inner.set(dedupeKey, {
        date: e.date,
        kind,
        hours: kind === "PTO" ? e.hours : null,
        label: kind === "HOLIDAY" ? e.label : null,
      });
    } else if (kind === "HOLIDAY") {
      const cur = inner.get(dedupeKey)!;
      const a = cur.label?.trim();
      const b = e.label?.trim();
      if (a && b && a !== b) cur.label = `${a}, ${b}`;
      else if (b && !a) cur.label = e.label;
    }
  }
  return [...byPerson.entries()].map(([personId, m]) => ({
    personId,
    days: [...m.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

type TimeOffListPill =
  | { kind: "PTO"; dayLabel: string; isHalf: boolean }
  | { kind: "HOLIDAY"; dayLabel: string; label: string | null };

function getTimeOffListPills(days: PersonWeekTimeOffDay[]): TimeOffListPill[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const rows: { dow: number; pill: TimeOffListPill }[] = [];
  for (const d of days) {
    const dt = new Date(d.date + "T12:00:00.000Z");
    const dow = dt.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (d.kind === "PTO") {
      const isHalf = d.hours != null && d.hours < HALF_DAY_HOURS;
      rows.push({
        dow,
        pill: { kind: "PTO", dayLabel: labels[dow]!, isHalf },
      });
    } else {
      rows.push({
        dow,
        pill: { kind: "HOLIDAY", dayLabel: labels[dow]!, label: d.label },
      });
    }
  }
  rows.sort((a, b) => a.dow - b.dow);
  return rows.map((r) => r.pill);
}

// Returns all week keys (Mon dates as strings) within the project date range,
// including the full weeks that contain the start and end dates.
function getProjectWeekKeys(startDate: Date, endDate: Date): string[] {
  const start = getWeekStartDate(new Date(startDate));
  const end = getWeekStartDate(new Date(endDate));
  const keys: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    keys.push(formatWeekKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return keys;
}

// Returns all calendar months (as { year, month } objects) spanned by the
// project date range, including partial months at start and end.
function getProjectMonths(startDate: Date, endDate: Date): { year: number; month: number }[] {
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
  const out: { year: number; month: number }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push({ year: cur.getUTCFullYear(), month: cur.getUTCMonth() });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

/** Month to scroll calendar to: current calendar month (UTC), clamped to project months. */
function getCalendarScrollMonth(
  months: { year: number; month: number }[],
  now: Date
): { year: number; month: number } | null {
  if (months.length === 0) return null;
  const cy = now.getUTCFullYear();
  const cm = now.getUTCMonth();
  const nowOrd = cy * 12 + cm;
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const firstOrd = first.year * 12 + first.month;
  const lastOrd = last.year * 12 + last.month;
  if (nowOrd < firstOrd) return first;
  if (nowOrd > lastOrd) return last;
  return { year: cy, month: cm };
}

function formatWeekOfMonLabel(weekKey: string): string {
  const d = new Date(weekKey + "T12:00:00.000Z");
  return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function formatDayRangeInWeek(
  days: { date: string; hours: number | null }[]
): string {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return "";
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const f = new Date(first.date + "T12:00:00.000Z");
  const l = new Date(last.date + "T12:00:00.000Z");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (first.date === last.date) {
    return f.toLocaleDateString("en-US", opts);
  }
  return `${f.toLocaleDateString("en-US", opts)} – ${l.toLocaleDateString("en-US", opts)}`;
}

function isDateInRange(dateKey: string, rangeStart: string, rangeEnd: string): boolean {
  return dateKey >= rangeStart && dateKey <= rangeEnd;
}

function isPartialDay(hours: number | null): boolean {
  return hours != null && hours < HALF_DAY_HOURS;
}

function barWidthPercent(hours: number | null): number {
  if (hours == null || hours >= HALF_DAY_HOURS) return 100;
  return Math.min(100, Math.max(10, (hours / HALF_DAY_HOURS) * 100));
}

function formatCalendarDayHeading(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPtoDurationLine(
  hours: number | null,
  isPartial: boolean
): string {
  if (!isPartial && (hours == null || hours >= HALF_DAY_HOURS)) return "Full day";
  if (hours != null) return `${hours} hours`;
  return "Partial day";
}

type CalendarDayPtoEntry = {
  personId: string;
  hours: number | null;
  isPartial: boolean;
  label: string | null;
  kind: "PTO" | "HOLIDAY";
};

type ViewMode = "list" | "calendar";

export function ProjectPtoTab({
  projectId,
  members,
  projectStartDateIso,
  projectEndDateIso,
}: {
  projectId: string;
  members: { personId: string; name: string; role: string }[];
  projectStartDateIso: string;
  projectEndDateIso: string;
}) {
  const [ptoHolidayByWeek, setPtoHolidayByWeek] = useState<PtoHolidayByWeek>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [hidePastWeeks, setHidePastWeeks] = useState(true);

  const projectStart = useMemo(() => new Date(projectStartDateIso), [projectStartDateIso]);
  const projectEnd = useMemo(() => new Date(projectEndDateIso), [projectEndDateIso]);
  const rangeStartKey = useMemo(() => toDateKeyUtc(projectStart), [projectStart]);
  const rangeEndKey = useMemo(() => toDateKeyUtc(projectEnd), [projectEnd]);

  const memberIds = useMemo(() => members.map((m) => m.personId), [members]);
  const nameById = useMemo(() => new Map(members.map((m) => [m.personId, m.name])), [members]);

  const load = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    fetch(`/api/projects/${projectId}/resourcing`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<{ ptoHolidayByWeek?: PtoHolidayByWeek }>;
      })
      .then((data) => {
        setPtoHolidayByWeek(data.ptoHolidayByWeek ?? {});
      })
      .catch((e: unknown) => {
        setFetchError(e instanceof Error ? e.message : "Failed to load PTO and holidays");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  /** PTO + holidays for visible project members and project date range (API is already limited to assignment person ids). */
  const filteredPtoHolidayByWeek = useMemo(() => {
    const memberSet = new Set(memberIds);
    const next: PtoHolidayByWeek = {};
    for (const [wk, list] of Object.entries(ptoHolidayByWeek)) {
      const filtered: PtoHolidayEntry[] = [];
      for (const e of list) {
        if (e.type !== "PTO" && e.type !== "HOLIDAY") continue;
        if (!memberSet.has(e.personId)) continue;
        if (!isDateInRange(e.date, rangeStartKey, rangeEndKey)) continue;
        filtered.push(e);
      }
      if (filtered.length > 0) next[wk] = filtered;
    }
    return next;
  }, [ptoHolidayByWeek, memberIds, rangeStartKey, rangeEndKey]);

  const weekKeysWithTimeOff = useMemo(() => {
    const projectWeeks = getProjectWeekKeys(projectStart, projectEnd);
    return projectWeeks.filter((wk) => (filteredPtoHolidayByWeek[wk] ?? []).length > 0);
  }, [filteredPtoHolidayByWeek, projectStart, projectEnd]);

  const timeOffByDate = useMemo(() => {
    const map = new Map<string, CalendarDayPtoEntry[]>();
    for (const list of Object.values(filteredPtoHolidayByWeek)) {
      for (const e of list) {
        const arr = map.get(e.date) ?? [];
        arr.push({
          personId: e.personId,
          hours: e.hours,
          isPartial: e.isPartial,
          label: e.label,
          kind: e.type === "HOLIDAY" ? "HOLIDAY" : "PTO",
        });
        map.set(e.date, arr);
      }
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "PTO" ? -1 : 1;
        const na = nameById.get(a.personId) ?? a.personId;
        const nb = nameById.get(b.personId) ?? b.personId;
        return na.localeCompare(nb);
      });
    }
    return map;
  }, [filteredPtoHolidayByWeek, nameById]);

  const months = useMemo(
    () => getProjectMonths(projectStart, projectEnd),
    [projectStart, projectEnd]
  );

  const defaultMonthIndex = useMemo(() => {
    if (months.length === 0) return 0;
    const t = getCalendarScrollMonth(months, new Date());
    if (!t) return 0;
    const i = months.findIndex((m) => m.year === t.year && m.month === t.month);
    return i >= 0 ? i : 0;
  }, [months]);

  const [calendarMonthIndex, setCalendarMonthIndex] = useState(0);
  const prevViewRef = useRef<ViewMode | null>(null);

  useEffect(() => {
    if (months.length === 0) return;
    setCalendarMonthIndex((i) => Math.min(Math.max(0, i), months.length - 1));
  }, [months]);

  useEffect(() => {
    if (months.length === 0) return;
    if (view === "calendar" && prevViewRef.current !== "calendar") {
      setCalendarMonthIndex(defaultMonthIndex);
    }
    prevViewRef.current = view;
  }, [view, months.length, defaultMonthIndex]);

  const currentWeekStartKey = formatWeekKey(getWeekStartDate(new Date()));
  const listWeekKeys = hidePastWeeks
    ? weekKeysWithTimeOff.filter((wk) => wk >= currentWeekStartKey)
    : weekKeysWithTimeOff;

  const activeCalMonth =
    months.length > 0
      ? months[Math.min(Math.max(0, calendarMonthIndex), months.length - 1)]
      : undefined;
  const activeCalTitle = activeCalMonth
    ? new Date(Date.UTC(activeCalMonth.year, activeCalMonth.month, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label-sm text-surface-500 dark:text-surface-400 mr-2">View</span>
        <div className="inline-flex rounded-md border border-surface-200 dark:border-dark-border p-0.5 bg-surface-50 dark:bg-dark-raised">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-body-sm rounded ${
              view === "list"
                ? "bg-white dark:bg-dark-surface text-surface-900 dark:text-white shadow-sm font-medium"
                : "text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`px-3 py-1.5 text-body-sm rounded ${
              view === "calendar"
                ? "bg-white dark:bg-dark-surface text-surface-900 dark:text-white shadow-sm font-medium"
                : "text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            }`}
          >
            Calendar
          </button>
        </div>
        {view === "list" && (
          <Toggle
            checked={hidePastWeeks}
            onChange={setHidePastWeeks}
            label="Hide past weeks"
            size="sm"
          />
        )}
      </div>

      {fetchError && (
        <div
          className="rounded-md border border-jred-200 dark:border-jred-700 bg-jred-50 dark:bg-jred-900/20 px-3 py-2 text-body-sm text-jred-800 dark:text-jred-200"
          role="alert"
        >
          {fetchError}{" "}
          <button type="button" className="underline font-medium" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <p className="text-body-sm text-surface-500 dark:text-surface-400" aria-busy>
          Loading PTO and holidays…
        </p>
      )}

      {!loading && !fetchError && members.length === 0 && (
        <p className="text-body-sm text-surface-500 dark:text-surface-400">
          No team members on this project (visible on resourcing). Add assignments in Settings.
        </p>
      )}

      {!loading && !fetchError && members.length > 0 && view === "list" && (
        <div className="space-y-6">
          {listWeekKeys.length === 0 ? (
            <p className="text-body-sm text-surface-500 dark:text-surface-400">
              {weekKeysWithTimeOff.length === 0
                ? "No PTO or holidays for project members in this date range."
                : hidePastWeeks
                  ? "No PTO or holidays in upcoming weeks (try showing past weeks)."
                  : "No PTO or holidays for project members in this date range."}
            </p>
          ) : (
            listWeekKeys.map((weekKey) => {
              const rowsRaw = getPeopleTimeOffInWeek(filteredPtoHolidayByWeek, weekKey, memberIds);
              const rows = [...rowsRaw].sort((a, b) => b.days.length - a.days.length);
              const headcount = rows.length;
              return (
                <div
                  key={weekKey}
                  className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-surface-100 dark:border-dark-border bg-surface-50/80 dark:bg-dark-raised/50">
                    <span className="text-body-sm font-medium text-surface-800 dark:text-surface-100">
                      {formatWeekOfMonLabel(weekKey)}
                    </span>
                    {headcount >= 2 ? (
                      <span className="inline-flex items-center rounded-full border border-surface-300 dark:border-surface-600 bg-surface-100 dark:bg-dark-border/50 px-2.5 py-0.5 text-[11px] font-semibold text-surface-700 dark:text-surface-200">
                        {headcount} people affected
                      </span>
                    ) : headcount === 1 ? (
                      <span className="text-body-sm text-surface-500 dark:text-surface-400">1 person</span>
                    ) : null}
                  </div>
                  <ul className="divide-y divide-surface-100 dark:divide-dark-border">
                    {rows.map((p) => {
                      const name = nameById.get(p.personId) ?? p.personId;
                      const pills = getTimeOffListPills(p.days);
                      const holidayLabels = [
                        ...new Set(
                          p.days
                            .filter((d) => d.kind === "HOLIDAY")
                            .map((d) => d.label)
                            .filter((x): x is string => Boolean(x?.trim()))
                        ),
                      ];
                      return (
                        <li key={p.personId} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className="text-body-sm font-medium text-surface-800 dark:text-surface-100 min-w-[130px]">
                            {name}
                          </span>
                          <span className="text-body-sm text-surface-500 dark:text-surface-400 min-w-[130px]">
                            {formatDayRangeInWeek(
                              p.days.map((d) => ({
                                date: d.date,
                                hours: d.kind === "PTO" ? d.hours : null,
                              }))
                            )}
                          </span>
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex flex-wrap gap-[3px]">
                              {pills.map((pill, i) =>
                                pill.kind === "PTO" ? (
                                  <span
                                    key={`pto-${pill.dayLabel}-${i}`}
                                    className={
                                      pill.isHalf
                                        ? "inline-flex items-center rounded-full border border-dashed border-amber-400 dark:border-amber-500 bg-white dark:bg-dark-surface text-[11px] px-2 py-0.5 text-amber-800 dark:text-amber-200"
                                        : "inline-flex items-center rounded-full border border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30 text-[11px] px-2 py-0.5 text-amber-800 dark:text-amber-200"
                                    }
                                  >
                                    {pill.isHalf ? `${pill.dayLabel} ½` : pill.dayLabel}
                                  </span>
                                ) : (
                                  <span
                                    key={`hol-${pill.dayLabel}-${i}`}
                                    className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/50 text-[11px] px-2 py-0.5 text-slate-800 dark:text-slate-200"
                                  >
                                    {pill.dayLabel}
                                  </span>
                                )
                              )}
                            </div>
                            {holidayLabels.length > 0 ? (
                              <span
                                className="text-[11px] text-surface-600 dark:text-surface-400 truncate"
                                title={holidayLabels.join(", ")}
                              >
                                {holidayLabels.join(", ")}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}

      {!loading && !fetchError && members.length > 0 && view === "calendar" && activeCalMonth && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCalendarMonthIndex((i) => Math.max(0, i - 1))}
              disabled={calendarMonthIndex <= 0}
              aria-label="Previous month"
              className="inline-flex items-center justify-center h-8 w-8 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 dark:focus:ring-offset-dark-bg"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <h3 className="min-w-[200px] text-center text-body-sm font-semibold text-surface-800 dark:text-surface-100">
              {activeCalTitle}
            </h3>
            <button
              type="button"
              onClick={() =>
                setCalendarMonthIndex((i) => Math.min(months.length - 1, i + 1))
              }
              disabled={calendarMonthIndex >= months.length - 1}
              aria-label="Next month"
              className="inline-flex items-center justify-center h-8 w-8 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 dark:focus:ring-offset-dark-bg"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <MonthCalendar
            year={activeCalMonth.year}
            month={activeCalMonth.month}
            rangeStartKey={rangeStartKey}
            rangeEndKey={rangeEndKey}
            timeOffByDate={timeOffByDate}
            nameById={nameById}
            showMonthTitleRow={false}
          />
        </div>
      )}
    </div>
  );
}

function MonthCalendar({
  year,
  month,
  rangeStartKey,
  rangeEndKey,
  timeOffByDate,
  nameById,
  showMonthTitleRow = true,
}: {
  year: number;
  month: number;
  rangeStartKey: string;
  rangeEndKey: string;
  timeOffByDate: Map<string, CalendarDayPtoEntry[]>;
  nameById: Map<string, string>;
  /** When false, month/year heading is omitted (e.g. shown in external nav). */
  showMonthTitleRow?: boolean;
}) {
  const monthTitle = new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();

  const cells: ({ kind: "empty" } | { kind: "day"; dateKey: string; dayNum: number })[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ kind: "empty" });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ kind: "day", dateKey, dayNum: d });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "empty" });
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          {showMonthTitleRow && (
            <tr>
              <th
                colSpan={7}
                className="bg-surface-100 dark:bg-dark-raised px-2 py-2 text-center text-body-sm font-medium text-surface-600 dark:text-surface-400"
              >
                {monthTitle}
              </th>
            </tr>
          )}
          <tr>
            {dowLabels.map((d) => (
              <th
                key={d}
                className="border border-surface-200 dark:border-dark-border px-1 py-1 text-center text-[11px] font-medium text-surface-500 dark:text-surface-400"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) =>
                cell.kind === "empty" ? (
                  <td
                    key={`e-${ri}-${ci}`}
                    className="border border-surface-200 dark:border-dark-border bg-surface-50/50 dark:bg-dark-bg/30 min-h-[400px] align-top p-1"
                  />
                ) : (
                  <DayCell
                    key={cell.dateKey}
                    dateKey={cell.dateKey}
                    dayNum={cell.dayNum}
                    rangeStartKey={rangeStartKey}
                    rangeEndKey={rangeEndKey}
                    timeOffForDay={timeOffByDate.get(cell.dateKey) ?? []}
                    nameById={nameById}
                  />
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayCell({
  dateKey,
  dayNum,
  rangeStartKey,
  rangeEndKey,
  timeOffForDay,
  nameById,
}: {
  dateKey: string;
  dayNum: number;
  rangeStartKey: string;
  rangeEndKey: string;
  timeOffForDay: CalendarDayPtoEntry[];
  nameById: Map<string, string>;
}) {
  const inRange = isDateInRange(dateKey, rangeStartKey, rangeEndKey);
  const dow = new Date(dateKey + "T12:00:00.000Z").getUTCDay();
  const isWeekend = dow === 0 || dow === 6;

  const memberRows = timeOffForDay.filter((p) => nameById.has(p.personId));
  const multi = memberRows.length >= 2;
  const display = memberRows.length > 3 ? memberRows.slice(0, 2) : memberRows;
  const overflow = memberRows.length > 3 ? memberRows.length - 2 : 0;
  const hasPto = memberRows.some((p) => p.kind === "PTO");
  const hasHoliday = memberRows.some((p) => p.kind === "HOLIDAY");

  return (
    <td
      className={`relative border align-top p-1 min-h-[400px] min-w-0 w-[14.28%] ${
        !inRange
          ? "bg-surface-100/80 dark:bg-dark-raised/40 opacity-60"
          : isWeekend
            ? "bg-surface-50 dark:bg-dark-raised/30"
            : multi
              ? hasPto
                ? "bg-amber-50 dark:bg-amber-900/15"
                : "bg-slate-50 dark:bg-slate-900/20"
              : hasHoliday && !hasPto
                ? "bg-slate-50/80 dark:bg-slate-900/25"
                : "bg-white dark:bg-dark-surface"
      }`}
    >
      {multi && (
        <span
          className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
            hasPto ? "bg-amber-600 dark:bg-amber-400" : "bg-slate-500 dark:bg-slate-400"
          }`}
          aria-hidden
        />
      )}
      <div
        className={`text-[11px] mb-1 ${
          !inRange
            ? "text-surface-400 dark:text-surface-500"
            : isWeekend
              ? "text-surface-400 dark:text-surface-500"
              : "text-surface-500 dark:text-surface-400"
        }`}
      >
        {dayNum}
      </div>
      <div className="flex flex-col gap-1">
        {display.map((p) => {
          const isHol = p.kind === "HOLIDAY";
          const partial = !isHol && (p.isPartial || isPartialDay(p.hours));
          const w = isHol ? 100 : barWidthPercent(p.hours);
          const fullName = nameById.get(p.personId) ?? p.personId;
          const initials = getInitials(fullName);
          return (
            <div key={`${p.personId}-${p.kind}`} className="group/input-tip relative min-w-0">
              <div
                className={`h-[5px] rounded-[2px] ${
                  isHol
                    ? "bg-slate-400 dark:bg-slate-500"
                    : partial
                      ? "bg-amber-200 dark:bg-amber-700/60"
                      : "bg-amber-400 dark:bg-amber-500"
                }`}
                style={{ width: `${w}%` }}
              />
              <div
                className={`text-[10px] truncate leading-tight ${
                  isHol ? "text-slate-800 dark:text-slate-100" : "text-amber-900 dark:text-amber-100"
                }`}
              >
                {initials}
                {isHol ? " · H" : partial ? " ½" : ""}
              </div>
              <div
                className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-max max-w-[16rem] rounded border border-surface-200 bg-white px-2 py-1.5 text-left text-xs text-surface-800 shadow-md group-hover/input-tip:block dark:border-dark-border dark:bg-dark-surface dark:text-surface-200"
                role="tooltip"
              >
                <div className="font-medium text-surface-900 dark:text-white">{fullName}</div>
                <div className="text-surface-600 dark:text-surface-400">
                  {formatCalendarDayHeading(dateKey)}
                </div>
                <div className="mt-0.5">
                  {isHol ? "Holiday" : formatPtoDurationLine(p.hours, partial)}
                </div>
                {p.label ? (
                  <div className="mt-1 border-t border-surface-200 pt-1 text-surface-700 dark:border-dark-border dark:text-surface-300">
                    {p.label}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {overflow > 0 && (
          <span className="group/input-tip relative inline-block text-[10px] text-surface-500 dark:text-surface-400">
            +{overflow}
            <div
              className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-max max-w-[16rem] rounded border border-surface-200 bg-white px-2 py-1.5 text-left text-xs text-surface-800 shadow-md group-hover/input-tip:block dark:border-dark-border dark:bg-dark-surface dark:text-surface-200"
              role="tooltip"
            >
              <div className="mb-1 font-medium text-surface-900 dark:text-white">
                {overflow} more on this day
              </div>
              <ul className="space-y-1">
                {memberRows.slice(display.length).map((p) => {
                  const isHol = p.kind === "HOLIDAY";
                  const partial = !isHol && (p.isPartial || isPartialDay(p.hours));
                  const nm = nameById.get(p.personId) ?? p.personId;
                  return (
                    <li
                      key={`${p.personId}-${p.kind}`}
                      className="border-t border-surface-100 pt-1 first:border-t-0 first:pt-0 dark:border-dark-border"
                    >
                      <div className="font-medium text-surface-900 dark:text-white">{nm}</div>
                      <div className="text-surface-600 dark:text-surface-400">
                        {isHol ? "Holiday" : formatPtoDurationLine(p.hours, partial)}
                        {p.label ? ` · ${p.label}` : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </span>
        )}
      </div>
    </td>
  );
}

export {
  getPtoByWeekForPerson,
  getPeopleOutInWeek,
  getPeopleHolidaysInWeek,
  getPeopleTimeOffInWeek,
  getDayPills,
  getInitials,
  getProjectWeekKeys,
  getProjectMonths,
};

export default ProjectPtoTab;
