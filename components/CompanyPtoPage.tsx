"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardPtoProjectPayload } from "@/lib/pgmPtoWidgetData";
import { HALF_DAY_HOURS, getInitials } from "@/lib/ptoDisplayUtils";
import {
  formatWeekKey,
  formatWeekShort,
  getWeekStartDate,
  isUtcWeekdayDate,
} from "@/lib/weekUtils";
import { getWeekEntries, type WeekEntryRow } from "@/components/PgmPtoWidget";
import { PersonTextFilterCombobox } from "@/components/PersonCombobox";
import type { CompanyPerson, CompanyPtoApiResponse } from "@/lib/companyPtoTypes";
import type { PtoHolidayByWeek } from "@/lib/pgmPtoWidgetData";

type View = "overview" | "timeline";
type TimelineMode = "grid" | "list";

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/** Monday week keys (YYYY-MM-DD) whose week overlaps the calendar month. */
function weeksOverlappingCalendarMonth(year: number, monthIndex: number): string[] {
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0));
  let ws = getWeekStartDate(monthStart);
  const keys: string[] = [];
  for (let i = 0; i < 8; i++) {
    const we = addUtcDays(ws, 6);
    if (we < monthStart) {
      ws = addUtcDays(ws, 7);
      continue;
    }
    if (ws > monthEnd) break;
    keys.push(formatWeekKey(ws));
    ws = addUtcDays(ws, 7);
  }
  return keys;
}

function dateInCalendarMonth(
  ymd: string,
  year: number,
  monthIndex: number
): boolean {
  const d = new Date(ymd + "T12:00:00.000Z");
  return d.getUTCFullYear() === year && d.getUTCMonth() === monthIndex;
}

function filterPtoByPeople(
  pto: PtoHolidayByWeek,
  ids: Set<string>
): PtoHolidayByWeek {
  const out: PtoHolidayByWeek = {};
  for (const [wk, list] of Object.entries(pto)) {
    const next = list.filter((e) => ids.has(e.personId));
    if (next.length > 0) out[wk] = next;
  }
  return out;
}

function nextTwelveMonthAnchors(from: Date): { year: number; monthIndex: number }[] {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const out: { year: number; monthIndex: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(y, m + i, 1));
    out.push({ year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() });
  }
  return out;
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const DOW_OFF: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function dateFromWeekAndDayLabel(weekKey: string, dayLabel: string): Date {
  const m = new Date(weekKey + "T00:00:00.000Z");
  const off = DOW_OFF[dayLabel] ?? 0;
  m.setUTCDate(m.getUTCDate() + off);
  return m;
}

function buildCompanyPayload(
  members: CompanyPerson[],
  pto: PtoHolidayByWeek
): DashboardPtoProjectPayload {
  return {
    projectId: "__company__",
    projectName: "Company",
    members: members.map((m) => ({
      personId: m.personId,
      name: m.name,
      role: m.role,
      floatRegionId: m.floatRegionId,
    })),
    ptoHolidayByWeek: pto,
  };
}

type WeekCellKind =
  | "empty"
  | "pto_full"
  | "pto_partial"
  | "pto_mixed"
  | "holiday"
  | "both";

/** PTO-only weeks: partial-only → ½ day; mix of full + partial → PTO pill (Step 4). */
function summarizeWeekForPerson(
  personId: string,
  weekKey: string,
  pto: PtoHolidayByWeek
): WeekCellKind {
  const rows = pto[weekKey]?.filter((e) => e.personId === personId) ?? [];
  if (rows.length === 0) return "empty";
  let hasHol = false;
  let hasPto = false;
  let hasPartialPto = false;
  let hasFullPto = false;
  for (const r of rows) {
    if (r.type === "HOLIDAY") hasHol = true;
    else {
      hasPto = true;
      const partial = r.isPartial || (r.hours != null && r.hours < HALF_DAY_HOURS);
      if (partial) hasPartialPto = true;
      else hasFullPto = true;
    }
  }
  if (hasHol && hasPto) return "both";
  if (hasHol) return "holiday";
  if (hasPto) {
    if (hasPartialPto && hasFullPto) return "pto_mixed";
    if (hasPartialPto) return "pto_partial";
    return "pto_full";
  }
  return "empty";
}

