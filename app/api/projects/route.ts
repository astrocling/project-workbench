import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectDataFromImport } from "@/lib/floatImportUtils";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().min(1),
  startDate: z.union([z.string(), z.date()]),
  endDate: z.union([z.string(), z.date()]).optional().nullable(),
  status: z.enum(["Active", "Closed"]).default("Active"),
  floatProjectName: z.string().optional(),
  sowLink: z.string().max(2048).nullable().optional(),
  estimateLink: z.string().max(2048).nullable().optional(),
  pmPersonIds: z.array(z.string()).optional(),
  pgmPersonId: z.string().optional().nullable(),
  cadPersonId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      projectKeyRoles: {
        include: { person: true },
      },
    },
  });

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

  const { name, clientName, startDate, endDate, status, floatProjectName, sowLink, estimateLink, pmPersonIds, pgmPersonId, cadPersonId } =
    parsed.data;
  const norm = (s: string | null | undefined) => {
    const raw = s?.trim();
    if (!raw) return null;
    return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  };
  const project = await prisma.project.create({
    data: {
      name,
      clientName,
      startDate: startDate instanceof Date ? startDate : new Date(startDate),
      endDate: endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null,
      status: status as "Active" | "Closed",
      sowLink: norm(sowLink),
      estimateLink: norm(estimateLink),
    },
  });

  // Backfill assignments and float hours from the most recent Float import when the new
  // project name matches a project in that import (so resourcing data is available immediately).
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
    const lastImport = await prisma.floatImportRun.findFirst({
      orderBy: { completedAt: "desc" },
      select: {
        projectNames: true,
        projectAssignments: true,
        projectFloatHours: true,
      },
    });
    const { assignmentsList, floatList } = getProjectDataFromImport(
      lastImport,
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
    if (assignmentsList.length > 0 && backfillStats.floatHoursCreated === 0) {
      backfillStats.floatHoursNote =
        "Assignments came from the last import, but no float hours were stored for that run. Re-upload the Float CSV in Admin so the next import stores float hours; then use Backfill on this project’s Edit page.";
    }

    const knownRoles = await prisma.role.findMany();
    const roleByName = new Map(knownRoles.map((r) => [r.name.toLowerCase(), r.id]));

    for (const { personName, roleName } of assignmentsList) {
      const roleId = roleByName.get(roleName.toLowerCase());
      if (!roleId) continue;
      let person = await prisma.person.findFirst({
        where: { name: { equals: personName, mode: "insensitive" } },
      });
      if (!person) {
        person = await prisma.person.create({ data: { name: personName } });
      }
      await prisma.projectAssignment.upsert({
        where: {
          projectId_personId: { projectId: project.id, personId: person.id },
        },
        create: { projectId: project.id, personId: person.id, roleId },
        update: { roleId },
      });
      backfillStats.assignmentsCreated += 1;
    }

    for (const { personName, weeks } of floatList) {
      const person = await prisma.person.findFirst({
        where: { name: { equals: personName, mode: "insensitive" } },
      });
      if (!person) continue;
      for (const { weekStart, hours } of weeks) {
        if (hours == null || hours === undefined) continue;
        const weekStartDate = new Date(weekStart + "T00:00:00.000Z");
        await prisma.floatScheduledHours.upsert({
          where: {
            projectId_personId_weekStartDate: {
              projectId: project.id,
              personId: person.id,
              weekStartDate,
            },
          },
          create: {
            projectId: project.id,
            personId: person.id,
            weekStartDate,
            hours,
          },
          update: { hours },
        });
        backfillStats.floatHoursCreated += 1;
      }
    }

    if (backfillStats.assignmentsCreated > 0 && backfillStats.floatHoursCreated === 0) {
      backfillStats.floatHoursNote =
        "Assignments came from the last import, but no float hours were stored for that run. Re-upload the Float CSV in Admin so the next import stores float hours; then use Backfill on this project's Edit page.";
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
  return NextResponse.json(response);
}
