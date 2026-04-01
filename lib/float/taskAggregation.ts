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
  task_id?: number;
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
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function toPeopleIds(task: FloatTaskJson): number[] {
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

/** Composite key for Map lookups: project|person|weekStartKey */
export function weeklyHoursCompositeKey(
  floatProjectId: number,
  floatPeopleId: number,
  weekStartKey: string
): string {
  return `${floatProjectId}|${floatPeopleId}|${weekStartKey}`;
}

/**
 * Sum hours per (Float project id, Float people id, Monday week key).
 * Days are UTC calendar days; week buckets use {@link getWeekStartDate} / {@link formatWeekKey}.
 */
export function aggregateTasksToWeeklyHours(
  tasks: FloatTaskJson[],
  options?: AggregateTasksToWeeklyHoursOptions
): Map<string, number> {
  const window = options?.window;
  const winStart = window ? utcDateOnly(window.start) : null;
  const winEnd = window ? utcDateOnly(window.end) : null;

  const map = new Map<string, number>();

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
      if (winStart && winEnd) {
        if (day.getTime() < winStart.getTime() || day.getTime() > winEnd.getTime()) {
          continue;
        }
      }
      const weekStart = getWeekStartDate(day);
      const weekKey = formatWeekKey(weekStart);
      for (const pid of peopleIds) {
        const key = weeklyHoursCompositeKey(projectId, pid, weekKey);
        map.set(key, (map.get(key) ?? 0) + hoursPerDay);
      }
    }
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
