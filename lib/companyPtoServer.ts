import { prisma } from "@/lib/prisma";
import type { PtoHolidayByWeek } from "@/lib/pgmPtoWidgetData";
import type { CompanyPerson } from "@/lib/companyPtoTypes";
import { HALF_DAY_HOURS } from "@/lib/ptoDisplayUtils";
import { formatWeekKey, getWeekStartDate, isUtcWeekdayDate } from "@/lib/weekUtils";

function toDateKey(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * All active people plus PTO/holiday impacts for ISO weeks from the current Monday
 * through the Monday of the week containing (today + 12 calendar months).
 */
export async function getCompanyPtoPayload(today: Date = new Date()): Promise<{
  people: CompanyPerson[];
  ptoHolidayByWeek: PtoHolidayByWeek;
}> {
  const weekStart = getWeekStartDate(new Date(today));
  const rangeEnd = new Date(today);
  rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 12);
  const weekEnd = getWeekStartDate(rangeEnd);

  const people = await prisma.person.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      floatRegionId: true,
      floatRegionName: true,
      floatJobTitle: true,
    },
  });

  const personIds = people.map((p) => p.id);

  const ptoRows =
    personIds.length === 0
      ? []
      : await prisma.pTOHolidayImpact.findMany({
          where: {
            personId: { in: personIds },
            weekStartDate: { gte: weekStart, lte: weekEnd },
          },
          select: {
            personId: true,
            date: true,
            weekStartDate: true,
            type: true,
            hours: true,
            label: true,
            floatRegionId: true,
          },
        });

  const ptoHolidayByWeek: PtoHolidayByWeek = {};

  for (const r of ptoRows) {
    const apiType = r.type === "PTO" ? "PTO" : "HOLIDAY";
    if (apiType === "HOLIDAY" && !isUtcWeekdayDate(new Date(r.date))) continue;
    const weekKey = formatWeekKey(r.weekStartDate);
    const h = r.hours;
    const hoursVal = h != null && Number.isFinite(Number(h)) ? Number(h) : null;
    const isPartial = apiType === "PTO" && hoursVal != null && hoursVal < HALF_DAY_HOURS;
    if (!ptoHolidayByWeek[weekKey]) ptoHolidayByWeek[weekKey] = [];
    ptoHolidayByWeek[weekKey]!.push({
      personId: r.personId,
      type: apiType,
      date: toDateKey(r.date),
      hours: hoursVal,
      label: r.label ?? null,
      isPartial,
      floatRegionId: apiType === "HOLIDAY" ? r.floatRegionId ?? null : null,
    });
  }

  return {
    people: people.map((p) => ({
      personId: p.id,
      name: p.name,
      role: p.floatJobTitle?.trim() ? p.floatJobTitle.trim() : "—",
      floatRegionId: p.floatRegionId ?? null,
      floatRegionName: p.floatRegionName ?? null,
    })),
    ptoHolidayByWeek,
  };
}
