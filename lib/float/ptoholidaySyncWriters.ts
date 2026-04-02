/**
 * Persists Float `/v3/timeoffs` and regional holidays into `PTOHolidayImpact` (day-level).
 * Uses chunked raw SQL upserts (same pattern as FloatScheduledHours in floatImportApply).
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  allUtcYmdsFromHolidayRow,
  expandInclusiveUtcRangeToYmds,
  holidayRangeYmdFromRow,
  regionIdFromHolidayRow,
  type FloatTimeOffJson,
} from "@/lib/float/excludedDays";
import { getWeekStartDate } from "@/lib/weekUtils";

/** Aligned with `FLOAT_HOURS_BATCH_SIZE` in floatImportApply (chunked raw SQL). */
const PTO_HOLIDAY_BATCH_SIZE = 500;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseYmdUtc(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, mo - 1, d));
}

/** Monday 00:00 UTC for the week containing this YYYY-MM-DD (UTC). */
export function weekStartMondayFromYmd(ymd: string): Date {
  return getWeekStartDate(parseYmdUtc(ymd));
}

function isUtcWeekdayYmd(ymd: string): boolean {
  const d = parseYmdUtc(ymd);
  const w = d.getUTCDay();
  return w !== 0 && w !== 6;
}

/** Business days (Mon–Fri UTC) between start and end inclusive. */
export function expandUtcWeekdaysInclusive(startYmd: string, endYmd: string): string[] {
  const all = expandInclusiveUtcRangeToYmds(startYmd, endYmd);
  return all.filter(isUtcWeekdayYmd);
}

function timeoffRowApproved(row: Record<string, unknown>): boolean {
  const s = row.status ?? row.time_off_status ?? row.approval_status;
  if (typeof s === "string") return s.trim().toLowerCase() === "approved";
  return false;
}

function timeoffIdString(row: Record<string, unknown>): string | null {
  const id =
    num(row.timeoff_id) ??
    num(row.timeoffId) ??
    num(row.id) ??
    num(row.time_off_id);
  return id != null ? String(id) : null;
}

function hoursPerDayFromTimeoff(row: Record<string, unknown>): number | null {
  return (
    num(row.hours_per_day) ??
    num(row.hoursPerDay) ??
    num(row.daily_hours) ??
    num(row.hours)
  );
}

