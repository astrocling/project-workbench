import { NextRequest, NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import {
  batchUpsertFloatScheduledHours,
  floatScheduledHourRowsFromMergedLists,
} from "@/lib/backfillFloatFromImports";
import { getProjectDataFromAllImports } from "@/lib/floatImportUtils";
import {
  buildWorkbenchRoleLookup,
  resolveRoleIdForNewAssignmentFromFloat,
} from "@/lib/float/roleWorkbenchMatch";
import { slugify, ensureUniqueSlug } from "@/lib/slug";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().min(1),
  startDate: z.union([z.string(), z.date()]),
  endDate: z.union([z.string(), z.date()]),
  status: z.enum(["Active", "Closed"]).default("Active"),
  floatProjectName: z.string().optional(),
  sowLink: z.string().max(2048).nullable().optional(),
  estimateLink: z.string().max(2048).nullable().optional(),
  floatLink: z.string().max(2048).nullable().optional(),
  metricLink: z.string().max(2048).nullable().optional(),
  pmPersonIds: z.array(z.string()).optional(),
  pgmPersonId: z.string().optional().nullable(),
  cadPersonId: z.string().optional().nullable(),
  cdaEnabled: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const getCachedProjectsList = unstable_cache(
    async () => {
      return prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          clientName: true,
          status: true,
          startDate: true,
          endDate: true,
          cdaEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    },
    ["projects-list"],
    { revalidate: 60, tags: ["projects-list"] }
  );

  const projects = await getCachedProjectsList();

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });

  const floatProjectClients = (lastImport?.projectClients as Record<string, string> | null | undefined) ?? {};
  const existingProjectClients = Object.fromEntries(
    projects.map((p) => [p.name, p.clientName])
  );
  const floatProjectNames = (lastImport?.projectNames as string[]) ?? [];

  return NextResponse.json({
    projects,
    floatLastUpdated: lastImport?.completedAt ?? null,
    floatProjectNames,
    floatProjectClients: Object.fromEntries(
      floatProjectNames.map((name) => [
        name,
        floatProjectClients[name] ?? existingProjectClients[name] ?? "",
      ])
    ),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { name, clientName, startDate, endDate, status, floatProjectName, sowLink, estimateLink, floatLink, metricLink, pmPersonIds, pgmPersonId, cadPersonId, cdaEnabled } =
    parsed.data;
  const norm = (s: string | null | undefined) => {
    const raw = s?.trim();
    if (!raw) return null;
    return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  };
  const existingSlugs = new Set(
    (await prisma.project.findMany({ select: { slug: true } })).map((p) => p.slug).filter(Boolean)
  );
  const slug = ensureUniqueSlug(slugify(name), existingSlugs);
  const project = await prisma.project.create({
    data: {
      slug,
      name,
      clientName,
      startDate: startDate instanceof Date ? startDate : new Date(startDate),
      endDate: endDate instanceof Date ? endDate : new Date(endDate),
      status: status as "Active" | "Closed",
      cdaEnabled: cdaEnabled ?? false,
      sowLink: norm(sowLink),
      estimateLink: norm(estimateLink),
      floatLink: norm(floatLink),
      metricLink: norm(metricLink),
    },
  });
  revalidateTag("projects-list", "max");

  // Backfill assignments and float hours from all Float import runs when the new
  // project name matches a project in any import (so resourcing data is available immediately).
  let backfillStats: {
    matched: boolean;
    assignmentsCreated: number;
    floatHoursCreated: number;
    floatListLength?: number;
    totalWeekEntries?: number;
    floatHoursNote?: string;
  } = { matched: false, assignmentsCreated: 0, floatHoursCreated: 0 };
  const nameToLookup = (floatProjectName ?? name)?.trim();
  if (nameToLookup) {
    const allRuns = await prisma.floatImportRun.findMany({
      orderBy: { completedAt: "asc" },
      select: {
        completedAt: true,
        projectNames: true,
        projectAssignments: true,
        projectFloatHours: true,
      },
    });
    const { assignmentsList, floatList } = getProjectDataFromAllImports(
      allRuns,
      nameToLookup
    );

    backfillStats.floatListLength = floatList.length;
    backfillStats.totalWeekEntries = floatList.reduce(
      (sum, item) => sum + (item.weeks?.length ?? 0),
      0
    );

    if (assignmentsList.length > 0 || floatList.length > 0) {
      backfillStats = { ...backfillStats, matched: true };
    }

    const knownRoles = await prisma.role.findMany();
    const { resolveFloatRoleNameToWorkbenchId } = buildWorkbenchRoleLookup(knownRoles);

    const personKey = (s: string) => s.trim().toLowerCase();
    const uniqueNameByKey = new Map<string, string>();
    for (const { personName } of assignmentsList) {
      const k = personKey(personName);
      if (!uniqueNameByKey.has(k)) uniqueNameByKey.set(k, personName.trim());
    }
    for (const { personName } of floatList) {
      const k = personKey(personName);
      if (!uniqueNameByKey.has(k)) uniqueNameByKey.set(k, personName.trim());
    }

    type PersonRow = { id: string; floatJobTitle: string | null };
    const personByKey = new Map<string, PersonRow>();
    const displayNames = [...uniqueNameByKey.values()];
    if (displayNames.length > 0) {
      const existing = await prisma.person.findMany({
        where: {
          OR: displayNames.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })),
        },
        select: { id: true, name: true, floatJobTitle: true },
      });
      for (const p of existing) {
        personByKey.set(personKey(p.name), {
          id: p.id,
          floatJobTitle: p.floatJobTitle,
        });
      }
      for (const [k, displayName] of uniqueNameByKey) {
        if (personByKey.has(k)) continue;
        const created = await prisma.person.create({
          data: { name: displayName },
          select: { id: true, floatJobTitle: true },
        });
        personByKey.set(k, {
          id: created.id,
          floatJobTitle: created.floatJobTitle,
        });
      }
    }

    for (const { personName, roleName } of assignmentsList) {
      const person = personByKey.get(personKey(personName));
      if (!person) continue;
      const roleId = resolveRoleIdForNewAssignmentFromFloat({
        workbenchRoles: knownRoles,
        floatRoleName: roleName,
        floatJobTitle: person.floatJobTitle,
        resolveFloatRoleNameToWorkbenchId,
      });
      if (!roleId) continue;
      await prisma.projectAssignment.upsert({
        where: {
          projectId_personId: { projectId: project.id, personId: person.id },
        },
        create: { projectId: project.id, personId: person.id, roleId },
        update: { roleId },
      });
      backfillStats.assignmentsCreated += 1;
    }

    const personIdByLowerName = new Map<string, string>();
    for (const [k, p] of personByKey) {
      personIdByLowerName.set(k, p.id);
    }
    const floatHourRows = floatScheduledHourRowsFromMergedLists(
      new Map([[project.id, floatList]]),
      personIdByLowerName
    );
    if (floatHourRows.length > 0) {
      await batchUpsertFloatScheduledHours(prisma, floatHourRows);
    }
    backfillStats.floatHoursCreated = floatHourRows.length;

    if (backfillStats.assignmentsCreated > 0 && backfillStats.floatHoursCreated === 0) {
      backfillStats.floatHoursNote =
        "Assignments came from the last sync, but no float hours were stored for that run. Run Float sync in Admin so the next sync stores float hours; then use Backfill on this project's Edit page.";
    }
  }

  // Create project key roles (PM, PGM, CAD)
  const keyRoleInserts: Array<{ projectId: string; personId: string; type: "PM" | "PGM" | "CAD" }> = [];
  for (const personId of pmPersonIds ?? []) {
    if (personId) keyRoleInserts.push({ projectId: project.id, personId, type: "PM" });
  }
  if (pgmPersonId) keyRoleInserts.push({ projectId: project.id, personId: pgmPersonId, type: "PGM" });
  if (cadPersonId) keyRoleInserts.push({ projectId: project.id, personId: cadPersonId, type: "CAD" });
  for (const kr of keyRoleInserts) {
    await prisma.projectKeyRole.create({ data: kr });
  }

  const created = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      projectKeyRoles: { include: { person: true } },
    },
  });

  const data = created ?? project;
  const response = Object.assign({}, data, { backfillFromImport: backfillStats });
  revalidateTag("projects-list", "max");
  return NextResponse.json(response);
}
