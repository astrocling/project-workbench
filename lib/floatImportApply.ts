/**
 * Shared DB effects for Float scheduled hours import (Float API sync; legacy CSV flows removed).
 * Must stay aligned with docs/TECHNICAL.md and `__tests__/api/admin/float-import-cleanup.test.ts`.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { normalizeProjectNameForLookup } from "@/lib/floatImportUtils";
import { isCompletedWeek } from "@/lib/weekUtils";

/** Chunk size for bulk FloatScheduledHours upserts to avoid huge queries. */
export const FLOAT_HOURS_BATCH_SIZE = 500;

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
 * Upsert assignments, future-only FloatScheduledHours, future cleanup, and FloatImportRun.
 * Past weeks are never overwritten or deleted.
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
    roleById: Map<string, string>;
  }
): Promise<{
  run: { id: string; completedAt: Date };
  unknownRoles: string[];
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
    roleById,
  } = params;

  const projectNamesSet = new Set(projectNames);

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
    const roleId = roleById.get(entry.roleName.toLowerCase());
    if (!roleId) continue;
    assignmentUpdates.set(`${projectId}:${personId}`, { projectId, personId, roleId });
  }

  if (assignmentUpdates.size > 0) {
    await prisma.$transaction(
      Array.from(assignmentUpdates.values()).map(({ projectId, personId, roleId }) =>
        prisma.projectAssignment.upsert({
          where: {
            projectId_personId: { projectId, personId },
          },
          create: { projectId, personId, roleId },
          update: { roleId },
        })
      )
    );
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

  const projectIdsInImport = Array.from(projectNamesSet)
    .map((name) => projectsByName.get(name.toLowerCase()))
    .filter((id): id is string => Boolean(id));

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
      for (const pair of removedPairs) {
        await prisma.floatScheduledHours.deleteMany({
          where: {
            projectId: pair.projectId,
            personId: pair.personId,
            weekStartDate: { gt: asOf },
          },
        });
      }
    }
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
  };
}