function leaveTypeLabelFromTimeoff(row: Record<string, unknown>): string | null {
  const tot = row.time_off_type ?? row.timeOffType ?? row.leave_type;
  if (tot && typeof tot === "object" && !Array.isArray(tot)) {
    const name = (tot as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  const direct =
    typeof row.time_off_type_name === "string"
      ? row.time_off_type_name
      : typeof row.leave_type_name === "string"
        ? row.leave_type_name
        : null;
  return direct?.trim() || null;
}

type PtoHolidayUpsertRow = {
  personId: string;
  date: Date;
  weekStartDate: Date;
  type: "PTO" | "Holiday";
  hours: number | null;
  label: string | null;
  floatRegionId: number | null;
  floatSourceId: string | null;
};

function mergeKeyPto(personId: string, ymd: string): string {
  return `${personId}|${ymd}|PTO`;
}

/**
 * Writer A — approved time-offs → one aggregated row per person per weekday (summed hours).
 */
export function buildPtoRowsFromFloatTimeoffs(
  timeOffs: FloatTimeOffJson[],
  personIdByFloatPeopleId: Map<string, string>
): { rows: PtoHolidayUpsertRow[]; approvedFloatSourceIds: Set<string> } {
  const approvedFloatSourceIds = new Set<string>();
  const agg = new Map<
    string,
    { hours: number; labels: string[]; floatSourceId: string }
  >();

  for (const t of timeOffs) {
    const row = t as Record<string, unknown>;
    if (!timeoffRowApproved(row)) continue;
    const tid = timeoffIdString(row);
    if (!tid) continue;
    approvedFloatSourceIds.add(tid);
    const fid = num(row.people_id);
    if (fid == null) continue;
    const personId = personIdByFloatPeopleId.get(String(fid));
    if (!personId) continue;

    const range = holidayRangeYmdFromRow(row);
    if (!range) continue;
    const hpd = hoursPerDayFromTimeoff(row);
    const label = leaveTypeLabelFromTimeoff(row);
    const days = expandUtcWeekdaysInclusive(range.start, range.end);
    for (const ymd of days) {
      const key = mergeKeyPto(personId, ymd);
      const prev = agg.get(key);
      const addH = hpd ?? 0;
      if (prev) {
        prev.hours += addH;
        if (label && !prev.labels.includes(label)) prev.labels.push(label);
        // Keep first Float id for the row (still in approvedFloatSourceIds)
      } else {
        agg.set(key, {
          hours: addH,
          labels: label ? [label] : [],
          floatSourceId: tid ?? "",
        });
      }
    }
  }

  const rows: PtoHolidayUpsertRow[] = [];
  for (const [key, v] of agg) {
    const parts = key.split("|");
    if (parts.length !== 3) continue;
    const personId = parts[0]!;
    const ymd = parts[1]!;
    const date = parseYmdUtc(ymd);
    const weekStartDate = weekStartMondayFromYmd(ymd);
    rows.push({
      personId,
      date,
      weekStartDate,
      type: "PTO",
      hours: v.hours > 0 ? v.hours : null,
      label: v.labels.length ? v.labels.join(", ") : null,
      floatRegionId: null,
      floatSourceId: v.floatSourceId || null,
    });
  }
  return { rows, approvedFloatSourceIds };
}

function holidayRowIdString(row: Record<string, unknown>): string | null {
  const id =
    num(row.holiday_id) ??
    num(row.holidayId) ??
    num(row.public_holiday_id) ??
    num(row.id);
  return id != null ? String(id) : null;
}

function holidayNameFromRow(row: Record<string, unknown>): string | null {
  const n = row.name ?? row.holiday_name ?? row.title;
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

/**
 * Writer B — public + team holidays → one row per matching person per calendar day in the sync window.
 */
export function buildHolidayRowsFromFloatHolidays(
  publicHolidays: Array<Record<string, unknown>>,
  teamHolidays: Array<Record<string, unknown>>,
  startYmd: string,
  endYmd: string,
  personIdsByFloatRegionId: Map<number, string[]>
): { rows: PtoHolidayUpsertRow[]; holidayFloatSourceIds: Set<string> } {
  const holidayFloatSourceIds = new Set<string>();
  /** One row per (personId, date) for Holiday; merge labels if the same day has multiple holiday rows. */
  const byPersonDay = new Map<string, PtoHolidayUpsertRow>();

  const handleRow = (row: Record<string, unknown>) => {
    const region = regionIdFromHolidayRow(row);
    if (region == null) return;
    const hid = holidayRowIdString(row);
    if (!hid) return;
    holidayFloatSourceIds.add(hid);
    const people = personIdsByFloatRegionId.get(region);
    if (!people?.length) return;
    const label = holidayNameFromRow(row);
    const ymds = allUtcYmdsFromHolidayRow(row).filter(
      (ymd) => ymd >= startYmd && ymd <= endYmd
    );
    for (const ymd of ymds) {
      const date = parseYmdUtc(ymd);
      const weekStartDate = weekStartMondayFromYmd(ymd);
      for (const personId of people) {
        const mapKey = `${personId}|${ymd}`;
        const prev = byPersonDay.get(mapKey);
        if (!prev) {
          byPersonDay.set(mapKey, {
            personId,
            date,
            weekStartDate,
            type: "Holiday",
            hours: null,
            label,
            floatRegionId: region,
            floatSourceId: hid,
          });
        } else {
          if (label && prev.label && label !== prev.label) {
            prev.label = `${prev.label} / ${label}`;
          } else if (label && !prev.label) {
            prev.label = label;
          }
          prev.floatSourceId = hid ?? prev.floatSourceId;
        }
      }
    }
  };

  for (const row of publicHolidays) handleRow(row);
  for (const row of teamHolidays) handleRow(row);

  return { rows: Array.from(byPersonDay.values()), holidayFloatSourceIds };
}

function typeEnumSql(kind: "PTO" | "Holiday"): Prisma.Sql {
  return kind === "PTO"
    ? Prisma.sql`CAST('PTO' AS "PTOHolidayType")`
    : Prisma.sql`CAST('Holiday' AS "PTOHolidayType")`;
}

export async function upsertPtoHolidayImpactChunked(
  prisma: PrismaClient,
  rows: PtoHolidayUpsertRow[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += PTO_HOLIDAY_BATCH_SIZE) {
    const chunk = rows.slice(i, i + PTO_HOLIDAY_BATCH_SIZE);
    if (chunk.length === 0) continue;
    await prisma.$executeRaw`
      INSERT INTO "PTOHolidayImpact" (
        "personId", "date", "weekStartDate", "type", "hours", "label", "floatRegionId", "floatSourceId", "createdAt", "updatedAt"
      )
      VALUES ${Prisma.join(
        chunk.map((r) =>
          Prisma.sql`(
            ${r.personId},
            ${r.date}::date,
            ${r.weekStartDate}::date,
            ${typeEnumSql(r.type)},
            ${r.hours},
            ${r.label},
            ${r.floatRegionId},
            ${r.floatSourceId},
            now(),
            now()
          )`
        )
      )}
      ON CONFLICT ("personId", "date", "type") DO UPDATE SET
        "hours" = EXCLUDED."hours",
        "label" = EXCLUDED."label",
        "weekStartDate" = EXCLUDED."weekStartDate",
        "floatRegionId" = EXCLUDED."floatRegionId",
        "floatSourceId" = EXCLUDED."floatSourceId",
        "updatedAt" = now()
    `;
  }
}

export type PtoHolidaySyncPayload = {
  startYmd: string;
  endYmd: string;
  timeOffs: FloatTimeOffJson[];
  publicHolidays: Array<Record<string, unknown>>;
  teamHolidays: Array<Record<string, unknown>>;
};

/**
 * Loads Person rows with externalId, runs PTO + holiday writers, then window cleanups.
 */
export async function applyPtoHolidaySyncWriters(
  prisma: PrismaClient,
  payload: PtoHolidaySyncPayload
): Promise<void> {
  const { startYmd, endYmd, timeOffs, publicHolidays, teamHolidays } = payload;

  const people = await prisma.person.findMany({
    where: { externalId: { not: null } },
    select: { id: true, externalId: true, floatRegionId: true },
  });

  const personIdByFloatPeopleId = new Map<string, string>();
  const personIdsByFloatRegionId = new Map<number, string[]>();
  for (const p of people) {
    if (!p.externalId) continue;
    personIdByFloatPeopleId.set(p.externalId, p.id);
    if (p.floatRegionId != null) {
      const arr = personIdsByFloatRegionId.get(p.floatRegionId) ?? [];
      arr.push(p.id);
      personIdsByFloatRegionId.set(p.floatRegionId, arr);
    }
  }

  const winStart = getWeekStartDate(parseYmdUtc(startYmd));
  const winEnd = getWeekStartDate(parseYmdUtc(endYmd));

  const { rows: ptoRows, approvedFloatSourceIds } = buildPtoRowsFromFloatTimeoffs(
    timeOffs,
    personIdByFloatPeopleId
  );
  await upsertPtoHolidayImpactChunked(prisma, ptoRows);

  const { rows: holidayRows, holidayFloatSourceIds } = buildHolidayRowsFromFloatHolidays(
    publicHolidays,
    teamHolidays,
    startYmd,
    endYmd,
    personIdsByFloatRegionId
  );
  await upsertPtoHolidayImpactChunked(prisma, holidayRows);

  const approvedList = Array.from(approvedFloatSourceIds);
  if (approvedList.length === 0) {
    await prisma.$executeRaw`
      DELETE FROM "PTOHolidayImpact"
      WHERE type = CAST('PTO' AS "PTOHolidayType")
        AND "weekStartDate" >= ${winStart}::date
        AND "weekStartDate" <= ${winEnd}::date
        AND "floatSourceId" IS NOT NULL
    `;
  } else {
    await prisma.$executeRaw`
      DELETE FROM "PTOHolidayImpact"
      WHERE type = CAST('PTO' AS "PTOHolidayType")
        AND "weekStartDate" >= ${winStart}::date
        AND "weekStartDate" <= ${winEnd}::date
        AND "floatSourceId" IS NOT NULL
        AND "floatSourceId" NOT IN (${Prisma.join(
          approvedList.map((id) => Prisma.sql`${id}`)
        )})
    `;
  }

  const holList = Array.from(holidayFloatSourceIds);
  if (holList.length === 0) {
    await prisma.$executeRaw`
      DELETE FROM "PTOHolidayImpact"
      WHERE type = CAST('Holiday' AS "PTOHolidayType")
        AND "weekStartDate" >= ${winStart}::date
        AND "weekStartDate" <= ${winEnd}::date
        AND "floatSourceId" IS NOT NULL
    `;
  } else {
    await prisma.$executeRaw`
      DELETE FROM "PTOHolidayImpact"
      WHERE type = CAST('Holiday' AS "PTOHolidayType")
        AND "weekStartDate" >= ${winStart}::date
        AND "weekStartDate" <= ${winEnd}::date
        AND "floatSourceId" IS NOT NULL
        AND "floatSourceId" NOT IN (${Prisma.join(
          holList.map((id) => Prisma.sql`${id}`)
        )})
    `;
  }
}
