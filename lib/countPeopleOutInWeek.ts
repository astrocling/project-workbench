import type { PtoHolidayByWeek } from "@/lib/pgmPtoWidgetData";

export type AbsenceMember = { personId: string; floatRegionId: number | null };

/**
 * Count of unique people who are out in a given week (PTO and/or regional holiday),
 * scoped to `members`. A person with both PTO and a holiday that week counts once.
 */
export function countPeopleOutInWeek(
  ptoHolidayByWeek: PtoHolidayByWeek,
  weekKey: string,
  members: AbsenceMember[]
): number {
  const memberIds = new Set(members.map((m) => m.personId));
  const list = ptoHolidayByWeek[weekKey] ?? [];
  const out = new Set<string>();

  const holidayRegionIds = new Set<number>();
  for (const e of list) {
    if (e.type === "HOLIDAY" && e.floatRegionId != null) {
      holidayRegionIds.add(e.floatRegionId);
    }
  }

  for (const e of list) {
    if (e.type !== "PTO") continue;
    if (memberIds.has(e.personId)) out.add(e.personId);
  }

  for (const m of members) {
    if (m.floatRegionId != null && holidayRegionIds.has(m.floatRegionId)) {
      out.add(m.personId);
    }
  }

  return out.size;
}
