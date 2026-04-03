import { prisma } from "@/lib/prisma";
import { formatWeekKey, getWeekStartDate, isUtcWeekdayDate } from "@/lib/weekUtils";

/** Matches GET /api/projects/[id]/resourcing `ptoHolidayByWeek` entries. */
export type PtoHolidayEntry = {
  personId: string;
  type: "PTO" | "HOLIDAY";
  date: string;
  hours: number | null;
  label: string | null;
  isPartial: boolean;
};

export type PtoHolidayByWeek = Record<string, PtoHolidayEntry[]>;

/** Portfolio dashboard scope: projects where the viewer holds this key role (PM, PGM, or CAD). */
export type DashboardPtoKeyRole = "PM" | "PGM" | "CAD";

export type DashboardPtoProjectPayload = {
  projectId: string;
  projectName: string;
  members: { personId: string; name: string; role: string }[];
  ptoHolidayByWeek: PtoHolidayByWeek;
};

/** @deprecated Use `DashboardPtoProjectPayload` */
export type PgmPtoProjectPayload = DashboardPtoProjectPayload;

function toDateKey(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * Loads dashboard-scoped active projects (PM, PGM, or CAD key role) with visible
 * assignments and PTO/holiday rows for the two rolling weeks (current Monday + next Monday),
 * matching `/api/projects/[id]/resourcing` shaping.
 */
export async function getDashboardPtoWidgetProjects(
  personId: string,
  clientFilter: string | null,
  today: Date,
  keyRole: DashboardPtoKeyRole
): Promise<DashboardPtoProjectPayload[]> {
  const weekStart = getWeekStartDate(new Date(today));
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
  const fromWeekKey = formatWeekKey(weekStart);
  const toWeekKey = formatWeekKey(nextWeekStart);
  const from = new Date(fromWeekKey + "T00:00:00.000Z");
  const to = new Date(toWeekKey + "T00:00:00.000Z");

  const projects = await prisma.project.findMany({
    where: {
      status: "Active",
      projectKeyRoles: { some: { personId, type: keyRole } },
      ...(clientFilter && clientFilter.trim() !== ""
        ? { clientName: clientFilter }
        : {}),
    },
    select: {
      id: true,
      name: true,
      assignments: {
        where: { hiddenFromGrid: false },
        select: {
          personId: true,
          person: { select: { name: true } },
          role: { select: { name: true } },
        },
      },
    },
  });

  const allVisibleIds = new Set<string>();
  for (const p of projects) {
    for (const a of p.assignments) {
      allVisibleIds.add(a.personId);
    }
  }
  const idList = Array.from(allVisibleIds);

  const ptoRows =
    idList.length === 0
      ? []
      : await prisma.pTOHolidayImpact.findMany({
          where: {
            personId: { in: idList },
            weekStartDate: { gte: from, lte: to },
          },
          select: {
            personId: true,
            date: true,
            weekStartDate: true,
            type: true,
            hours: true,
            label: true,
          },
        });

  return projects.map((project) => {
    const visible = new Set(project.assignments.map((a) => a.personId));
    const ptoHolidayByWeek: PtoHolidayByWeek = {};

    // Only attach PTO/holiday rows for people assigned to this project (visible grid).
    // Scoped projects + client filter are applied in the parent query; idList is the union
    // of those assignees only—no holidays for people who are not on any in-scope project.
    for (const r of ptoRows) {
      if (!visible.has(r.personId)) continue;
      const apiType = r.type === "PTO" ? "PTO" : "HOLIDAY";
      if (apiType === "HOLIDAY" && !isUtcWeekdayDate(new Date(r.date))) continue;
      const weekKey = formatWeekKey(r.weekStartDate);
      const h = r.hours;
      const hoursVal = h != null && Number.isFinite(Number(h)) ? Number(h) : null;
      const isPartial =
        apiType === "PTO" && hoursVal != null && hoursVal < 8;
      if (!ptoHolidayByWeek[weekKey]) ptoHolidayByWeek[weekKey] = [];
      ptoHolidayByWeek[weekKey]!.push({
        personId: r.personId,
        type: apiType,
        date: toDateKey(r.date),
        hours: hoursVal,
        label: r.label ?? null,
        isPartial,
      });
    }

    return {
      projectId: project.id,
      projectName: project.name,
      members: project.assignments.map((a) => ({
        personId: a.personId,
        name: a.person.name,
        role: a.role.name,
      })),
      ptoHolidayByWeek,
    };
  });
}

/** PGM dashboard — same as `getDashboardPtoWidgetProjects(..., "PGM")`. */
export async function getPgmPtoWidgetProjects(
  personId: string,
  clientFilter: string | null,
  today: Date
): Promise<DashboardPtoProjectPayload[]> {
  return getDashboardPtoWidgetProjects(personId, clientFilter, today, "PGM");
}
