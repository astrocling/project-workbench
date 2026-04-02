/**
 * Aggregate Float `/v3/tasks` JSON into weekly hours keyed by Monday (UTC), matching
 * {@link formatWeekKey} / {@link getWeekStartDate} in `lib/weekUtils.ts` — same week keys as
 * `lib/float/syncFloatImport.ts` and historical CSV imports (`toUTCMonday` + `formatWeekKey` on week starts).
 *
 * ## Float semantics (official docs)
 * - `hours` is **hours per day** (not total for the range). See Float “Scheduling your team” tutorial.
 * - `start_date` / `end_date` are **YYYY-MM-DD**; allocation applies to **each calendar day** in the
 *   inclusive range (UTC date parts). Filter queries are inclusive of tasks overlapping the window.
 * - We intersect task days with an optional **aggregation window** and sum into Monday-based weeks.
 * - Optional **weekdays only** (UTC Mon–Fri): when enabled, Saturday/Sunday calendar days do not
 *   contribute to weekly totals — aligns planned grid (business days) with Float rollups.
 * - Optional **per-person excluded UTC days** (e.g. Float time off + regional holidays): those
 *   calendar days do not contribute for that Float `people_id`, after weekday/window checks.
 * - When **multiple tasks** cover the same UTC calendar day for the same project and person, we take
 *   the **maximum** `hours` that day (not the sum). Float’s schedule shows one stacked bar per day;
 *   summing would double-count overlapping rows returned by the API.
 *
 * ## Prisma matching
 * - `Person.externalId` stores Float `people_id` (existing).
 * - `Project.floatExternalId` stores Float `project_id` as string for stable sync matching (optional).
 *
 * ## Multi-person tasks
 * - If `people_ids` is present and non-empty, the same per-day hours are attributed to **each** id
 *   (Float evaluates filters across `people_id` and `people_ids`). Otherwise `people_id` is used.
 */

import { formatWeekKey, getWeekStartDate } from "@/lib/weekUtils";

/** Raw task shape from `GET /v3/tasks` (fields may be strings or numbers per Float examples). */
export type FloatTaskJson = {
  /** Present on normal tasks; list responses may repeat the same id (dedupe before aggregating). */
  task_id?: number | string;
  project_id?: number | string;
  people_id?: number | string | null;
  /** When set, hours apply to each listed person (see module doc). */
  people_ids?: Array<number | string>;
  start_date?: string | null;
  end_date?: string | null;
  hours?: number | string | null;
};

export type AggregateTasksWindow = {
  /** Inclusive UTC calendar start */
  start: Date;
  /** Inclusive UTC calendar end */
  end: Date;
};

export type WeeklyHoursRow = {
  floatProjectId: number;
  floatPeopleId: number;
  weekStartKey: string;
  hours: number;
};

