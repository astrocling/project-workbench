/**
 * Fulfill-time resourcing variance: Ready people (Float vs Planned at fulfill),
 * non-Ready people (Float at fulfill vs float hoursSnapshot at request only).
 */

export type HoursSnapshotRow = { weekStartDate: string; hours: number };

export type NormalizedSnapshotPerson = {
  personId: string;
  name: string;
  requested: boolean;
  hoursSnapshot: HoursSnapshotRow[];
  plannedSnapshot: HoursSnapshotRow[];
};

export type ParsedRequestedPeoplePayload = {
  snapshotStartKey: string | null;
  snapshotEndKey: string | null;
  people: NormalizedSnapshotPerson[];
};

export type WeekVarianceStats = {
  equal: boolean;
  matchingWeeks: number;
  differingWeeks: number;
};

export type UnexpectedFloatChange = { name: string; summary: string };

export type ResourcingFulfillVarianceResult = {
  hasVariance: boolean;
  notFilled: string[];
  partiallyFilled: string[];
  unexpectedFloatChanges: UnexpectedFloatChange[];
};

export function normalizeHoursSnapshot(raw: unknown): HoursSnapshotRow[] {
  const hoursSnapshot: HoursSnapshotRow[] = [];
  if (!Array.isArray(raw)) return hoursSnapshot;
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const weekStartDate =
      typeof r.weekStartDate === "string"
        ? r.weekStartDate.slice(0, 10)
        : String(r.weekStartDate ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) continue;
    const hours = Number(r.hours);
    if (!Number.isFinite(hours)) continue;
    hoursSnapshot.push({ weekStartDate, hours });
  }
  hoursSnapshot.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  return hoursSnapshot;
}

function normalizePersonRecord(o: Record<string, unknown>): NormalizedSnapshotPerson | null {
  const personId = o.personId != null ? String(o.personId) : "";
  const name = o.name != null ? String(o.name) : "";
  if (!personId) return null;
  const requested = o.requested === false ? false : true;
  return {
    personId,
    name: name || personId,
    requested,
    hoursSnapshot: normalizeHoursSnapshot(o.hoursSnapshot),
    plannedSnapshot: normalizeHoursSnapshot(o.plannedSnapshot),
  };
}

/** Supports legacy bare array or `{ snapshotStartKey, snapshotEndKey, people }`. */
export function parseRequestedPeoplePayload(raw: unknown): ParsedRequestedPeoplePayload {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const wrapper = raw as Record<string, unknown>;
    const peopleRaw = wrapper.people;
    const snapshotStartKey =
      typeof wrapper.snapshotStartKey === "string" ? wrapper.snapshotStartKey.slice(0, 10) : null;
    const snapshotEndKey =
      typeof wrapper.snapshotEndKey === "string" ? wrapper.snapshotEndKey.slice(0, 10) : null;
    const people: NormalizedSnapshotPerson[] = [];
    if (Array.isArray(peopleRaw)) {
      for (const item of peopleRaw) {
        if (!item || typeof item !== "object") continue;
        const p = normalizePersonRecord(item as Record<string, unknown>);
        if (p) people.push(p);
      }
    }
    return { snapshotStartKey, snapshotEndKey, people };
  }

  if (!Array.isArray(raw)) {
    return { snapshotStartKey: null, snapshotEndKey: null, people: [] };
  }

  const people: NormalizedSnapshotPerson[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = normalizePersonRecord(item as Record<string, unknown>);
    if (p) people.push(p);
  }
  return { snapshotStartKey: null, snapshotEndKey: null, people };
}

export function snapshotMapFromHoursSnapshot(rows: HoursSnapshotRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.weekStartDate.slice(0, 10), r.hours);
  }
  return m;
}

export function weekVarianceStats(snap: Map<string, number>, cur: Map<string, number>): WeekVarianceStats {
  const keys = new Set([...snap.keys(), ...cur.keys()]);
  let matchingWeeks = 0;
  let differingWeeks = 0;
  for (const k of keys) {
    const va = snap.get(k) ?? 0;
    const vb = cur.get(k) ?? 0;
    if (Math.abs(va - vb) <= 1e-9) matchingWeeks += 1;
    else differingWeeks += 1;
  }
  const equal = differingWeeks === 0;
  return { equal, matchingWeeks, differingWeeks };
}

/** Week-level summary for Slack: `2026-05-12: 8h → 16h` */
export function formatWeekChangeSummary(
  snap: Map<string, number>,
  cur: Map<string, number>
): string {
  const keys = [...new Set([...snap.keys(), ...cur.keys()])].sort();
  const parts: string[] = [];
  for (const k of keys) {
    const a = snap.get(k) ?? 0;
    const b = cur.get(k) ?? 0;
    if (Math.abs(a - b) <= 1e-9) continue;
    parts.push(`${k}: ${a}h → ${b}h`);
  }
  return parts.join(", ");
}

export function buildHoursByPerson(
  rows: { personId: string; weekStartDate: Date | string; hours: unknown }[],
  toDateKey: (d: Date) => string,
  startKey: string,
  endKey: string
): Map<string, Map<string, number>> {
  const byPerson = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const weekDate = r.weekStartDate instanceof Date ? r.weekStartDate : new Date(r.weekStartDate);
    const k = toDateKey(weekDate);
    if (k < startKey || k > endKey) continue;
    const inner = byPerson.get(r.personId) ?? new Map<string, number>();
    inner.set(k, Number(r.hours));
    byPerson.set(r.personId, inner);
  }
  return byPerson;
}

export function computeResourcingFulfillVariance(
  people: NormalizedSnapshotPerson[],
  floatCurByPerson: Map<string, Map<string, number>>,
  plannedCurByPerson: Map<string, Map<string, number>>
): ResourcingFulfillVarianceResult {
  const notFilled: string[] = [];
  const partiallyFilled: string[] = [];
  const unexpectedFloatChanges: UnexpectedFloatChange[] = [];

  for (const p of people) {
    const floatSnapMap = snapshotMapFromHoursSnapshot(p.hoursSnapshot);
    const floatCurMap = floatCurByPerson.get(p.personId) ?? new Map<string, number>();
    const plannedCurMap = plannedCurByPerson.get(p.personId) ?? new Map<string, number>();

    if (p.requested) {
      const vsPlanned = weekVarianceStats(plannedCurMap, floatCurMap);
      if (vsPlanned.equal) continue;

      const vsFloatSnap = weekVarianceStats(floatSnapMap, floatCurMap);
      if (vsFloatSnap.equal) {
        notFilled.push(p.name);
        continue;
      }

      partiallyFilled.push(p.name);
      continue;
    }

    const vsFloatSnap = weekVarianceStats(floatSnapMap, floatCurMap);
    if (vsFloatSnap.equal) continue;

    const summary = formatWeekChangeSummary(floatSnapMap, floatCurMap);
    unexpectedFloatChanges.push({
      name: p.name,
      summary: summary || "Float hours changed",
    });
  }

  const hasVariance =
    notFilled.length > 0 ||
    partiallyFilled.length > 0 ||
    unexpectedFloatChanges.length > 0;

  return {
    hasVariance,
    notFilled,
    partiallyFilled,
    unexpectedFloatChanges,
  };
}
