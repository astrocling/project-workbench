/**
 * Float API → same DB payload shape as CSV import (applyFloatImportDatabaseEffects).
 */

import type { PrismaClient } from "@prisma/client";
import type { Person, Project } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  aggregateTasksToWeeklyHours,
  dedupeFloatTasksForAggregation,
  weeklyHoursMapToRows,
  type FloatTaskJson,
} from "@/lib/float/taskAggregation";
import {
  buildExcludedUtcDatesByFloatPeopleId,
  filterHolidayRowsOverlappingYmdWindow,
  regionIdFromPersonRow,
  type FloatTimeOffJson,
} from "@/lib/float/excludedDays";
import type { FloatClient } from "@/lib/float/client";
import {
  buildFloatRegionNameMap,
  floatRegionLabelFromPersonRow,
} from "@/lib/float/regionLabel";
import {
  buildWorkbenchRoleLookup,
  getFallbackRoleIdForNewAssignment,
} from "@/lib/float/roleWorkbenchMatch";
import { applyFloatImportDatabaseEffects, type MergedFloatEntry } from "@/lib/floatImportApply";
import { normalizeProjectNameForLookup } from "@/lib/floatImportUtils";
import { getAsOfDate } from "@/lib/weekUtils";

/** Minimal shapes from Float list endpoints (fields may be strings in API responses). */
export type FloatPersonJson = {
  people_id: number | string;
  name: string;
  email?: string | null;
  job_title?: string | null;
  /** Float `tags` (array of strings, normalized lowercase by Float). */
  tags?: unknown;
  /** Float scheduling active flag (`1`/`0` or boolean in responses). */
  active?: number | string | boolean | null;
  department?: { department_id?: number | string; name?: string | null } | null;
  /** Present when listing with `expand=account`. */
  account?: unknown;
  role_id?: number | string | null;
  /** Float region; public/team holidays apply only when this matches the holiday's region. */
  region_id?: number | string | null;
  /** Optional display fields (API shape may vary). */
  region_name?: string | null;
};

export type FloatProjectJson = {
  project_id: number | string;
  name: string;
  client_id?: number | string | null;
};

export type FloatClientJson = {
  client_id: number | string;
  name: string;
};

export type FloatRoleJson = {
  role_id: number | string;
  name: string;
};

export type FloatTaskWithRoleJson = FloatTaskJson & {
  /** Allocation role when set; else person's default role is used. */
  role_id?: number | string | null;
};

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ~12 months before/after today (UTC calendar). */
export function defaultFloatSyncDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, now.getUTCDate())
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, now.getUTCDate())
  );
  return { start: toYmd(start), end: toYmd(end) };
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Derive a short label for admin UI from Float `expand=account` payload (shape varies). */
export function floatAccessLabelFromAccount(account: unknown): string | null {
  if (account == null) return null;
  if (typeof account !== "object") return null;
  const a = account as Record<string, unknown>;
  if (Object.keys(a).length === 0) return "No login";
  for (const key of [
    "access_level",
    "access_type",
    "permission_level",
    "permission",
    "role_name",
    "name",
    "label",
  ]) {
    const v = a[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const email = a.email;
  if (typeof email === "string" && email.trim()) return email.trim();
  if (a.account_id != null || a.id != null) return "Linked";
  return "Has account";
}

function floatSchedulingActiveFromApi(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "1" || s === "true") return true;
    if (s === "0" || s === "false") return false;
  }
  return null;
}

function normalizeTagsForPerson(tags: unknown): string[] | null {
  if (!Array.isArray(tags)) return null;
  const strings = tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
  return strings.length ? strings : null;
}

function tagsEqual(db: Prisma.JsonValue | null, incoming: string[] | null): boolean {
  return JSON.stringify(db ?? null) === JSON.stringify(incoming ?? null);
}

function floatTagsForWrite(tags: string[] | null): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (tags === null) return Prisma.DbNull;
  return tags;
}

/** When Float omits scheduling `active`, do not overwrite Workbench `Person.active`. */
function workbenchActiveDataFromFloatScheduling(
  floatSchedulingActive: boolean | null
): { active: boolean } | Record<string, never> {
  if (floatSchedulingActive === null) return {};
  return { active: floatSchedulingActive };
}