export type AggregateTasksToWeeklyHoursOptions = {
  window?: AggregateTasksWindow;
  /**
   * When true, only UTC Mon–Fri count toward weekly sums; Sat/Sun are excluded.
   * Float `start_date`/`end_date` are still interpreted as UTC calendar days; weekend days are skipped.
   */
  weekdaysOnly?: boolean;
  /**
   * Per Float `people_id`, UTC `YYYY-MM-DD` days to skip (time off + regional holidays).
   * Checked after {@link weekdaysOnly} and window clipping.
   */
  excludedUtcDatesByFloatPeopleId?: Map<number, Set<string>>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC Monday–Friday (excludes Sat/Sun). */
export function isUtcWeekday(d: Date): boolean {
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

function utcDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
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

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

export function toPeopleIds(task: FloatTaskJson): number[] {
  const fromArray = task.people_ids?.filter(
    (x) => x != null && String(x).trim() !== ""
  );
  if (fromArray?.length) {
    return fromArray.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  }
  const one = task.people_id;
  if (one == null || String(one).trim() === "") return [];
  const n = Number(one);
  return Number.isFinite(n) ? [n] : [];
}

function toProjectId(task: FloatTaskJson): number | null {
  const p = task.project_id;
  if (p == null) return null;
  const n = Number(p);
  return Number.isFinite(n) ? n : null;
}

function taskIdNumber(task: FloatTaskJson): number | null {
  const v = task.task_id;
  if (v == null || String(v).trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Float `/v3/tasks` list responses can include the same `task_id` more than once (e.g. pagination
 * overlap). Aggregating without deduping adds per-day hours multiple times for those rows.
 * Last occurrence wins (typically the newest payload segment).
 */
export function dedupeFloatTasksForAggregation(tasks: FloatTaskJson[]): FloatTaskJson[] {
  const byId = new Map<number, FloatTaskJson>();
  const withoutId: FloatTaskJson[] = [];
  for (const task of tasks) {
    const id = taskIdNumber(task);
    if (id == null) {
      withoutId.push(task);
      continue;
    }
    byId.set(id, task);
  }
  return [...withoutId, ...byId.values()];
}

/** Composite key for Map lookups: project|person|weekStartKey */
export function weeklyHoursCompositeKey(
  floatProjectId: number,
  floatPeopleId: number,
  weekStartKey: string
): string {
  return `${floatProjectId}|${floatPeopleId}|${weekStartKey}`;
}

/** UTC calendar day key for deduping overlapping tasks: project|person|YYYY-MM-DD */
function dailyHoursCompositeKey(
  floatProjectId: number,
  floatPeopleId: number,
  utcDay: Date
): string {
  const u = utcDateOnly(utcDay);
  const ymd = u.toISOString().slice(0, 10);
  return `${floatProjectId}|${floatPeopleId}|${ymd}`;
}

/**
 * Sum hours per (Float project id, Float people id, Monday week key).
 * Days are UTC calendar days; week buckets use {@link getWeekStartDate} / {@link formatWeekKey}.
 * Overlapping tasks on the same day use {@link Math.max} for that day's hours before summing into weeks.
 * With {@link AggregateTasksToWeeklyHoursOptions.weekdaysOnly}, only Mon–Fri UTC days contribute.
 */
export function aggregateTasksToWeeklyHours(
  tasks: FloatTaskJson[],
  options?: AggregateTasksToWeeklyHoursOptions
): Map<string, number> {
  const weekdaysOnly = options?.weekdaysOnly === true;
  const excludedByPerson = options?.excludedUtcDatesByFloatPeopleId;
  const window = options?.window;
  const winStart = window ? utcDateOnly(window.start) : null;
  const winEnd = window ? utcDateOnly(window.end) : null;

  const hoursPerUtcDay = new Map<string, number>();

  for (const task of tasks) {
    const projectId = toProjectId(task);
    if (projectId == null) continue;

    const peopleIds = toPeopleIds(task);
    if (peopleIds.length === 0) continue;

    const hoursPerDay = toNum(task.hours);
    if (hoursPerDay == null || hoursPerDay === 0) continue;

    const start = parseFloatApiDate(task.start_date ?? undefined);
    const end = parseFloatApiDate(task.end_date ?? undefined);
    if (!start || !end) continue;

    let d0 = utcDateOnly(start);
    const d1 = utcDateOnly(end);
    if (d0.getTime() > d1.getTime()) continue;

    if (winStart && winEnd) {
      if (d1.getTime() < winStart.getTime() || d0.getTime() > winEnd.getTime()) {
        continue;
      }
      if (d0.getTime() < winStart.getTime()) d0 = new Date(winStart);
    }

    const last =
      winEnd != null
        ? new Date(Math.min(d1.getTime(), winEnd.getTime()))
        : new Date(d1.getTime());

    for (
      let t = d0.getTime();
      t <= last.getTime();
      t += MS_PER_DAY
    ) {
      const day = new Date(t);
      if (weekdaysOnly && !isUtcWeekday(day)) {
        continue;
      }
      if (winStart && winEnd) {
        if (day.getTime() < winStart.getTime() || day.getTime() > winEnd.getTime()) {
          continue;
        }
      }
      const ymd = utcDateOnly(day).toISOString().slice(0, 10);
      for (const pid of peopleIds) {
        if (excludedByPerson?.get(pid)?.has(ymd)) {
          continue;
        }
        const dk = dailyHoursCompositeKey(projectId, pid, day);
        const prev = hoursPerUtcDay.get(dk) ?? 0;
        hoursPerUtcDay.set(dk, Math.max(prev, hoursPerDay));
      }
    }
  }

  const map = new Map<string, number>();
  for (const [dayKey, hours] of hoursPerUtcDay) {
    const parts = dayKey.split("|");
    const pj = Number(parts[0]);
    const pe = Number(parts[1]);
    const ymd = parts[2];
    if (!Number.isFinite(pj) || !Number.isFinite(pe) || !ymd) continue;
    const dayDate = parseFloatApiDate(ymd);
    if (!dayDate) continue;
    const weekStart = getWeekStartDate(dayDate);
    const weekKey = formatWeekKey(weekStart);
    const wk = weeklyHoursCompositeKey(pj, pe, weekKey);
    map.set(wk, (map.get(wk) ?? 0) + hours);
  }

  return map;
}

/** Flatten the map to sorted rows for storage or display. */
export function weeklyHoursMapToRows(map: Map<string, number>): WeeklyHoursRow[] {
  const rows: WeeklyHoursRow[] = [];
  for (const [key, hours] of map) {
    const parts = key.split("|");
    const pj = Number(parts[0]);
    const pe = Number(parts[1]);
    const weekStartKey = parts.slice(2).join("|");
    if (!Number.isFinite(pj) || !Number.isFinite(pe)) continue;
    rows.push({
      floatProjectId: pj,
      floatPeopleId: pe,
      weekStartKey,
      hours,
    });
  }
  rows.sort(
    (a, b) =>
      a.floatProjectId - b.floatProjectId ||
      a.floatPeopleId - b.floatPeopleId ||
      a.weekStartKey.localeCompare(b.weekStartKey)
  );
  return rows;
}
