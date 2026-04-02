/**
 * Merge Float time off + regional public/team holidays into per-person UTC calendar-day
 * exclusions for {@link aggregateTasksToWeeklyHours}.
 *
 * @see https://developer.float.com/tutorial_exporting_the_schedule_data.html — `/v3/timeoffs` filters
 * @see https://developer.float.com/api_reference.html — Public Holidays, Team Holidays
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseFloatApiDate(s: string | null | undefined): Date | null {
  if (s == null || String(s).trim() === "") return null;
  const t = String(s).trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function ymdFromUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Inclusive UTC YYYY-MM-DD dates between start and end (Float-style inclusive ranges).
 */
export function expandInclusiveUtcRangeToYmds(startYmd: string, endYmd: string): string[] {
  const start = parseFloatApiDate(startYmd);
  const end = parseFloatApiDate(endYmd);
  if (!start || !end) return [];
  const d0 = utcDateOnly(start);
  const d1 = utcDateOnly(end);
  if (d0.getTime() > d1.getTime()) return [];
  const out: string[] = [];
  for (let t = d0.getTime(); t <= d1.getTime(); t += MS_PER_DAY) {
    out.push(ymdFromUtcDate(new Date(t)));
  }
  return out;
}

function getRowString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

/** Best-effort holiday date range from Float public/team holiday objects. */
export function holidayRangeYmdFromRow(row: Record<string, unknown>): {
  start: string;
  end: string;
} | null {
  const start = getRowString(row, "start_date", "startDate");
  const end = getRowString(row, "end_date", "endDate");
  if (start && end) return { start, end };
  const single = getRowString(row, "date", "holiday_date", "holidayDate");
  if (single) return { start: single, end: single };
  return null;
}

export function regionIdFromHolidayRow(row: Record<string, unknown>): number | null {
  return (
    num(row.region_id as number | string | undefined) ??
    num(row.regionId as number | string | undefined) ??
    num(row.region as number | string | undefined)
  );
}

/**
 * Keep holiday rows whose calendar span overlaps [startYmd, endYmd] (inclusive, UTC YYYY-MM-DD).
 * Used for `/v3/holidays` (team holidays), which list all holidays without date filters in the API spec.
 */
export function filterHolidayRowsOverlappingYmdWindow(
  rows: Array<Record<string, unknown>>,
  startYmd: string,
  endYmd: string
): Array<Record<string, unknown>> {
  return rows.filter((row) => {
    const range = holidayRangeYmdFromRow(row);
    if (!range) return false;
    return range.start <= endYmd && range.end >= startYmd;
  });
}

export type FloatTimeOffJson = {
  people_id?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type BuildExcludedDaysParams = {
  /** Raw `/v3/people` rows (needs `people_id`, optional `region_id`). */
  floatPeople: Array<Record<string, unknown>>;
  timeOffs: FloatTimeOffJson[];
  publicHolidays: Array<Record<string, unknown>>;
  teamHolidays: Array<Record<string, unknown>>;
};

function ensureSet(
  map: Map<number, Set<string>>,
  peopleId: number
): Set<string> {
  let s = map.get(peopleId);
  if (!s) {
    s = new Set();
    map.set(peopleId, s);
  }
  return s;
}

/**
 * Per Float `people_id`, UTC `YYYY-MM-DD` dates to treat as non-working when rolling up task hours.
 * - Time off: always per person.
 * - Public/team holidays: only for people whose `region_id` matches the holiday's region.
 * - People with no Float region do not receive regional holidays (time off still applies).
 */
export function buildExcludedUtcDatesByFloatPeopleId(
  params: BuildExcludedDaysParams
): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();

  const peopleRegion = new Map<number, number | null>();
  for (const p of params.floatPeople) {
    const pid = num(p.people_id as number | string | undefined);
    if (pid == null) continue;
    peopleRegion.set(pid, num(p.region_id as number | string | undefined));
  }

  for (const t of params.timeOffs) {
    const pid = num(t.people_id);
    if (pid == null) continue;
    const sd = t.start_date?.trim();
    const ed = t.end_date?.trim();
    if (!sd || !ed) continue;
    const days = expandInclusiveUtcRangeToYmds(sd, ed);
    const set = ensureSet(map, pid);
    for (const ymd of days) set.add(ymd);
  }

  const applyRegional = (rows: Array<Record<string, unknown>>) => {
    for (const row of rows) {
      const region = regionIdFromHolidayRow(row);
      if (region == null) continue;
      const range = holidayRangeYmdFromRow(row);
      if (!range) continue;
      const days = expandInclusiveUtcRangeToYmds(range.start, range.end);
      if (days.length === 0) continue;
      for (const [pid, pr] of peopleRegion) {
        if (pr === region) {
          const set = ensureSet(map, pid);
          for (const ymd of days) set.add(ymd);
        }
      }
    }
  };

  applyRegional(params.publicHolidays);
  applyRegional(params.teamHolidays);

  return map;
}
