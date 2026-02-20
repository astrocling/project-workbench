import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().min(1),
  startDate: z.union([z.string(), z.date()]),
  endDate: z.union([z.string(), z.date()]).optional().nullable(),
  status: z.enum(["Active", "Closed"]).default("Active"),
  floatProjectName: z.string().optional(),
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

  return NextResponse.json({
    projects,
    floatLastUpdated: lastImport?.completedAt ?? null,
    floatProjectNames: (lastImport?.projectNames as string[]) ?? [],
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "Admin" && role !== "Editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { name, clientName, startDate, endDate, status, floatProjectName } =
    parsed.data;
  const project = await prisma.project.create({
    data: {
      name,
      clientName,
      startDate: startDate instanceof Date ? startDate : new Date(startDate),
      endDate: endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null,
      status: status as "Active" | "Closed",
    },
  });

  if (floatProjectName) {
    const lastImport = await prisma.floatImportRun.findFirst({
      orderBy: { completedAt: "desc" },
    });
    const assignments =
      (lastImport?.projectAssignments as Record<
        string,
        Array<{ personName: string; roleName: string }>
      >) ?? {};
    const key = Object.keys(assignments).find(
      (k) => k.toLowerCase() === floatProjectName.toLowerCase()
    );
    const list = key ? assignments[key] : [];
    const knownRoles = await prisma.role.findMany();
    const roleByName = new Map(knownRoles.map((r) => [r.name.toLowerCase(), r.id]));

    for (const { personName, roleName } of list) {
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
    }

    // Backfill FloatScheduledHours from import (for projects created after import)
    const projectFloatHours =
      (lastImport?.projectFloatHours as Record<
        string,
        Array<{
          personName: string;
          roleName: string;
          weeks: Array<{ weekStart: string; hours: number }>;
        }>
      >) ?? {};
    const floatKey = Object.keys(projectFloatHours).find(
      (k) => k.toLowerCase() === floatProjectName.toLowerCase()
    );
    const floatList = floatKey ? projectFloatHours[floatKey] : [];
    for (const { personName, weeks } of floatList) {
      const person = await prisma.person.findFirst({
        where: { name: { equals: personName, mode: "insensitive" } },
      });
      if (!person) continue;
      for (const { weekStart, hours } of weeks) {
        if (!hours) continue;
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
      }
    }
  }

  return NextResponse.json(project);
}