/** Same idea as `formatShortMonDay` in PgmPtoWidget (week start Monday key). */
function formatShortMonDayFromWeekKey(weekKey: string): string {
  const d = new Date(weekKey + "T12:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function uniquePeopleWithAbsenceInMonth(
  pto: PtoHolidayByWeek,
  year: number,
  monthIndex: number,
  allowedIds: Set<string>
): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(pto)) {
    for (const e of list) {
      if (!allowedIds.has(e.personId)) continue;
      if (!dateInCalendarMonth(e.date, year, monthIndex)) continue;
      if (e.type === "HOLIDAY" && !isUtcWeekdayDate(new Date(e.date + "T12:00:00.000Z"))) {
        continue;
      }
      ids.add(e.personId);
    }
  }
  return ids;
}

/** Unique people with any PTO day in the calendar month (filtered by allowedIds). */
function uniquePeopleWithPtoInMonth(
  pto: PtoHolidayByWeek,
  year: number,
  monthIndex: number,
  allowedIds: Set<string>
): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(pto)) {
    for (const e of list) {
      if (e.type !== "PTO") continue;
      if (!allowedIds.has(e.personId)) continue;
      if (!dateInCalendarMonth(e.date, year, monthIndex)) continue;
      ids.add(e.personId);
    }
  }
  return ids;
}

/**
 * Unique people with a regional holiday in the calendar month; holiday row's
 * `floatRegionId` must match the person's `floatRegionId` (including both null).
 */
function uniquePeopleWithHolidayInMonth(
  pto: PtoHolidayByWeek,
  year: number,
  monthIndex: number,
  allowedIds: Set<string>,
  personFloatRegionById: Map<string, number | null>
): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(pto)) {
    for (const e of list) {
      if (e.type !== "HOLIDAY") continue;
      if (!allowedIds.has(e.personId)) continue;
      if (!dateInCalendarMonth(e.date, year, monthIndex)) continue;
      if (!isUtcWeekdayDate(new Date(e.date + "T12:00:00.000Z"))) continue;
      const pr = personFloatRegionById.get(e.personId) ?? null;
      const hr = e.floatRegionId ?? null;
      if (pr !== hr) continue;
      ids.add(e.personId);
    }
  }
  return ids;
}

function weeklyOutCountsForMonth(
  pto: PtoHolidayByWeek,
  weekKeys: string[],
  year: number,
  monthIndex: number,
  allowedIds: Set<string>
): number[] {
  return weekKeys.map((wk) => {
    const inWeek = new Set<string>();
    const list = pto[wk] ?? [];
    for (const e of list) {
      if (!allowedIds.has(e.personId)) continue;
      if (!dateInCalendarMonth(e.date, year, monthIndex)) continue;
      if (e.type === "HOLIDAY" && !isUtcWeekdayDate(new Date(e.date + "T12:00:00.000Z"))) {
        continue;
      }
      inWeek.add(e.personId);
    }
    return inWeek.size;
  });
}

/** Map 4–6 overlapping week counts into exactly 4 bars (spec: 4 bars for the 4–5 weeks in the month). */
function aggregateWeeklyCountsToFourBars(weeklyCounts: number[]): [number, number, number, number] {
  const n = weeklyCounts.length;
  if (n === 0) return [0, 0, 0, 0];
  const bars: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const b = Math.min(3, Math.floor((i * 4) / n));
    const c = weeklyCounts[i] ?? 0;
    bars[b] = Math.max(bars[b]!, c);
  }
  return bars;
}

