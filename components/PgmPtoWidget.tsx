import type { DashboardPtoProjectPayload } from "@/lib/pgmPtoWidgetData";
import { HALF_DAY_HOURS, getInitials } from "@/lib/ptoDisplayUtils";
import { formatWeekKey, getWeekStartDate } from "@/lib/weekUtils";

export interface PgmPtoWidgetProps {
  projects: DashboardPtoProjectPayload[];
  today: Date;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Monday YYYY-MM-DD for the week containing `date`. */
function getWeekStart(date: Date): string {
  return formatWeekKey(getWeekStartDate(date));
}

/** Current week Monday and following week Monday. */
function getRollingTwoWeeks(today: Date): [string, string] {
  const k1 = getWeekStart(today);
  const w2 = new Date(k1 + "T00:00:00.000Z");
  w2.setUTCDate(w2.getUTCDate() + 7);
  return [k1, formatWeekKey(w2)];
}

export type CombinedPill =
  | { kind: "pto"; dayLabel: string; isHalf: boolean }
  | { kind: "holiday"; dayLabel: string };

export type WeekEntryRow = {
  personId: string;
  name: string;
  hasPto: boolean;
  hasHoliday: boolean;
  /** Unique holiday labels for the tag line (e.g. "Easter Monday"). */
  holidayTagNames: string[];
  pills: CombinedPill[];
};

function mergePtoDays(
  existing: Map<string, { date: string; hours: number | null }>,
  date: string,
  hours: number | null
): void {
  const cur = existing.get(date);
  if (!cur) {
    existing.set(date, { date, hours });
    return;
  }
  const a = cur.hours;
  const b = hours;
  if (a == null && b == null) return;
  if (a == null) {
    existing.set(date, { date, hours: b });
    return;
  }
  if (b == null) return;
  existing.set(date, { date, hours: Math.max(a, b) });
}

function mergeHolidayLabel(existing: string | undefined, label: string): string {
  if (!existing || existing === label) return label;
  if (existing.includes(label)) return existing;
  return `${existing}, ${label}`;
}

function buildCombinedPills(
  ptoByDate: Map<string, { date: string; hours: number | null }>,
  holidaysByDate: Map<string, string>
): CombinedPill[] {
  const dates = new Set([...ptoByDate.keys(), ...holidaysByDate.keys()]);
  const sorted = [...dates]
    .filter((d) => {
      const dt = new Date(d + "T12:00:00.000Z");
      const dow = dt.getUTCDay();
      return dow !== 0 && dow !== 6;
    })
    .sort((a, b) => a.localeCompare(b));

  const out: CombinedPill[] = [];
  for (const date of sorted) {
    const ptoDay = ptoByDate.get(date);
    if (ptoDay) {
      const dt = new Date(date + "T12:00:00.000Z");
      const dayLabel = DOW_LABELS[dt.getUTCDay()]!;
      const isHalf = ptoDay.hours != null && ptoDay.hours < HALF_DAY_HOURS;
      out.push({ kind: "pto", dayLabel, isHalf });
    }
    const hol = holidaysByDate.get(date);
    if (hol) {
      const dt = new Date(date + "T12:00:00.000Z");
      const dayLabel = DOW_LABELS[dt.getUTCDay()]!;
      out.push({ kind: "holiday", dayLabel });
    }
  }
  return out;
}

export function getWeekEntries(
  projects: DashboardPtoProjectPayload[],
  weekKey: string
): WeekEntryRow[] {
  const byPerson = new Map<
    string,
    {
      name: string;
      pto: Map<string, { date: string; hours: number | null }>;
      holidays: Map<string, string>;
    }
  >();

  for (const proj of projects) {
    const memberName = new Map(proj.members.map((m) => [m.personId, m.name]));
    const list = proj.ptoHolidayByWeek[weekKey] ?? [];
    for (const e of list) {
      if (!memberName.has(e.personId)) continue;
      const nm = memberName.get(e.personId)!;
      let agg = byPerson.get(e.personId);
      if (!agg) {
        agg = { name: nm, pto: new Map(), holidays: new Map() };
        byPerson.set(e.personId, agg);
      }
      if (e.type === "HOLIDAY") {
        const label = (e.label?.trim() || "Holiday").replace(/\s+/g, " ");
        const prev = agg.holidays.get(e.date);
        agg.holidays.set(e.date, mergeHolidayLabel(prev, label));
        continue;
      }
      mergePtoDays(agg.pto, e.date, e.hours);
    }
  }

  const rows: WeekEntryRow[] = [];
  for (const [personId, agg] of byPerson) {
    const pills = buildCombinedPills(agg.pto, agg.holidays);
    const hasPto = pills.some((p) => p.kind === "pto");
    const hasHoliday = pills.some((p) => p.kind === "holiday");
    if (!hasPto && !hasHoliday) continue;

    const labelSet = new Set<string>();
    for (const v of agg.holidays.values()) {
      for (const part of v.split(",").map((s) => s.trim()).filter(Boolean)) {
        labelSet.add(part);
      }
    }
    const holidayTagNames = [...labelSet].sort((a, b) => a.localeCompare(b));

    rows.push({
      personId,
      name: agg.name,
      hasPto,
      hasHoliday,
      holidayTagNames,
      pills,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function formatShortMonDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatRangeLabel(today: Date): string {
  const [k1, k2] = getRollingTwoWeeks(today);
  const start = new Date(k1 + "T12:00:00.000Z");
  const end = new Date(k2 + "T12:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 6);
  const a = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const b = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${a} – ${b}`;
}

function weekLabelPrefix(weekKey: string, today: Date): "This week" | "Next week" {
  const [current] = getRollingTwoWeeks(today);
  return weekKey === current ? "This week" : "Next week";
}

export default function PgmPtoWidget({ projects, today }: PgmPtoWidgetProps) {
  const [week1, week2] = getRollingTwoWeeks(today);
  const entries1 = getWeekEntries(projects, week1);
  const entries2 = getWeekEntries(projects, week2);

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <p className="text-label-md text-surface-500 dark:text-surface-400 uppercase tracking-wider font-semibold">
          Upcoming PTO &amp; holidays
        </p>
        <p className="text-[12px] text-surface-500 dark:text-surface-400 shrink-0">
          {formatRangeLabel(today)}
        </p>
      </div>

      <div className="space-y-6">
        <WeekBlock
          weekKey={week1}
          today={today}
          entries={entries1}
        />
        <WeekBlock
          weekKey={week2}
          today={today}
          entries={entries2}
        />
      </div>
    </div>
  );
}

function WeekBlock({
  weekKey,
  today,
  entries,
}: {
  weekKey: string;
  today: Date;
  entries: WeekEntryRow[];
}) {
  const monShort = formatShortMonDay(weekKey);
  const prefix = weekLabelPrefix(weekKey, today);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-surface-500 dark:text-surface-400 shrink-0">
          {prefix} — {monShort}
        </span>
        <div
          className="flex-1 h-px bg-surface-200 dark:bg-dark-border min-w-[1rem]"
          aria-hidden
        />
      </div>
      {entries.length === 0 ? (
        <p className="text-[13px] text-surface-500 dark:text-surface-400 py-1">
          No PTO or holidays
        </p>
      ) : (
        <ul>
          {entries.map((row) => (
            <li
              key={row.personId}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 border-b border-surface-100 dark:border-dark-border last:border-b-0"
            >
              <PersonTimeOffRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonTimeOffRow({ row }: { row: WeekEntryRow }) {
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
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                  aria-hidden
                />
                <span className="text-[11px] text-surface-500 dark:text-surface-400">
                  PTO
                </span>
              </span>
            ) : null}
            {row.hasPto && row.hasHoliday ? (
              <span
                className="text-[11px] text-surface-400 dark:text-surface-500"
                aria-hidden
              >
                ·
              </span>
            ) : null}
            {row.hasHoliday ? (
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-jblue-500 shrink-0"
                  aria-hidden
                />
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
