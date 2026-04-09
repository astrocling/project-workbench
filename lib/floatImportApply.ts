/**
 * Shared DB effects for Float scheduled hours import (Float API sync; legacy CSV flows removed).
 * Must stay aligned with docs/TECHNICAL.md and `__tests__/api/admin/float-import-cleanup.test.ts`.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  applyPtoHolidaySyncWriters,
  type PtoHolidaySyncPayload,
} from "@/lib/float/ptoholidaySyncWriters";
import {
  buildWorkbenchRoleLookup,
  getFallbackRoleIdForNewAssignment,
  resolveJobTitleToWorkbenchId,
  type WorkbenchRoleRow,
} from "@/lib/float/roleWorkbenchMatch";
import { projectAssignmentHasSyncRoleFromFloatColumn } from "@/lib/projectAssignmentSyncColumn";
import { normalizeProjectNameForLookup } from "@/lib/floatImportUtils";
import { isCompletedWeek } from "@/lib/weekUtils";

/** Chunk size for bulk FloatScheduledHours upserts to avoid huge queries. */
export const FLOAT_HOURS_BATCH_SIZE = 500;

/**
 * Deletes future (weekStartDate > asOf) FloatScheduledHours rows for the given (projectId, personId)
 * pairs in one statement — avoids large OR trees and N-per-pair deleteMany loops.
 */
export async function deleteFutureFloatScheduledHoursForPairs(
  prisma: PrismaClient,
  asOf: Date,
  pairs: Array<{ projectId: string; personId: string }>
): Promise<void> {
  if (pairs.length === 0) return;
  const distinct = [
    ...new Map(
      pairs.map((p) => [`${p.projectId}|${p.personId}`, p] as const)
    ).values(),
  ];
  await prisma.$executeRaw`
    DELETE FROM "FloatScheduledHours"
    WHERE "weekStartDate" > ${asOf}
    AND ("projectId", "personId") IN (
      ${Prisma.join(
        distinct.map((p) => Prisma.sql`(${p.projectId}, ${p.personId})`),
        ", "
      )}
    )
  `;
}

/**
 * Bulk `ProjectAssignment` upserts per statement. A single interactive transaction with thousands
 * of Prisma `upsert()` calls hits the default 5s transaction timeout.
 */
export const ASSIGNMENT_UPSERT_BATCH_SIZE = 500;

export type MergedFloatEntry = {
  projectName: string;
  personName: string;
  roleName: string;
  weekMap: Map<string, number>;
  /**
   * Float API `project_id` for this row. When set with `projectsForResolution`, hours only
   * attach to a Workbench project whose `floatExternalId` matches, or whose name matches and
   * `floatExternalId` is null / not conflicting — so two Float projects with the same name
   * do not sum onto one DB row incorrectly.
   */
  floatProjectId?: number;
};

/** Resolve Workbench project id for a merged Float entry (API sync sets `floatProjectId`). */
export function resolveProjectIdForMergedFloatEntry(
  entry: MergedFloatEntry,
  projectsByName: Map<string, string>,
  projectsForResolution?: Array<{ id: string; name: string; floatExternalId: string | null }>
): string | undefined {
  if (projectsForResolution?.length && entry.floatProjectId != null) {
    const fid = String(entry.floatProjectId);
    const byExt = projectsForResolution.find((p) => p.floatExternalId === fid);
    if (byExt) return byExt.id;
    const norm = normalizeProjectNameForLookup(entry.projectName);
    for (const p of projectsForResolution) {
      if (normalizeProjectNameForLookup(p.name) !== norm) continue;
      if (p.floatExternalId != null && p.floatExternalId !== fid) continue;
      return p.id;
    }
    return undefined;
  }
  return projectsByName.get(entry.projectName.toLowerCase());
}

/**
 * Upsert assignments, FloatScheduledHours for incomplete weeks from the merge, future cleanup, and
 * FloatImportRun.
 *
 * For each (project, person) that has **at least one incomplete-week hour** in this merge, all
 * **incomplete** float rows (`weekStartDate` > `asOf`) for that pair are removed first, then rows
 * from this run are upserted — except when `floatApiSyncWindow` is set (Float API sync): then no
 * pre-upsert delete runs for those pairs, so CSV / backfill hours that the API snapshot omits are
 * not wiped (upserts only add or overwrite weeks present in this merge). Pairs that only have
 * completed-week rollups in this run do **not** get a blanket future delete. **Completed** weeks
 * (`weekStartDate` ≤ `asOf`) are never deleted or updated. People removed from the merge still have
 * future rows cleared by the separate removed-person pass.
 */
