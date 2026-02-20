import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSchema = z.object({
  personId: z.string(),
  roleId: z.string().optional(),
  billRateOverride: z.number().optional().nullable(),
});

const removeSchema = z.object({
  personId: z.string(),
});

const patchSchema = z.object({
  personId: z.string(),
  roleId: z.string().optional(),
  billRateOverride: z.number().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: id },
    include: { person: true, role: true },
  });
  return NextResponse.json(assignments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "Admin" && role !== "Editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  let roleId = parsed.data.roleId;
  if (!roleId) {
    const person = await prisma.person.findUnique({
      where: { id: parsed.data.personId },
      select: { name: true },
    });
    if (person) {
      const lastImport = await prisma.floatImportRun.findFirst({
        orderBy: { completedAt: "desc" },
      });
      const projectAssignments =
        (lastImport?.projectAssignments as Record<
          string,
          Array<{ personName: string; roleName: string }>
        >) ?? {};
      const personNameLower = person.name.toLowerCase();
      const roleCounts = new Map<string, number>();
      for (const list of Object.values(projectAssignments)) {
        for (const entry of list) {
          if (entry.personName.toLowerCase() === personNameLower && entry.roleName.trim()) {
            const rn = entry.roleName.trim().toLowerCase();
            roleCounts.set(rn, (roleCounts.get(rn) ?? 0) + 1);
          }
        }
      }
      let bestRoleName: string | null = null;
      let bestCount = 0;
      for (const [rn, count] of roleCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestRoleName = rn;
        }
      }
      if (bestRoleName) {
        const role = await prisma.role.findFirst({
          where: { name: { equals: bestRoleName, mode: "insensitive" } },
        });
        if (role) roleId = role.id;
      }
    }
    if (!roleId) {
      const firstRole = await prisma.role.findFirst();
      roleId = firstRole?.id;
    }
    if (!roleId) {
      return NextResponse.json({ error: "No role available" }, { status: 400 });
    }
  }

  const assignment = await prisma.projectAssignment.create({
    data: {
      projectId: id,
      personId: parsed.data.personId,
      roleId,
      billRateOverride: parsed.data.billRateOverride ?? null,
    },
    include: { person: true, role: true },
  });
  return NextResponse.json(assignment);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "Admin" && role !== "Editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data: { roleId?: string; billRateOverride?: number | null } = {};
  if (parsed.data.roleId !== undefined) data.roleId = parsed.data.roleId;
  if (parsed.data.billRateOverride !== undefined) data.billRateOverride = parsed.data.billRateOverride;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const assignment = await prisma.projectAssignment.update({
    where: {
      projectId_personId: { projectId: id, personId: parsed.data.personId },
    },
    data,
    include: { person: true, role: true },
  });
  return NextResponse.json(assignment);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "Admin" && role !== "Editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  if (!personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }

  await prisma.projectAssignment.delete({
    where: {
      projectId_personId: { projectId: id, personId },
    },
  });
  return NextResponse.json({ ok: true });
}
