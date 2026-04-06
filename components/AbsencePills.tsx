import type { PtoHolidayByWeek } from "@/lib/pgmPtoWidgetData";
import { countPeopleOutInWeek, type AbsenceMember } from "@/lib/countPeopleOutInWeek";
import { getRollingTwoWeeks } from "@/lib/weekUtils";

export interface AbsencePillsProps {
  projects: {
    members: AbsenceMember[];
    ptoHolidayByWeek: PtoHolidayByWeek;
  }[];
  today: Date;
}

function mergeWeekPtoHoliday(
  projects: AbsencePillsProps["projects"],
  weekKey: string
): PtoHolidayByWeek {
  const entries = projects.flatMap((p) => p.ptoHolidayByWeek[weekKey] ?? []);
  return { [weekKey]: entries };
}

function dedupeMembers(projects: AbsencePillsProps["projects"]): AbsenceMember[] {
  const map = new Map<string, AbsenceMember>();
  for (const p of projects) {
    for (const m of p.members) {
      if (!map.has(m.personId)) {
        map.set(m.personId, {
          personId: m.personId,
          floatRegionId: m.floatRegionId,
        });
      }
    }
  }
  return [...map.values()];
}

export default function AbsencePills({ projects, today }: AbsencePillsProps) {
  const [thisWeekKey, nextWeekKey] = getRollingTwoWeeks(today);
  const members = dedupeMembers(projects);

  const thisCount = countPeopleOutInWeek(
    mergeWeekPtoHoliday(projects, thisWeekKey),
    thisWeekKey,
    members
  );
  const nextCount = countPeopleOutInWeek(
    mergeWeekPtoHoliday(projects, nextWeekKey),
    nextWeekKey,
    members
  );

  if (thisCount === 0 && nextCount === 0) return null;

  const pillBase =
    "inline-flex items-center rounded-full shrink-0 box-border [&>span:last-child]:leading-none";

  return (
    <span className="inline-flex flex-wrap items-baseline gap-2 -translate-y-0.5">
      {thisCount > 0 ? (
        <span
          className={`${pillBase} border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200`}
          style={{ fontSize: 12, padding: "3px 9px", gap: 5 }}
        >
          <span
            className="shrink-0 rounded-full bg-amber-500"
            style={{ width: 6, height: 6 }}
            aria-hidden
          />
          <span>{thisCount} out this week</span>
        </span>
      ) : null}
      {nextCount > 0 ? (
        <span
          className={`${pillBase} border border-surface-200 bg-surface-100 text-surface-600 dark:border-dark-border dark:bg-dark-raised dark:text-surface-400`}
          style={{ fontSize: 12, padding: "3px 9px", gap: 5 }}
        >
          <span
            className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40"
            style={{ width: 6, height: 6 }}
            aria-hidden
          />
          <span>{nextCount} out next week</span>
        </span>
      ) : null}
    </span>
  );
}
