import { KeyRoleType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addUtcDays, dateKeyToUtcStart, utcDateKey } from "@/lib/resourcingSnapshotWindow";

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

/** One project with people who had Float scheduled hours but no substantive actuals for the prior UTC week. */
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

function actualHoursMissing(hours: Prisma.Decimal | null | undefined): boolean {
  if (hours == null) return true;
  return new Prisma.Decimal(hours).equals(0);
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
  const weekStartGte = dateKeyToUtcStart(start);
  const weekStartLte = dateKeyToUtcStart(end);

  const floatRows = await prisma.floatScheduledHours.findMany({
    where: {
      hours: { gt: 0 },
      weekStartDate: { gte: weekStartGte, lte: weekStartLte },
      project: { status: "Active" },
    },
    select: {
      projectId: true,
      personId: true,
      weekStartDate: true,
      person: { select: { name: true } },
    },
  });

  if (floatRows.length === 0) return [];

  const orKeys = floatRows.map((r) => ({
    projectId: r.projectId,
    personId: r.personId,
    weekStartDate: r.weekStartDate,
  }));

  const actualRows = await prisma.actualHours.findMany({
    where: { OR: orKeys },
    select: { projectId: true, personId: true, weekStartDate: true, hours: true },
  });

  const actualByComposite = new Map<string, (typeof actualRows)[0]>();
  for (const a of actualRows) {
    const k = `${a.projectId}|${a.personId}|${weekKey(a.weekStartDate)}`;
    actualByComposite.set(k, a);
  }

  type MissingRow = { projectId: string; personId: string; personName: string };
  const missing: MissingRow[] = [];

  for (const f of floatRows) {
    const k = `${f.projectId}|${f.personId}|${weekKey(f.weekStartDate)}`;
    const a = actualByComposite.get(k);
    if (!a || actualHoursMissing(a.hours)) {
      missing.push({
        projectId: f.projectId,
        personId: f.personId,
        personName: f.person.name,
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
