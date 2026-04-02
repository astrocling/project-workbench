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

/**
 * Normalize Float date fields (YYYY-MM-DD, ISO datetime, Unix ms/seconds, {@link Date}) to UTC YYYY-MM-DD.
 */
function coerceValueToUtcYmd(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = v > 1e12 ? v : v * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

function firstYmdFromRow(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    if (!(k in row)) continue;
    const y = coerceValueToUtcYmd(row[k]);
    if (y) return y;
  }
  return null;
}

/** Prefer specific keys before generic `date` (see {@link holidayRangeYmdFromRow}). */
const FLOAT_RANGE_START_KEYS = [
  "start_date",
  "startDate",
  "starts_at",
  "startsAt",
  "start",
  "from_date",
  "fromDate",
  "from",
  "date_start",
  "dateStart",
  "observed_date",
  "observedDate",
  "on_date",
  "onDate",
  "date",
  "holiday_date",
  "holidayDate",
];
const FLOAT_RANGE_END_KEYS = [
  "end_date",
  "endDate",
  "ends_at",
  "endsAt",
  "end",
  "to_date",
  "toDate",
  "to",
  "date_end",
  "dateEnd",
];

/** Best-effort holiday / time-off date range from Float API rows (public-holidays, holidays, timeoffs). */
export function holidayRangeYmdFromRow(row: Record<string, unknown>): {
  start: string;
  end: string;
} | null {
  const start = firstYmdFromRow(row, FLOAT_RANGE_START_KEYS);
  const end = firstYmdFromRow(row, FLOAT_RANGE_END_KEYS);
  if (start && end) return { start, end };
  if (start && !end) return { start, end: start };
  if (!start && end) return { start: end, end };
  return null;
}

function utcYmdFromDatesArrayElement(el: unknown): string | null {
  const direct = coerceValueToUtcYmd(el);
  if (direct) return direct;
  if (el && typeof el === "object" && !Array.isArray(el)) {
    return firstYmdFromRow(el as Record<string, unknown>, FLOAT_RANGE_START_KEYS);
  }
  return null;
}

/**
 * Float `/v3/public-holidays` rows often use a top-level `dates` array (not `start_date` / `end_date`).
 * Elements may be ISO strings or nested objects with date fields.
 */
function discreteUtcYmdsFromHolidayDatesField(row: Record<string, unknown>): string[] | null {
  const d = row.dates;
  if (!Array.isArray(d) || d.length === 0) return null;
  const out: string[] = [];
  for (const el of d) {
    const y = utcYmdFromDatesArrayElement(el);
    if (y) out.push(y);
  }
  return out.length > 0 ? out : null;
}

/**
 * All UTC calendar days for a holiday row (for admin display): either the `dates` array or an
 * inclusive range from {@link holidayRangeYmdFromRow}, sorted ascending, deduped.
 */
export function allUtcYmdsFromHolidayRow(row: Record<string, unknown>): string[] {
  const discrete = discreteUtcYmdsFromHolidayDatesField(row);
  if (discrete != null) {
    return [...new Set(discrete)].sort();
  }
  const range = holidayRangeYmdFromRow(row);
  if (!range) return [];
  return expandInclusiveUtcRangeToYmds(range.start, range.end);
}

/** True if a public/team holiday row overlaps [startYmd, endYmd] (inclusive UTC dates). */
export function holidayRowOverlapsYmdWindow(
  row: Record<string, unknown>,
  startYmd: string,
  endYmd: string
): boolean {
  const discrete = discreteUtcYmdsFromHolidayDatesField(row);
  if (discrete != null) {
    return discrete.some((ymd) => ymd >= startYmd && ymd <= endYmd);
  }
  const range = holidayRangeYmdFromRow(row);
  if (!range) return false;
  return range.start <= endYmd && range.end >= startYmd;
}

/**
 * Region id from Float API rows where shape varies by endpoint (`/v3/people`, `/v3/public-holidays`,
 * `/v3/holidays`): top-level `region_id` / `regionId`, or `region` as number, string, or nested
 * `{ id | region_id, name, ... }`.
 */
function regionIdFromFloatRegionFields(row: Record<string, unknown>): number | null {
  const top =
    num(row.region_id as number | string | undefined) ??
    num(row.regionId as number | string | undefined);
  if (top != null) return top;
  const r = row.region;
  if (typeof r === "number") return num(r);
  if (typeof r === "string") {
    const n = num(r);
    if (n != null) return n;
  }
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const o = r as Record<string, unknown>;
    return (
      num(o.region_id as number | string | undefined) ??
      num(o.regionId as number | string | undefined) ??
      num(o.id as number | string | undefined)
    );
  }
  return null;
}

export function regionIdFromHolidayRow(row: Record<string, unknown>): number | null {
  return regionIdFromFloatRegionFields(row);
}

/**
 * Float `/v3/people` region id: often `region_id`, but some responses only nest under `region`
 * (`{ id | region_id, name, ... }`) or use a numeric `region` field.
 */
export function regionIdFromPersonRow(row: Record<string, unknown>): number | null {
  return regionIdFromFloatRegionFields(row);
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
  return rows.filter((row) => holidayRowOverlapsYmdWindow(row, startYmd, endYmd));
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
    peopleRegion.set(pid, regionIdFromPersonRow(p));
  }

  for (const t of params.timeOffs) {
    const pid = num(t.people_id);
    if (pid == null) continue;
    const range = holidayRangeYmdFromRow(t as Record<string, unknown>);
    if (!range) continue;
    const days = expandInclusiveUtcRangeToYmds(range.start, range.end);
    const set = ensureSet(map, pid);
    for (const ymd of days) set.add(ymd);
  }

  const applyRegional = (rows: Array<Record<string, unknown>>) => {
    for (const row of rows) {
      const region = regionIdFromHolidayRow(row);
      if (region == null) continue;
      const fromDates = discreteUtcYmdsFromHolidayDatesField(row);
      let days: string[];
      if (fromDates != null) {
        days = fromDates;
      } else {
        const range = holidayRangeYmdFromRow(row);
        if (!range) continue;
        days = expandInclusiveUtcRangeToYmds(range.start, range.end);
      }
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
