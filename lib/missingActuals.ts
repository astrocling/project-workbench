import { KeyRoleType } from "@prisma/client";

import {
  hasMissingActuals,
  hasMissingActualsSplitWeek,
} from "@/lib/budgetCalculations";
import { getMonthKeysForWeek } from "@/lib/monthUtils";
import { prisma } from "@/lib/prisma";
import { addUtcDays, dateKeyToUtcStart, utcDateKey } from "@/lib/resourcingSnapshotWindow";
import { getAsOfDate } from "@/lib/weekUtils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type KeyRoleContact = {
  slackUserId: string | null;
  name: string;
};

/** One project with people who had planned hours but stale actuals for the prior UTC week. */
export type MissingActualsProject = {
  projectId: string;
  projectSlug: string;
  projectName: string;
  /** Present when Thursday account-channel nudge is allowed (needs account + channel). */
  accountId: string | null;
  projectSlackChannelId: string | null;
  accountSlackChannelId: string | null;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  projectManagers: KeyRoleContact[];
  programManagers: KeyRoleContact[];
  missingPersonNames: string[];
};

export type PersonWeekActualsInput = {
  weekStartDate: Date;
  plannedHours: number;
  actualHours: number | null;
  /** monthKey -> hours for each ActualHoursMonthSplit row present */
  monthSplitByKey: Map<string, number>;
};

function thisWeekMondayUtc(): Date {
  const now = new Date();
  const x = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = x.getUTCDay();
  const daysFromMonday = (dow + 6) % 7;
  x.setUTCDate(x.getUTCDate() - daysFromMonday);
  return x;
}

/** Previous full week (Mon–Sun UTC) as YYYY-MM-DD keys. */
export function getPreviousWeekRange(): { start: string; end: string } {
  const thisMonday = thisWeekMondayUtc();
  const prevMonday = addUtcDays(thisMonday, -7);
  const prevSunday = addUtcDays(prevMonday, 6);
  return { start: utcDateKey(prevMonday), end: utcDateKey(prevSunday) };
}

/** e.g. "May 4–10, 2026" or "Apr 28 – May 4, 2026" (UTC calendar parts only). */
export function formatWeekLabel(start: string, end: string): string {
  const s = dateKeyToUtcStart(start);
  const e = dateKeyToUtcStart(end);
  const sy = s.getUTCFullYear();
  const sm = s.getUTCMonth();
  const sd = s.getUTCDate();
  const ey = e.getUTCFullYear();
  const em = e.getUTCMonth();
  const ed = e.getUTCDate();
  const smn = MONTHS[sm]!;
  const emn = MONTHS[em]!;
  if (sy === ey && sm === em) {
    return `${smn} ${sd}–${ed}, ${sy}`;
  }
  if (sy === ey) {
    return `${smn} ${sd} – ${emn} ${ed}, ${ey}`;
  }
  return `${smn} ${sd}, ${sy} – ${emn} ${ed}, ${ey}`;
}