export async function applyFloatImportDatabaseEffects(
  prisma: PrismaClient,
  params: {
    asOf: Date;
    uploadedByUserId: string | null;
    mergedFloatByProjectPerson: Map<string, MergedFloatEntry>;
    projectNames: string[];
    projectAssignments: Record<string, Array<{ personName: string; roleName: string }>>;
    projectToClientMap: Record<string, string>;
    unknownRoles: string[];
    newPersonNames: string[];
    projectsByName: Map<string, string>;
    /** When provided (API sync), ties hours to the correct project when names collide in Float. */
    projectsForResolution?: Array<{ id: string; name: string; floatExternalId: string | null }>;
    personByName: Map<string, string>;
    /** All Workbench `Role` rows — used to resolve Float labels and compute fallback for new rows. */
    workbenchRoles: WorkbenchRoleRow[];
    /**
     * When Float task/person has no resolvable role name, or the name does not match a Workbench
     * `Role`, use this id for **new** `ProjectAssignment` rows only (existing rows keep their role).
     * Defaults via {@link getFallbackRoleIdForNewAssignment} when omitted.
     */
    fallbackRoleIdForAssignment?: string | null;
    /** When set (Float API sync), persists PTO and regional holidays into `PTOHolidayImpact`. */
    ptoHolidaySync?: PtoHolidaySyncPayload;
    /**
     * When set (Float API sync), skips the pre-upsert “delete all future hours for this pair” step
     * so backfilled rows survive; merge weeks are still upserted. Window bounds are informational
     * for callers (same range as the task fetch).
     */
    floatApiSyncWindow?: { start: Date; end: Date };
  }
): Promise<{
  run: { id: string; completedAt: Date };
  unknownRoles: string[];
  /** Workbench project ids affected by this apply (merge + import project scope); for cache revalidation. */
  touchedProjectIds: string[];
}> {
  const {
    asOf,
    uploadedByUserId,
    mergedFloatByProjectPerson,
    projectNames,
    projectAssignments,
    projectToClientMap,
    unknownRoles,
    newPersonNames,
    projectsByName,
    projectsForResolution,
    personByName,
    workbenchRoles,
    fallbackRoleIdForAssignment,
    ptoHolidaySync,
    floatApiSyncWindow,
  } = params;

  const projectNamesSet = new Set(projectNames);

  const { resolveFloatRoleNameToWorkbenchId } = buildWorkbenchRoleLookup(workbenchRoles);
  const fallbackForNew =
    fallbackRoleIdForAssignment ?? getFallbackRoleIdForNewAssignment(workbenchRoles) ?? null;

  const pairList: Array<{ projectId: string; personId: string }> = [];
  for (const entry of mergedFloatByProjectPerson.values()) {
    const projectId = resolveProjectIdForMergedFloatEntry(
      entry,
      projectsByName,
      projectsForResolution
    );
    if (!projectId) continue;
    const personId = personByName.get(entry.personName.toLowerCase());
    if (!personId) continue;
    pairList.push({ projectId, personId });
  }
  const pairDedup = [
    ...new Map(pairList.map((p) => [`${p.projectId}|${p.personId}`, p] as const)).values(),
  ];

  const personIdsUnique = [...new Set(pairDedup.map((p) => p.personId))];
  const floatJobTitleByPersonId = new Map<string, string | null>();
  if (personIdsUnique.length > 0) {
    const peopleRows = await prisma.person.findMany({
      where: { id: { in: personIdsUnique } },
      select: { id: true, floatJobTitle: true },
    });
    for (const p of peopleRows) {
      floatJobTitleByPersonId.set(p.id, p.floatJobTitle);
    }
  }

  const hasSyncRoleCol = await projectAssignmentHasSyncRoleFromFloatColumn(prisma);

  const existingAssignmentByPair = new Map<
    string,
    { roleId: string; syncRoleFromFloat: boolean }
  >();
  for (let i = 0; i < pairDedup.length; i += ASSIGNMENT_UPSERT_BATCH_SIZE) {
    const slice = pairDedup.slice(i, i + ASSIGNMENT_UPSERT_BATCH_SIZE);
    if (slice.length === 0) continue;
    const rows = hasSyncRoleCol
      ? await prisma.projectAssignment.findMany({
          where: { OR: slice.map((p) => ({ projectId: p.projectId, personId: p.personId })) },
          select: {
            projectId: true,
            personId: true,
            roleId: true,
            syncRoleFromFloat: true,
          },
        })
      : await prisma.projectAssignment.findMany({
          where: { OR: slice.map((p) => ({ projectId: p.projectId, personId: p.personId })) },
          select: { projectId: true, personId: true, roleId: true },
        });
    for (const r of rows) {
      const syncFloat =
        hasSyncRoleCol && "syncRoleFromFloat" in r && typeof r.syncRoleFromFloat === "boolean"
          ? r.syncRoleFromFloat
          : true;
      existingAssignmentByPair.set(`${r.projectId}|${r.personId}`, {
        roleId: r.roleId,
        syncRoleFromFloat: syncFloat,
      });
    }
  }

  const assignmentUpdates = new Map<
    string,
    { projectId: string; personId: string; roleId: string }
  >();

  for (const entry of mergedFloatByProjectPerson.values()) {
    const projectId = resolveProjectIdForMergedFloatEntry(
      entry,
      projectsByName,
      projectsForResolution
    );
    if (!projectId) continue;
    const personId = personByName.get(entry.personName.toLowerCase());
    if (!personId) continue;
    const pairKey = `${projectId}|${personId}`;
    const existing = existingAssignmentByPair.get(pairKey);
    const fromJobTitle = resolveJobTitleToWorkbenchId(
      floatJobTitleByPersonId.get(personId) ?? null,
      workbenchRoles
    );
    const fromFloatRole = resolveFloatRoleNameToWorkbenchId(entry.roleName);

    let roleId: string | undefined;
    if (existing && !existing.syncRoleFromFloat) {
      roleId = existing.roleId;
    } else if (fromJobTitle) {
      roleId = fromJobTitle;
    } else if (fromFloatRole) {
      roleId = fromFloatRole;
    } else if (existing) {
      roleId = existing.roleId;
    } else if (fallbackForNew) {
      roleId = fallbackForNew;
    }
    if (!roleId) continue;
    assignmentUpdates.set(`${projectId}:${personId}`, { projectId, personId, roleId });
  }

  const assignmentRows = Array.from(assignmentUpdates.values());
  for (let i = 0; i < assignmentRows.length; i += ASSIGNMENT_UPSERT_BATCH_SIZE) {
    const chunk = assignmentRows.slice(i, i + ASSIGNMENT_UPSERT_BATCH_SIZE);
    if (chunk.length === 0) continue;
    if (hasSyncRoleCol) {
      await prisma.$executeRaw`
        INSERT INTO "ProjectAssignment" ("projectId", "personId", "roleId", "syncRoleFromFloat", "createdAt", "updatedAt")
        VALUES ${Prisma.join(
          chunk.map((r) =>
            Prisma.sql`(${Prisma.join([r.projectId, r.personId, r.roleId])}, true, now(), now())`
          )
        )}
        ON CONFLICT ("projectId", "personId")
        DO UPDATE SET "roleId" = EXCLUDED."roleId", "updatedAt" = now()
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "ProjectAssignment" ("projectId", "personId", "roleId", "createdAt", "updatedAt")
        VALUES ${Prisma.join(
          chunk.map((r) =>
            Prisma.sql`(${Prisma.join([r.projectId, r.personId, r.roleId])}, now(), now())`
          )
        )}
        ON CONFLICT ("projectId", "personId")
        DO UPDATE SET "roleId" = EXCLUDED."roleId", "updatedAt" = now()
      `;
    }
  }

  const projectFloatHoursMap = new Map<
    string,
    Array<{
      personName: string;
      roleName: string;
      weeks: Array<{ weekStart: string; hours: number }>;
    }>
  >();

  for (const entry of mergedFloatByProjectPerson.values()) {
    const weeks = Array.from(entry.weekMap.entries())
      .map(([weekStart, hours]) => ({ weekStart, hours }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    if (weeks.length === 0) continue;
    if (!projectFloatHoursMap.has(entry.projectName)) {
      projectFloatHoursMap.set(entry.projectName, []);
    }
    projectFloatHoursMap.get(entry.projectName)!.push({
      personName: entry.personName,
      roleName: entry.roleName,
      weeks,
    });
  }

  const floatHoursAgg = new Map<
    string,
    { projectId: string; personId: string; weekStartDate: Date; hours: number }
  >();

  for (const entry of mergedFloatByProjectPerson.values()) {
    const projectId = resolveProjectIdForMergedFloatEntry(
      entry,
      projectsByName,
      projectsForResolution
    );
    if (!projectId) continue;
    const personId = personByName.get(entry.personName.toLowerCase());
    if (!personId) continue;
    for (const [weekStart, hours] of entry.weekMap) {
      const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`);
      const aggKey = `${projectId}|${personId}|${weekStart}`;
      const prev = floatHoursAgg.get(aggKey);
      if (prev) {
        prev.hours += hours;
      } else {
        floatHoursAgg.set(aggKey, { projectId, personId, weekStartDate, hours });
      }
    }
  }

  const floatHoursRows = Array.from(floatHoursAgg.values());

  const floatHoursRowsToWrite = floatHoursRows.filter(
    (r) => !isCompletedWeek(r.weekStartDate, asOf)
  );

  const projectIdsInImport = Array.from(projectNamesSet)
    .map((name) => projectsByName.get(name.toLowerCase()))
    .filter((id): id is string => Boolean(id));

  const touchedProjectIds = new Set<string>();
  for (const id of projectIdsInImport) touchedProjectIds.add(id);
  for (const entry of mergedFloatByProjectPerson.values()) {
    const pid = resolveProjectIdForMergedFloatEntry(
      entry,
      projectsByName,
      projectsForResolution
    );
    if (pid) touchedProjectIds.add(pid);
  }

  const inImportSet = new Set<string>();
  for (const entry of mergedFloatByProjectPerson.values()) {
    const projectId = resolveProjectIdForMergedFloatEntry(
      entry,
      projectsByName,
      projectsForResolution
    );
    const personId = personByName.get(entry.personName.toLowerCase());
    if (projectId && personId) inImportSet.add(`${projectId}|${personId}`);
  }

  const pairsWithFutureWrites = new Set<string>();
  for (const r of floatHoursRowsToWrite) {
    pairsWithFutureWrites.add(`${r.projectId}|${r.personId}`);
  }

  if (pairsWithFutureWrites.size > 0 && !floatApiSyncWindow) {
    const orPairs = Array.from(pairsWithFutureWrites).map((key) => {
      const [projectId, personId] = key.split("|");
      return { projectId, personId };
    });
    await deleteFutureFloatScheduledHoursForPairs(prisma, asOf, orPairs);
  }

  for (let i = 0; i < floatHoursRowsToWrite.length; i += FLOAT_HOURS_BATCH_SIZE) {
    const chunk = floatHoursRowsToWrite.slice(i, i + FLOAT_HOURS_BATCH_SIZE);
    if (chunk.length === 0) continue;
    await prisma.$executeRaw`
      INSERT INTO "FloatScheduledHours" ("projectId", "personId", "weekStartDate", "hours", "createdAt", "updatedAt")
      VALUES ${Prisma.join(
        chunk.map((r) =>
          Prisma.sql`(${Prisma.join([r.projectId, r.personId, r.weekStartDate, r.hours])}, now(), now())`
        )
      )}
      ON CONFLICT ("projectId", "personId", "weekStartDate")
      DO UPDATE SET hours = EXCLUDED.hours, "updatedAt" = now()
    `;
  }

  if (projectIdsInImport.length > 0) {
    const futureFloatRows = await prisma.floatScheduledHours.findMany({
      where: {
        projectId: { in: projectIdsInImport },
        weekStartDate: { gt: asOf },
      },
      select: { projectId: true, personId: true },
      distinct: ["projectId", "personId"],
    });
    const removedPairs = futureFloatRows.filter(
      (r) => !inImportSet.has(`${r.projectId}|${r.personId}`)
    );
    if (removedPairs.length > 0) {
      await deleteFutureFloatScheduledHoursForPairs(prisma, asOf, removedPairs);
    }
  }

  if (ptoHolidaySync) {
    await applyPtoHolidaySyncWriters(prisma, ptoHolidaySync);
  }

  const projectFloatHours = JSON.parse(
    JSON.stringify(Object.fromEntries(projectFloatHoursMap))
  ) as Record<
    string,
    Array<{
      personName: string;
      roleName: string;
      weeks: Array<{ weekStart: string; hours: number }>;
    }>
  >;

  const completedAt = new Date();
  const unknownRolesJson = JSON.stringify(unknownRoles);
  const newPersonNamesJson = JSON.stringify(newPersonNames);
  const projectNamesJson = JSON.stringify(projectNames);
  const projectAssignmentsJson = JSON.stringify(projectAssignments);
  const projectFloatHoursJson = JSON.stringify(projectFloatHours);
  const projectClientsJson = JSON.stringify(projectToClientMap);

  const [run] = await prisma.$queryRaw<Array<{ id: string; completedAt: Date }>>`
    INSERT INTO "FloatImportRun" (
      "id", "completedAt", "uploadedByUserId",
      "unknownRoles", "newPersonNames", "projectNames", "projectAssignments", "projectFloatHours", "projectClients"
    )
    VALUES (
      gen_random_uuid()::text,
      ${completedAt}::timestamptz,
      ${uploadedByUserId},
      ${unknownRolesJson}::jsonb,
      ${newPersonNamesJson}::jsonb,
      ${projectNamesJson}::jsonb,
      ${projectAssignmentsJson}::jsonb,
      ${projectFloatHoursJson}::jsonb,
      ${projectClientsJson}::jsonb
    )
    RETURNING id, "completedAt" as "completedAt"
  `;

  return {
    run: {
      id: run?.id ?? "",
      completedAt: run?.completedAt ?? completedAt,
    },
    unknownRoles,
    touchedProjectIds: Array.from(touchedProjectIds),
  };
}