function personPreviewKindForMonth(
  personId: string,
  pto: PtoHolidayByWeek,
  year: number,
  monthIndex: number
): "pto" | "holiday_only" {
  let ptoDay = false;
  let holDay = false;
  for (const list of Object.values(pto)) {
    for (const e of list) {
      if (e.personId !== personId) continue;
      if (!dateInCalendarMonth(e.date, year, monthIndex)) continue;
      if (e.type === "PTO") ptoDay = true;
      else if (isUtcWeekdayDate(new Date(e.date + "T12:00:00.000Z"))) holDay = true;
    }
  }
  if (ptoDay) return "pto";
  return "holiday_only";
}

/** Heights 4px–36px; full amber at ≥50% of month's peak week, lighter amber below (no labels). */
function MonthSparkline({
  countsFour,
  peakWeekCount,
}: {
  countsFour: [number, number, number, number];
  /** Max people-out in any single week overlapping the month (denominator for bar height). */
  peakWeekCount: number;
}) {
  const peak = Math.max(1, peakWeekCount);
  return (
    <div
      className="flex items-end justify-between gap-1 px-0.5 min-h-[36px]"
      aria-hidden
    >
      {countsFour.map((c, i) => {
        const ratio = c / peak;
        const h = Math.max(4, Math.min(36, Math.round(4 + ratio * 32)));
        const strong = ratio >= 0.5;
        return (
          <div
            key={i}
            className={`flex-1 min-w-0 rounded-sm ${
              strong
                ? "bg-amber-500 dark:bg-amber-500/90"
                : "bg-amber-300/80 dark:bg-amber-700/50"
            }`}
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}

function ListRowFromWeekEntry({ row }: { row: WeekEntryRow }) {
  const tagHoliday =
    row.hasHoliday && row.holidayTagNames.length > 0
      ? row.holidayTagNames.join(", ")
      : row.hasHoliday
        ? "Holiday"
        : "";

  return (
    <>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="h-6 w-6 shrink-0 rounded-full bg-surface-100 dark:bg-dark-raised text-surface-800 dark:text-surface-200 flex items-center justify-center text-[10px] font-semibold border border-surface-200/80 dark:border-dark-border"
          aria-hidden
        >
          {getInitials(row.name)}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-surface-900 dark:text-white truncate">
            {row.name}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {row.hasPto ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden />
                <span className="text-[11px] text-surface-500 dark:text-surface-400">PTO</span>
              </span>
            ) : null}
            {row.hasPto && row.hasHoliday ? (
              <span className="text-[11px] text-surface-400 dark:text-surface-500" aria-hidden>
                ·
              </span>
            ) : null}
            {row.hasHoliday ? (
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full bg-jblue-500 shrink-0" aria-hidden />
                <span className="text-[11px] text-surface-500 dark:text-surface-400 truncate">
                  Holiday{tagHoliday ? ` — ${tagHoliday}` : ""}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        {row.pills.map((p, i) =>
          p.kind === "pto" ? (
            p.isHalf ? (
              <span
                key={`pto-h-${p.dayLabel}-${i}`}
                className="inline-flex items-center rounded-full border border-dashed border-amber-400 dark:border-amber-500 bg-white dark:bg-dark-surface text-[11px] px-[7px] py-0.5 text-amber-800 dark:text-amber-200"
              >
                {p.dayLabel} ½
              </span>
            ) : (
              <span
                key={`pto-f-${p.dayLabel}-${i}`}
                className="inline-flex items-center rounded-full border border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30 text-[11px] px-[7px] py-0.5 text-amber-800 dark:text-amber-200"
              >
                {p.dayLabel}
              </span>
            )
          ) : (
            <span
              key={`hol-${p.dayLabel}-${i}`}
              className="inline-flex items-center rounded-full border border-jblue-200 dark:border-jblue-600 bg-jblue-50 dark:bg-jblue-950/50 text-[11px] px-[7px] py-0.5 text-jblue-800 dark:text-jblue-100"
            >
              {p.dayLabel}
            </span>
          )
        )}
      </div>
    </>
  );
}

export default function CompanyPtoPage() {
  const [allPeople, setAllPeople] = useState<CompanyPerson[]>([]);
  const [allPto, setAllPto] = useState<PtoHolidayByWeek>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    fetch("/api/company/pto-holidays")
      .then((r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 401
              ? "You need to sign in to view this page."
              : "Could not load company PTO data."
          );
        }
        return r.json() as Promise<CompanyPtoApiResponse>;
      })
      .then((data) => {
        setAllPeople(Array.isArray(data.people) ? data.people : []);
        setAllPto(
          data.ptoHolidayByWeek && typeof data.ptoHolidayByWeek === "object"
            ? data.ptoHolidayByWeek
            : {}
        );
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : "Load failed.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [region, setRegion] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("overview");
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("grid");
  const [selectedMonth, setSelectedMonth] = useState<{
    year: number;
    monthIndex: number;
  } | null>(null);

  const today = useMemo(() => new Date(), []);

  const monthAnchors = useMemo(() => nextTwelveMonthAnchors(today), [today]);

  const regionOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of allPeople) {
      if (p.floatRegionName) names.add(p.floatRegionName);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [allPeople]);

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    for (const p of allPeople) roles.add(p.role);
    return [...roles].sort((a, b) => a.localeCompare(b));
  }, [allPeople]);

  /** People matching region/role (for search datalist autocomplete). */
  const peopleForSearchSuggestions = useMemo(() => {
    return allPeople.filter((p) => {
      if (region !== "all") {
        const rn = p.floatRegionName ?? "";
        if (rn !== region) return false;
      }
      if (role !== "all" && p.role !== role) return false;
      return true;
    });
  }, [allPeople, region, role]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPeople.filter((p) => {
      if (region !== "all") {
        const rn = p.floatRegionName ?? "";
        if (rn !== region) return false;
      }
      if (role !== "all" && p.role !== role) return false;
      if (q.length > 0 && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allPeople, region, role, search]);

  const filteredIds = useMemo(
    () => new Set(filteredPeople.map((p) => p.personId)),
    [filteredPeople]
  );

  const personFloatRegionById = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const p of filteredPeople) {
      m.set(p.personId, p.floatRegionId ?? null);
    }
    return m;
  }, [filteredPeople]);

  const filteredPto = useMemo(
    () => filterPtoByPeople(allPto, filteredIds),
    [allPto, filteredIds]
  );

  const companyPayload = useMemo(
    () => buildCompanyPayload(filteredPeople, filteredPto),
    [filteredPeople, filteredPto]
  );

  const selectedKey =
    selectedMonth != null
      ? `${selectedMonth.year}-${selectedMonth.monthIndex}`
      : "";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-display-lg font-bold text-surface-900 dark:text-white mb-1">
          PTO &amp; Holidays
        </h2>
        <p className="text-body-md text-surface-600 dark:text-surface-300">
          Company-wide absences and holidays
        </p>
      </header>

      {loadError && (
        <div
          className="rounded-md border border-jred-200 dark:border-jred-700 bg-jred-50 dark:bg-jred-900/20 px-3 py-2 text-body-sm text-jred-800 dark:text-jred-200"
          role="alert"
        >
          {loadError}{" "}
          <button type="button" className="underline font-medium" onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4 shadow-card-light dark:shadow-card-dark">
        <label className="flex flex-col gap-1 text-label-sm text-surface-600 dark:text-surface-400">
          Region
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={loading}
            className="rounded-md border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-raised px-3 py-2 text-body-sm text-surface-900 dark:text-white min-w-[10rem] disabled:opacity-60"
          >
            <option value="all">All regions</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-sm text-surface-600 dark:text-surface-400">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
            className="rounded-md border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-raised px-3 py-2 text-body-sm text-surface-900 dark:text-white min-w-[10rem] disabled:opacity-60"
          >
            <option value="all">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-sm text-surface-600 dark:text-surface-400 min-w-[12rem] flex-1 max-w-md">
          Search
          <PersonTextFilterCombobox
            value={search}
            onChange={setSearch}
            options={peopleForSearchSuggestions.map((p) => ({
              id: p.personId,
              name: p.name,
            }))}
            placeholder="Search person..."
            disabled={loading}
            aria-label="Filter by person name"
            className="relative w-full"
          />
        </label>
        {view === "timeline" && selectedMonth != null ? (
          <label className="flex flex-col gap-1 text-label-sm text-surface-600 dark:text-surface-400">
            Month
            <select
              value={selectedKey}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-");
                setSelectedMonth({
                  year: Number(y),
                  monthIndex: Number(m),
                });
              }}
              disabled={loading}
              className="rounded-md border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-raised px-3 py-2 text-body-sm text-surface-900 dark:text-white min-w-[11rem] disabled:opacity-60"
            >
              {monthAnchors.map(({ year, monthIndex }) => (
                <option key={`${year}-${monthIndex}`} value={`${year}-${monthIndex}`}>
                  {monthLabel(year, monthIndex)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {loading ? (
        <p className="text-body-sm text-surface-500 dark:text-surface-400" aria-busy>
          Loading company PTO and holidays…
        </p>
      ) : null}

      {!loading && view === "overview" ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {monthAnchors.map(({ year, monthIndex }) => {
            const weekKeys = weeksOverlappingCalendarMonth(year, monthIndex);
            const outIds = uniquePeopleWithAbsenceInMonth(
              filteredPto,
              year,
              monthIndex,
              filteredIds
            );
            const n = outIds.size;
            const ptoIds = uniquePeopleWithPtoInMonth(
              filteredPto,
              year,
              monthIndex,
              filteredIds
            );
            const holidayIds = uniquePeopleWithHolidayInMonth(
              filteredPto,
              year,
              monthIndex,
              filteredIds,
              personFloatRegionById
            );
            const ptoCount = ptoIds.size;
            const holidayCount = holidayIds.size;
            const countsBothZero = ptoCount === 0 && holidayCount === 0;
            const weeklyCounts = weeklyOutCountsForMonth(
              filteredPto,
              weekKeys,
              year,
              monthIndex,
              filteredIds
            );
            const sparkFour = aggregateWeeklyCountsToFourBars(weeklyCounts);
            const peakWeekCount =
              weeklyCounts.length > 0 ? Math.max(...weeklyCounts) : 0;
            const previewIds = [...outIds].sort((a, b) => {
              const na = allPeople.find((p) => p.personId === a)?.name ?? "";
              const nb = allPeople.find((p) => p.personId === b)?.name ?? "";
              return na.localeCompare(nb);
            });
            const show = previewIds.slice(0, 6);
            const overflow = previewIds.length - show.length;
            const monthNameOnly = new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(
              "en-US",
              { month: "long", timeZone: "UTC" }
            );

            return (
              <button
                key={`${year}-${monthIndex}`}
                type="button"
                onClick={() => {
                  setSelectedMonth({ year, monthIndex });
                  setView("timeline");
                }}
                className={`text-left rounded-lg border bg-white dark:bg-dark-surface p-4 shadow-card-light dark:shadow-card-dark transition-all duration-200 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                  n === 0
                    ? "opacity-70 border-surface-200 dark:border-dark-border"
                    : "border-surface-200 dark:border-dark-border"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <span
                    className={`text-[13px] font-medium ${
                      n === 0
                        ? "text-surface-500 dark:text-surface-500"
                        : "text-surface-900 dark:text-white"
                    }`}
                  >
                    {monthLabel(year, monthIndex)}
                  </span>
                  {countsBothZero ? (
                    <span className="text-[11px] shrink-0 text-surface-500 dark:text-surface-500">
                      No absences
                    </span>
                  ) : (
                    <div className="flex flex-col items-end gap-0.5 text-[11px] shrink-0 text-surface-500 dark:text-surface-400">
                      <span>{ptoCount} on PTO</span>
                      <span>{holidayCount} holidays</span>
                    </div>
                  )}
                </div>
                <MonthSparkline countsFour={sparkFour} peakWeekCount={peakWeekCount} />
                <div className="mt-3 min-h-[28px]">
                  {n === 0 ? (
                    <span className="text-[12px] text-surface-500 dark:text-surface-500">
                      No absences
                    </span>
                  ) : (
                    <div className="group/month-avatar-tip relative flex flex-wrap items-center gap-1">
                      {show.map((pid) => {
                        const person = allPeople.find((p) => p.personId === pid);
                        const kind = personPreviewKindForMonth(
                          pid,
                          filteredPto,
                          year,
                          monthIndex
                        );
                        const amber = kind === "pto";
                        return (
                          <div
                            key={pid}
                            className={`h-[20px] w-[20px] shrink-0 rounded-full flex items-center justify-center text-[9px] font-semibold border ${
                              amber
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-600"
                                : "bg-jblue-50 dark:bg-jblue-950/50 text-jblue-900 dark:text-jblue-100 border-jblue-200 dark:border-jblue-700"
                            }`}
                          >
                            {person ? getInitials(person.name) : "?"}
                          </div>
                        );
                      })}
                      {overflow > 0 ? (
                        <div className="h-[20px] w-[20px] shrink-0 rounded-full flex items-center justify-center text-[9px] font-medium bg-surface-100 dark:bg-dark-raised text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-dark-border">
                          +{overflow}
                        </div>
                      ) : null}
                      <div
                        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-max max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded border border-surface-200 bg-white px-2.5 py-2 text-left shadow-md group-hover/month-avatar-tip:block dark:border-dark-border dark:bg-dark-surface"
                        role="tooltip"
                      >
                        <div className="text-xs font-medium text-surface-900 dark:text-white">
                          {n} {n === 1 ? "person" : "people"} out in {monthNameOnly}
                        </div>
                        {ptoIds.size > 0 || holidayIds.size > 0 ? (
                          <>
                            <div
                              className="my-2 border-t border-surface-200 dark:border-dark-border"
                              aria-hidden
                            />
                            {ptoIds.size > 0 ? (
                              <div className="mb-2 last:mb-0">
                                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-surface-500 dark:text-surface-400">
                                  <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-500/90"
                                    aria-hidden
                                  />
                                  On PTO
                                </div>
                                <ul className="space-y-0.5">
                                  {[...ptoIds]
                                    .map((id) => ({
                                      id,
                                      name:
                                        allPeople.find((p) => p.personId === id)?.name ?? id,
                                    }))
                                    .sort((a, b) =>
                                      a.name.localeCompare(b.name, undefined, {
                                        sensitivity: "base",
                                      })
                                    )
                                    .map(({ id, name }) => (
                                      <li
                                        key={`pto-${id}`}
                                        className="text-[12px] text-surface-900 dark:text-white"
                                      >
                                        {name}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            ) : null}
                            {holidayIds.size > 0 ? (
                              <div>
                                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-surface-500 dark:text-surface-400">
                                  <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-jblue-500 dark:bg-jblue-400"
                                    aria-hidden
                                  />
                                  Holidays
                                </div>
                                <ul className="space-y-0.5">
                                  {[...holidayIds]
                                    .map((id) => ({
                                      id,
                                      name:
                                        allPeople.find((p) => p.personId === id)?.name ?? id,
                                    }))
                                    .sort((a, b) =>
                                      a.name.localeCompare(b.name, undefined, {
                                        sensitivity: "base",
                                      })
                                    )
                                    .map(({ id, name }) => (
                                      <li
                                        key={`hol-${id}`}
                                        className="text-[12px] text-surface-900 dark:text-white"
                                      >
                                        {name}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && view === "timeline" && selectedMonth != null ? (
        <TimelineSection
          selectedMonth={selectedMonth}
          monthLabel={monthLabel}
          onBack={() => {
            setView("overview");
            setSelectedMonth(null);
          }}
          timelineMode={timelineMode}
          setTimelineMode={setTimelineMode}
          filteredPeople={filteredPeople}
          filteredPto={filteredPto}
          companyPayload={companyPayload}
        />
      ) : null}
    </div>
  );
}

function filterListWeekEntries(
  wk: string,
  companyPayload: DashboardPtoProjectPayload,
  year: number,
  monthIndex: number,
  filteredPeople: CompanyPerson[]
): WeekEntryRow[] {
  const ids = new Set(filteredPeople.map((p) => p.personId));
  return getWeekEntries([companyPayload], wk).filter((row) => {
    if (!ids.has(row.personId)) return false;
    if (row.pills.length === 0) return false;
    return row.pills.some((pill) => {
      const d = dateFromWeekAndDayLabel(wk, pill.dayLabel);
      return d.getUTCFullYear() === year && d.getUTCMonth() === monthIndex;
    });
  });
}

function TimelineSection({
  selectedMonth,
  monthLabel,
  onBack,
  timelineMode,
  setTimelineMode,
  filteredPeople,
  filteredPto,
  companyPayload,
}: {
  selectedMonth: { year: number; monthIndex: number };
  monthLabel: (y: number, m: number) => string;
  onBack: () => void;
  timelineMode: TimelineMode;
  setTimelineMode: (m: TimelineMode) => void;
  filteredPeople: CompanyPerson[];
  filteredPto: PtoHolidayByWeek;
  companyPayload: DashboardPtoProjectPayload;
}) {
  const { year, monthIndex } = selectedMonth;
  const label = monthLabel(year, monthIndex);
  const weekKeys = weeksOverlappingCalendarMonth(year, monthIndex);
  const sortedPeople = [...filteredPeople].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const listIsEmpty =
    timelineMode === "list" &&
    weekKeys.every(
      (wk) =>
        filterListWeekEntries(wk, companyPayload, year, monthIndex, filteredPeople)
          .length === 0
    );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="block text-body-sm font-medium text-jblue-600 dark:text-jblue-400 hover:underline"
      >
        ← All months
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label-sm text-surface-500 dark:text-surface-400 mr-2">View</span>
        <div className="inline-flex rounded-md border border-surface-200 dark:border-dark-border p-0.5 bg-surface-50 dark:bg-dark-raised">
          <button
            type="button"
            onClick={() => setTimelineMode("list")}
            className={`px-3 py-1.5 text-body-sm rounded ${
              timelineMode === "list"
                ? "bg-white dark:bg-dark-surface text-surface-900 dark:text-white shadow-sm font-medium"
                : "text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setTimelineMode("grid")}
            className={`px-3 py-1.5 text-body-sm rounded ${
              timelineMode === "grid"
                ? "bg-white dark:bg-dark-surface text-surface-900 dark:text-white shadow-sm font-medium"
                : "text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      <h3 className="text-title-lg font-semibold text-surface-900 dark:text-white">{label}</h3>

      {timelineMode === "grid" ? (
        <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-card-light dark:shadow-card-dark">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 min-w-[10rem] border-b border-r border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised px-3 py-2 align-bottom font-medium text-[12px] text-surface-800 dark:text-surface-100"
                >
                  Person
                </th>
                <th
                  colSpan={Math.max(1, weekKeys.length)}
                  className="border-b border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised px-2 py-2 text-center text-[12px] font-medium text-surface-800 dark:text-surface-100"
                >
                  {label}
                </th>
              </tr>
              <tr className="bg-surface-50 dark:bg-dark-raised">
                {weekKeys.map((wk) => (
                  <th
                    key={wk}
                    className="border-b border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised px-2 py-1.5 text-center text-[11px] text-surface-500 dark:text-surface-400 whitespace-nowrap min-w-[3.5rem]"
                  >
                    {formatWeekShort(new Date(wk + "T00:00:00.000Z"))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPeople.map((person) => (
                <tr key={person.personId}>
                  <td className="sticky left-0 z-10 border-b border-r border-surface-100 dark:border-dark-border bg-surface-50 dark:bg-dark-raised px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-[22px] w-[22px] shrink-0 rounded-full bg-surface-100 dark:bg-dark-muted text-surface-800 dark:text-surface-200 flex items-center justify-center text-[10px] font-semibold border border-surface-200 dark:border-dark-border"
                        aria-hidden
                      >
                        {getInitials(person.name)}
                      </div>
                      <span className="truncate text-[12px] text-surface-900 dark:text-white">
                        {person.name}
                      </span>
                    </div>
                  </td>
                  {weekKeys.map((wk) => {
                    const kind = summarizeWeekForPerson(person.personId, wk, filteredPto);
                    const base =
                      "border border-surface-200 dark:border-dark-border px-1 py-2 text-center align-middle";
                    const pill =
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium";
                    if (kind === "empty") {
                      return (
                        <td key={wk} className={`${base} bg-white dark:bg-dark-surface`} />
                      );
                    }
                    if (kind === "holiday") {
                      return (
                        <td key={wk} className={`${base} bg-jblue-50 dark:bg-jblue-950/40`}>
                          <span className={`${pill} text-jblue-800 dark:text-jblue-100`}>Holiday</span>
                        </td>
                      );
                    }
                    if (kind === "both") {
                      return (
                        <td
                          key={wk}
                          className={`${base} bg-amber-50 dark:bg-amber-950/30 border-t-2 border-t-jblue-500`}
                        >
                          <span className={`${pill} text-amber-900 dark:text-amber-100`}>PTO</span>
                        </td>
                      );
                    }
                    if (kind === "pto_partial") {
                      return (
                        <td
                          key={wk}
                          className={`${base} bg-amber-100/90 dark:bg-amber-900/30`}
                        >
                          <span className={`${pill} text-amber-900 dark:text-amber-200`}>½ day</span>
                        </td>
                      );
                    }
                    if (kind === "pto_mixed") {
                      return (
                        <td
                          key={wk}
                          className={`${base} bg-amber-100/90 dark:bg-amber-900/30`}
                        >
                          <span className={`${pill} text-amber-900 dark:text-amber-100`}>PTO</span>
                        </td>
                      );
                    }
                    return (
                      <td key={wk} className={`${base} bg-amber-50 dark:bg-amber-950/25`}>
                        <span className={`${pill} text-amber-900 dark:text-amber-100`}>PTO</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {weekKeys.map((wk) => {
            const entries = filterListWeekEntries(
              wk,
              companyPayload,
              year,
              monthIndex,
              filteredPeople
            );

            if (entries.length === 0) return null;

            return (
              <div key={wk} className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-surface-500 dark:text-surface-400 shrink-0">
                    Week of — {formatShortMonDayFromWeekKey(wk)}
                  </span>
                  <div
                    className="flex-1 h-px bg-surface-200 dark:bg-dark-border min-w-[1rem]"
                    aria-hidden
                  />
                </div>
                <ul>
                  {entries.map((row) => (
                    <li
                      key={row.personId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 border-b border-surface-100 dark:border-dark-border last:border-b-0"
                    >
                      <ListRowFromWeekEntry row={row} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {listIsEmpty ? (
        <p className="text-body-sm text-surface-500 dark:text-surface-400">
          No PTO or holidays in this month for the current filters.
        </p>
      ) : null}
    </div>
  );
}