function weekKey(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function compositeKey(projectId: string, personId: string, weekStartDate: Date): string {
  return `${projectId}|${personId}|${weekKey(weekStartDate)}`;
}

export function assignmentPairKey(projectId: string, personId: string): string {
  return `${projectId}|${personId}`;
}

/** Keep only rows with a visible project assignment (matches Resourcing grid). */
export function filterPlannedRowsToVisibleAssignments<
  T extends { projectId: string; personId: string },
>(rows: T[], visibleAssignmentPairs: Set<string>): T[] {
  return rows.filter((r) => visibleAssignmentPairs.has(assignmentPairKey(r.projectId, r.personId)));
}

/**
 * Whether a person-week should show as stale on Resourcing (same rules as amber Actual cells).
 */
export function personWeekIsActualsStale(
  input: PersonWeekActualsInput,
  asOf?: Date,
  now?: Date
): boolean {
  const { weekStartDate, plannedHours, actualHours, monthSplitByKey } = input;
  if (plannedHours <= 0) return false;

  const monthKeys = getMonthKeysForWeek(weekStartDate);
  if (monthKeys.length === 1) {
    return hasMissingActuals(weekStartDate, plannedHours, actualHours, asOf, now);
  }

  const [mk1, mk2] = monthKeys as [string, string];
  const hasRowFirst = monthSplitByKey.has(mk1);
  const hasRowSecond = monthSplitByKey.has(mk2);
  const val1 = hasRowFirst ? monthSplitByKey.get(mk1)! : null;
  const val2 = hasRowSecond ? monthSplitByKey.get(mk2)! : null;

  return hasMissingActualsSplitWeek(
    weekStartDate,
    plannedHours,
    val1,
    val2,
    mk1,
    mk2,
    asOf,
    now,
    { hasRowFirst, hasRowSecond }
  );
}

function keyRoleContactsFromRoles(
  roles: Array<{
    type: KeyRoleType;
    personId: string;
    person: {
      name: string;
      user: { slackUserId: string | null } | null;
    };
  }>,
  type: KeyRoleType
): KeyRoleContact[] {
  const seen = new Set<string>();
  const out: KeyRoleContact[] = [];
  for (const r of roles) {
    if (r.type !== type) continue;
    if (seen.has(r.personId)) continue;
    seen.add(r.personId);
    const sid = r.person.user?.slackUserId?.trim();
    out.push({
      name: r.person.name,
      slackUserId: sid && sid.length > 0 ? sid : null,
    });
  }
  return out;
}

export async function getMissingActualsProjects(): Promise<MissingActualsProject[]> {
  const { start, end } = getPreviousWeekRange();
  const weekLabel = formatWeekLabel(start, end);
  const weekStartDate = dateKeyToUtcStart(start);
  const asOf = getAsOfDate();
  const now = new Date();

  const plannedRows = await prisma.plannedHours.findMany({
    where: {
      hours: { gt: 0 },
      weekStartDate,
      project: { status: "Active" },
    },
    select: {
      projectId: true,
      personId: true,
      weekStartDate: true,
      hours: true,
      person: { select: { name: true } },
    },
  });

  if (plannedRows.length === 0) return [];

  const assignmentPairs = plannedRows.map((r) => ({
    projectId: r.projectId,
    personId: r.personId,
  }));
  const visibleAssignments = await prisma.projectAssignment.findMany({
    where: {
      hiddenFromGrid: false,
      OR: assignmentPairs,
    },
    select: { projectId: true, personId: true },
  });
  const visibleAssignmentPairs = new Set(
    visibleAssignments.map((a) => assignmentPairKey(a.projectId, a.personId))
  );
  const resourcedPlannedRows = filterPlannedRowsToVisibleAssignments(
    plannedRows,
    visibleAssignmentPairs
  );
  if (resourcedPlannedRows.length === 0) return [];

  const orKeys = resourcedPlannedRows.map((r) => ({
    projectId: r.projectId,
    personId: r.personId,
    weekStartDate: r.weekStartDate,
  }));

  const [actualRows, splitRows] = await Promise.all([
    prisma.actualHours.findMany({
      where: { OR: orKeys },
      select: { projectId: true, personId: true, weekStartDate: true, hours: true },
    }),
    prisma.actualHoursMonthSplit.findMany({
      where: { OR: orKeys },
      select: {
        projectId: true,
        personId: true,
        weekStartDate: true,
        monthKey: true,
        hours: true,
      },
    }),
  ]);

  const actualByComposite = new Map<string, (typeof actualRows)[0]>();
  for (const a of actualRows) {
    actualByComposite.set(compositeKey(a.projectId, a.personId, a.weekStartDate), a);
  }

  const splitsByComposite = new Map<string, Map<string, number>>();
  for (const s of splitRows) {
    const k = compositeKey(s.projectId, s.personId, s.weekStartDate);
    const monthMap = splitsByComposite.get(k) ?? new Map<string, number>();
    monthMap.set(s.monthKey, Number(s.hours));
    splitsByComposite.set(k, monthMap);
  }

  type MissingRow = { projectId: string; personId: string; personName: string };
  const missing: MissingRow[] = [];

  for (const planned of resourcedPlannedRows) {
    const k = compositeKey(planned.projectId, planned.personId, planned.weekStartDate);
    const actual = actualByComposite.get(k);
    const actualHours = actual?.hours != null ? Number(actual.hours) : null;
    const plannedHours = Number(planned.hours);
    const monthSplitByKey = splitsByComposite.get(k) ?? new Map<string, number>();

    if (
      personWeekIsActualsStale(
        {
          weekStartDate: planned.weekStartDate,
          plannedHours,
          actualHours,
          monthSplitByKey,
        },
        asOf,
        now
      )
    ) {
      missing.push({
        projectId: planned.projectId,
        personId: planned.personId,
        personName: planned.person.name,
      });
    }
  }

  if (missing.length === 0) return [];

  const projectIds = [...new Set(missing.map((m) => m.projectId))];

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, status: "Active" },
    select: {
      id: true,
      slug: true,
      name: true,
      slackChannelId: true,
      accountId: true,
      account: { select: { slackChannelId: true } },
      projectKeyRoles: {
        where: { type: { in: [KeyRoleType.PM, KeyRoleType.PGM] } },
        select: {
          type: true,
          personId: true,
          person: {
            select: {
              name: true,
              user: { select: { slackUserId: true } },
            },
          },
        },
      },
    },
  });

  const projectById = new Map(projects.map((p) => [p.id, p]));

  const byProject = new Map<string, MissingRow[]>();
  for (const m of missing) {
    const list = byProject.get(m.projectId) ?? [];
    list.push(m);
    byProject.set(m.projectId, list);
  }

  const result: MissingActualsProject[] = [];

  for (const pid of projectIds) {
    const p = projectById.get(pid);
    if (!p) continue;
    const rows = byProject.get(pid) ?? [];
    const nameSet = new Set<string>();
    for (const r of rows) nameSet.add(r.personName);

    const roles = p.projectKeyRoles;
    result.push({
      projectId: p.id,
      projectSlug: p.slug,
      projectName: p.name,
      accountId: p.accountId,
      projectSlackChannelId: p.slackChannelId?.trim() || null,
      accountSlackChannelId: p.account?.slackChannelId?.trim() || null,
      weekLabel,
      weekStart: start,
      weekEnd: end,
      projectManagers: keyRoleContactsFromRoles(roles, KeyRoleType.PM),
      programManagers: keyRoleContactsFromRoles(roles, KeyRoleType.PGM),
      missingPersonNames: [...nameSet].sort((a, b) => a.localeCompare(b)),
    });
  }

  result.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return result;
}