function personActiveAfterFloatSync(
  rowActive: boolean,
  floatSchedulingActive: boolean | null
): boolean {
  return floatSchedulingActive !== null ? floatSchedulingActive : rowActive;
}

function emailFromFp(fp: FloatPersonJson): string | null {
  const e = fp.email;
  if (typeof e !== "string") return null;
  const t = e.trim();
  return t.length ? t : null;
}

function jobTitleFromFp(fp: FloatPersonJson): string | null {
  const j = fp.job_title;
  if (typeof j !== "string") return null;
  const t = j.trim();
  return t.length ? t : null;
}

function departmentNameFromFp(fp: FloatPersonJson): string | null {
  const d = fp.department;
  if (!d || typeof d !== "object") return null;
  const name = (d as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

type FloatPersonSyncData = {
  name: string;
  email: string | null;
  floatRegionId: number | null;
  floatRegionName: string | null;
  floatJobTitle: string | null;
  floatDepartmentName: string | null;
  floatTags: string[] | null;
  floatSchedulingActive: boolean | null;
  floatAccessLabel: string | null;
};

function buildFloatPersonSyncData(
  fp: FloatPersonJson,
  regionNameByFloatId: Map<number, string>
): FloatPersonSyncData {
  const row = fp as Record<string, unknown>;
  const floatRegionId = regionIdFromPersonRow(row);
  const floatRegionName =
    floatRegionId == null
      ? null
      : (floatRegionLabelFromPersonRow(row) ??
        regionNameByFloatId.get(floatRegionId) ??
        null);
  const ext = String(fp.people_id);
  const name = (fp.name ?? "").trim() || `Float person ${ext}`;
  return {
    name,
    email: emailFromFp(fp),
    floatRegionId,
    floatRegionName,
    floatJobTitle: jobTitleFromFp(fp),
    floatDepartmentName: departmentNameFromFp(fp),
    floatTags: normalizeTagsForPerson(fp.tags),
    floatSchedulingActive: floatSchedulingActiveFromApi(fp.active),
    floatAccessLabel: floatAccessLabelFromAccount(fp.account),
  };
}

function floatPersonSyncMatchesDb(
  p: {
    active: boolean;
    name: string;
    email: string | null;
    floatRegionId: number | null;
    floatRegionName: string | null;
    floatJobTitle: string | null;
    floatDepartmentName: string | null;
    floatTags: Prisma.JsonValue | null;
    floatSchedulingActive: boolean | null;
    floatAccessLabel: string | null;
  },
  s: FloatPersonSyncData
): boolean {
  const fieldsMatch =
    p.name === s.name &&
    p.email === s.email &&
    p.floatRegionId === s.floatRegionId &&
    p.floatRegionName === s.floatRegionName &&
    p.floatJobTitle === s.floatJobTitle &&
    p.floatDepartmentName === s.floatDepartmentName &&
    p.floatSchedulingActive === s.floatSchedulingActive &&
    p.floatAccessLabel === s.floatAccessLabel &&
    tagsEqual(p.floatTags, s.floatTags);
  if (!fieldsMatch) return false;
  if (s.floatSchedulingActive === null) return true;
  return p.active === s.floatSchedulingActive;
}

function roleNameForTask(
  task: FloatTaskWithRoleJson,
  floatPerson: FloatPersonJson | undefined,
  roleIdToName: Map<number, string>
): string {
  const tr = num(task.role_id);
  const pr = floatPerson ? num(floatPerson.role_id) : null;
  const rid = tr ?? pr;
  if (rid == null) return "";
  return roleIdToName.get(rid) ?? "";
}

/**
 * Last task per (Float project, Float person) wins for role name (CSV: last row wins).
 */
function buildFloatPairRoles(
  tasks: FloatTaskWithRoleJson[],
  peopleByFloatId: Map<number, FloatPersonJson>,
  roleIdToName: Map<number, string>
): Map<string, string> {
  const pairToRole = new Map<string, string>();
  for (const task of tasks) {
    const pid = num(task.project_id);
    if (pid == null) continue;
    const ids: number[] = [];
    if (task.people_ids?.length) {
      for (const x of task.people_ids) {
        const n = num(x);
        if (n != null) ids.push(n);
      }
    } else {
      const one = num(task.people_id);
      if (one != null) ids.push(one);
    }
    for (const peid of ids) {
      const fp = peopleByFloatId.get(peid);
      pairToRole.set(`${pid}|${peid}`, roleNameForTask(task, fp, roleIdToName));
    }
  }
  return pairToRole;
}

function resolveDbProject(
  floatProjectId: number,
  floatName: string,
  projects: Project[],
  projectsByNameLower: Map<string, string>
): Project | undefined {
  const ext = String(floatProjectId);
  const byExt = projects.find((p) => p.floatExternalId === ext);
  if (byExt) return byExt;
  const p = projects.find(
    (x) => normalizeProjectNameForLookup(x.name) === normalizeProjectNameForLookup(floatName)
  );
  if (p) return p;
  const direct = projectsByNameLower.get(floatName.toLowerCase());
  if (direct) return projects.find((x) => x.id === direct);
  return undefined;
}

/**
 * Sync Float `/v3/people` into Person rows (names + externalId + Float metadata). Updates `personByName` (lowercase → id).
 */
export async function syncPeopleFromFloatList(
  prisma: PrismaClient,
  floatPeople: FloatPersonJson[],
  personByName: Map<string, string>,
  newPersonNames: string[],
  regionNameByFloatId: Map<number, string>
): Promise<void> {
  const floatExtIds = [...new Set(floatPeople.map((fp) => String(fp.people_id)))];
  const floatNameLowers = [
    ...new Set(
      floatPeople
        .map((fp) => (fp.name ?? "").trim().toLowerCase())
        .filter((n) => n.length > 0)
    ),
  ];

  let allDb: Person[];
  if (floatExtIds.length === 0 && floatNameLowers.length === 0) {
    allDb = [];
  } else {
    allDb = await prisma.$queryRaw<Person[]>(Prisma.sql`
      SELECT * FROM "Person"
      WHERE (${floatExtIds.length > 0
        ? Prisma.sql`"externalId" IN (${Prisma.join(
            floatExtIds.map((id) => Prisma.sql`${id}`)
          )})`
        : Prisma.sql`false`})
        OR (${floatNameLowers.length > 0
        ? Prisma.sql`LOWER("name") IN (${Prisma.join(
            floatNameLowers.map((n) => Prisma.sql`${n}`)
          )})`
        : Prisma.sql`false`})
    `);
  }
  const byExternal = new Map<string, (typeof allDb)[0]>();
  for (const p of allDb) {
    if (p.externalId) byExternal.set(p.externalId, p);
  }

  for (const fp of floatPeople) {
    const ext = String(fp.people_id);
    const sync = buildFloatPersonSyncData(fp, regionNameByFloatId);
    const { name, email, floatRegionId, floatRegionName } = sync;

    let person = byExternal.get(ext);
    if (!person) {
      person = allDb.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (person && person.externalId !== ext) {
        await prisma.person.update({
          where: { id: person.id },
          data: {
            externalId: ext,
            email,
            floatRegionId,
            floatRegionName,
            floatJobTitle: sync.floatJobTitle,
            floatDepartmentName: sync.floatDepartmentName,
            floatTags: floatTagsForWrite(sync.floatTags),
            floatSchedulingActive: sync.floatSchedulingActive,
            floatAccessLabel: sync.floatAccessLabel,
            ...workbenchActiveDataFromFloatScheduling(sync.floatSchedulingActive),
          },
        });
        const merged = {
          ...person,
          externalId: ext,
          email: sync.email,
          floatRegionId: sync.floatRegionId,
          floatRegionName: sync.floatRegionName,
          floatJobTitle: sync.floatJobTitle,
          floatDepartmentName: sync.floatDepartmentName,
          floatTags: sync.floatTags as Prisma.JsonValue | null,
          floatSchedulingActive: sync.floatSchedulingActive,
          floatAccessLabel: sync.floatAccessLabel,
          active: personActiveAfterFloatSync(person.active, sync.floatSchedulingActive),
        };
        const idx = allDb.findIndex((p) => p.id === person!.id);
        if (idx >= 0) allDb[idx] = merged;
        person = merged;
        byExternal.set(ext, person);
      }
    }
    if (!person) {
      person = await prisma.person.create({
        data: {
          name,
          externalId: ext,
          email,
          floatRegionId,
          floatRegionName,
          floatJobTitle: sync.floatJobTitle,
          floatDepartmentName: sync.floatDepartmentName,
          floatTags: floatTagsForWrite(sync.floatTags),
          floatSchedulingActive: sync.floatSchedulingActive,
          floatAccessLabel: sync.floatAccessLabel,
          ...workbenchActiveDataFromFloatScheduling(sync.floatSchedulingActive),
        },
      });
      allDb.push(person);
      byExternal.set(ext, person);
      if (!newPersonNames.includes(name)) newPersonNames.push(name);
    } else if (person != null && !floatPersonSyncMatchesDb(person, sync)) {
      const rowPerson = person;
      await prisma.person.update({
        where: { id: rowPerson.id },
        data: {
          name,
          email,
          floatRegionId,
          floatRegionName,
          floatJobTitle: sync.floatJobTitle,
          floatDepartmentName: sync.floatDepartmentName,
          floatTags: floatTagsForWrite(sync.floatTags),
          floatSchedulingActive: sync.floatSchedulingActive,
          floatAccessLabel: sync.floatAccessLabel,
          ...workbenchActiveDataFromFloatScheduling(sync.floatSchedulingActive),
        },
      });
      person = {
        ...rowPerson,
        name,
        email,
        floatRegionId,
        floatRegionName,
        floatJobTitle: sync.floatJobTitle,
        floatDepartmentName: sync.floatDepartmentName,
        floatTags: sync.floatTags as Prisma.JsonValue | null,
        floatSchedulingActive: sync.floatSchedulingActive,
        floatAccessLabel: sync.floatAccessLabel,
        active: personActiveAfterFloatSync(rowPerson.active, sync.floatSchedulingActive),
      };
      const idx = allDb.findIndex((p) => p.id === rowPerson.id);
      if (idx >= 0) allDb[idx] = person;
    }

    if (!person) {
      throw new Error("syncPeopleFromFloatList: failed to resolve Person for Float people_id");
    }
    personByName.set(person.name.toLowerCase(), person.id);
  }
}

export type ExecuteFloatApiSyncParams = {
  /** YYYY-MM-DD inclusive (Float API). Defaults to ~±12 months from today UTC. */
  startDate?: string;
  endDate?: string;
  /** Session user id for FloatImportRun.uploadedByUserId (optional). */
  uploadedByUserId?: string | null;
};

export type ExecuteFloatApiSyncResult = {
  run: { id: string; completedAt: Date };
  unknownRoles: string[];
  touchedProjectIds: string[];
};

/**
 * Fetch Float reference data + tasks, map to internal projects/people, apply the same DB effects as CSV import.
 */
export async function executeFloatApiSync(
  prisma: PrismaClient,
  client: FloatClient,
  params?: ExecuteFloatApiSyncParams
): Promise<ExecuteFloatApiSyncResult> {
  const uploadedByUserId = params?.uploadedByUserId ?? null;
  const range = defaultFloatSyncDateRange();
  const startDate = params?.startDate?.trim() || range.start;
  const endDate = params?.endDate?.trim() || range.end;

  const windowStart = new Date(`${startDate}T00:00:00.000Z`);
  const windowEnd = new Date(`${endDate}T23:59:59.999Z`);

  const [
    knownRoles,
    floatPeople,
    floatProjects,
    floatClients,
    floatRolesList,
    tasks,
    timeOffs,
    publicHolidays,
    teamHolidays,
  ] = await Promise.all([
    prisma.role.findMany(),
    client.listAllPages<FloatPersonJson>("/v3/people", { expand: "account" }),
    client.listAllPages<FloatProjectJson>("/v3/projects"),
    client.listAllPages<FloatClientJson>("/v3/clients"),
    client.listAllPages<FloatRoleJson>("/v3/roles"),
    client.listAllPages<FloatTaskWithRoleJson>("/v3/tasks", {
      start_date: startDate,
      end_date: endDate,
    }),
    client.listAllPages<FloatTimeOffJson>("/v3/timeoffs", {
      start_date: startDate,
      end_date: endDate,
    }),
    client.listAllPages<Record<string, unknown>>("/v3/public-holidays", {
      start_date: startDate,
      end_date: endDate,
    }),
    client
      .listAllPages<Record<string, unknown>>("/v3/holidays")
      .then((rows) =>
        filterHolidayRowsOverlappingYmdWindow(rows, startDate, endDate)
      ),
  ]);

  const tasksForSync = dedupeFloatTasksForAggregation(tasks);

  const { resolveFloatRoleNameToWorkbenchId } = buildWorkbenchRoleLookup(knownRoles);
  const roleIdToName = new Map<number, string>();
  for (const r of floatRolesList) {
    const id = num(r.role_id);
    if (id != null && r.name) roleIdToName.set(id, r.name);
  }

  const clientIdToName = new Map<number, string>();
  for (const c of floatClients) {
    const id = num(c.client_id);
    if (id != null) clientIdToName.set(id, c.name ?? "");
  }

  const floatProjectById = new Map<number, { name: string; client_id?: number }>();
  for (const p of floatProjects) {
    const id = num(p.project_id);
    if (id == null) continue;
    const cid = num(p.client_id);
    floatProjectById.set(id, {
      name: p.name ?? `Project ${id}`,
      client_id: cid ?? undefined,
    });
  }

  const peopleByFloatId = new Map<number, FloatPersonJson>();
  for (const fp of floatPeople) {
    const id = num(fp.people_id);
    if (id != null) peopleByFloatId.set(id, fp);
  }

  const regionNameByFloatId = buildFloatRegionNameMap(
    publicHolidays,
    teamHolidays,
    floatPeople as Array<Record<string, unknown>>
  );
  const personByName = new Map<string, string>();
  const newPersonNames: string[] = [];
  await syncPeopleFromFloatList(
    prisma,
    floatPeople,
    personByName,
    newPersonNames,
    regionNameByFloatId
  );

  const projects = await prisma.project.findMany();
  const projectsByNameLower = new Map(
    projects.map((p) => [p.name.toLowerCase(), p.id] as const)
  );

  for (const [fid, meta] of floatProjectById) {
    const match = resolveDbProject(fid, meta.name, projects, projectsByNameLower);
    if (match && !match.floatExternalId) {
      await prisma.project.update({
        where: { id: match.id },
        data: { floatExternalId: String(fid) },
      });
      match.floatExternalId = String(fid);
    }
  }

  const projectsByNameReloaded = new Map<string, string>(
    projects.map((p) => [p.name.toLowerCase(), p.id] as const)
  );

  const pairRoles = buildFloatPairRoles(tasksForSync, peopleByFloatId, roleIdToName);

  const excludedUtcDatesByFloatPeopleId = buildExcludedUtcDatesByFloatPeopleId({
    floatPeople: floatPeople as Array<Record<string, unknown>>,
    timeOffs,
    publicHolidays,
    teamHolidays,
  });

  const weeklyMap = aggregateTasksToWeeklyHours(tasksForSync, {
    window: { start: windowStart, end: windowEnd },
    weekdaysOnly: true,
    excludedUtcDatesByFloatPeopleId,
  });
  const hourRows = weeklyHoursMapToRows(weeklyMap);

  const mergedFloatByProjectPerson = new Map<string, MergedFloatEntry>();
  const unknownRoles: string[] = [];

  for (const row of hourRows) {
    const fpMeta = floatProjectById.get(row.floatProjectId);
    if (!fpMeta) continue;
    const floatPerson = peopleByFloatId.get(row.floatPeopleId);
    const personName = floatPerson?.name?.trim() || `Float ${row.floatPeopleId}`;
    const projectName = fpMeta.name;
    const roleName =
      pairRoles.get(`${row.floatProjectId}|${row.floatPeopleId}`) ?? "";

    if (
      roleName.trim() &&
      !resolveFloatRoleNameToWorkbenchId(roleName) &&
      !unknownRoles.includes(roleName)
    ) {
      unknownRoles.push(roleName);
    }

    /** One entry per Float (project_id, people_id), not per display name — duplicate project names in Float would otherwise sum hours into one inflated total. */
    const mergeKey = `${row.floatProjectId}|${row.floatPeopleId}`;
    let entry = mergedFloatByProjectPerson.get(mergeKey);
    if (!entry) {
      entry = {
        projectName,
        personName,
        roleName,
        weekMap: new Map<string, number>(),
        floatProjectId: row.floatProjectId,
      };
      mergedFloatByProjectPerson.set(mergeKey, entry);
    } else {
      entry.roleName = roleName;
    }
    entry.weekMap.set(
      row.weekStartKey,
      (entry.weekMap.get(row.weekStartKey) ?? 0) + row.hours
    );
  }

  /** Tasks with 0h/day (or all days excluded) produce no hour rows; still upsert assignments. */
  for (const task of tasksForSync) {
    const pid = num(task.project_id);
    if (pid == null) continue;
    const peopleIds: number[] = [];
    if (task.people_ids?.length) {
      for (const x of task.people_ids) {
        const n = num(x);
        if (n != null) peopleIds.push(n);
      }
    } else {
      const one = num(task.people_id);
      if (one != null) peopleIds.push(one);
    }
    for (const peid of peopleIds) {
      const mergeKey = `${pid}|${peid}`;
      if (mergedFloatByProjectPerson.has(mergeKey)) continue;
      const fpMeta = floatProjectById.get(pid);
      if (!fpMeta) continue;
      const floatPerson = peopleByFloatId.get(peid);
      const personName = floatPerson?.name?.trim() || `Float ${peid}`;
      const projectName = fpMeta.name;
      const roleName = pairRoles.get(`${pid}|${peid}`) ?? "";
      if (
        roleName.trim() &&
        !resolveFloatRoleNameToWorkbenchId(roleName) &&
        !unknownRoles.includes(roleName)
      ) {
        unknownRoles.push(roleName);
      }
      mergedFloatByProjectPerson.set(mergeKey, {
        projectName,
        personName,
        roleName,
        weekMap: new Map<string, number>(),
        floatProjectId: pid,
      });
    }
  }

  const projectNamesSet = new Set<string>();
  for (const e of mergedFloatByProjectPerson.values()) {
    projectNamesSet.add(e.projectName);
  }

  const projectAssignmentsMap = new Map<
    string,
    Array<{ personName: string; roleName: string }>
  >();
  const projectToClientMap = new Map<string, string>();

  const projectNames = Array.from(projectNamesSet).sort();

  for (const pname of projectNames) {
    const fpMeta = [...floatProjectById.values()].find((m) => m.name === pname);
    if (!fpMeta) continue;
    const cid = fpMeta.client_id;
    if (cid != null) {
      const cn = clientIdToName.get(cid);
      if (cn) projectToClientMap.set(pname, cn);
    }
  }

  for (const e of mergedFloatByProjectPerson.values()) {
    if (!projectAssignmentsMap.has(e.projectName)) {
      projectAssignmentsMap.set(e.projectName, []);
    }
    const arr = projectAssignmentsMap.get(e.projectName)!;
    const existing = arr.find(
      (a) => a.personName.toLowerCase() === e.personName.toLowerCase()
    );
    if (existing) {
      existing.roleName = e.roleName;
    } else {
      arr.push({ personName: e.personName, roleName: e.roleName });
    }
  }

  const projectAssignments = JSON.parse(
    JSON.stringify(Object.fromEntries(projectAssignmentsMap))
  ) as Record<string, Array<{ personName: string; roleName: string }>>;
  const projectClients = JSON.parse(
    JSON.stringify(Object.fromEntries(projectToClientMap))
  ) as Record<string, string>;

  const asOf = getAsOfDate();

  const fallbackRoleIdForAssignment = getFallbackRoleIdForNewAssignment(knownRoles);

  return applyFloatImportDatabaseEffects(prisma, {
    asOf,
    uploadedByUserId,
    mergedFloatByProjectPerson,
    projectNames,
    projectAssignments,
    projectToClientMap: projectClients,
    unknownRoles,
    newPersonNames,
    projectsByName: projectsByNameReloaded,
    projectsForResolution: projects.map((p) => ({
      id: p.id,
      name: p.name,
      floatExternalId: p.floatExternalId,
    })),
    personByName,
    workbenchRoles: knownRoles,
    fallbackRoleIdForAssignment,
    ptoHolidaySync: {
      startYmd: startDate,
      endYmd: endDate,
      timeOffs,
      publicHolidays: publicHolidays as Array<Record<string, unknown>>,
      teamHolidays: teamHolidays as Array<Record<string, unknown>>,
    },
    floatApiSyncWindow: { start: windowStart, end: windowEnd },
  });
}
