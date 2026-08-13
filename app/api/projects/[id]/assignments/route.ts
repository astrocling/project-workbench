import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { getAsOfDate } from "@/lib/weekUtils";
import {
  mostCommonFloatRoleNameForPerson,
  resolveRoleIdForManualAssignmentAdd,
} from "@/lib/float/roleWorkbenchMatch";
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
  hiddenFromGrid: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [assignments, plannedHours, floatHours] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: { projectId: id },
      include: { person: true, role: true },
    }),
    prisma.plannedHours.findMany({ where: { projectId: id } }),
    prisma.floatScheduledHours.findMany({ where: { projectId: id } }),
  ]);

  const asOf = getAsOfDate();
  const hasUpcoming = (personId: string): boolean => {
    const isFuture = (d: Date) => new Date(d) > asOf;
    const planned = plannedHours.some(
      (r) => r.personId === personId && isFuture(r.weekStartDate) && Number(r.hours) > 0
    );
    const float = floatHours.some(
      (r) => r.personId === personId && isFuture(r.weekStartDate) && Number(r.hours) > 0
    );
    return planned || float;
  };

  const withFlags = assignments.map((a) => ({
    ...a,
    hasUpcomingHours: hasUpcoming(a.personId),
  }));

  return NextResponse.json(withFlags);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  let roleId = parsed.data.roleId;
  if (!roleId) {
    const [person, roles, lastImport] = await Promise.all([
      prisma.person.findUnique({
        where: { id: parsed.data.personId },
        select: { name: true, floatJobTitle: true },
      }),
      prisma.role.findMany({ select: { id: true, name: true } }),
      prisma.floatImportRun.findFirst({
        orderBy: { completedAt: "desc" },
        select: { projectAssignments: true },
      }),
    ]);
    const projectAssignments =
      (lastImport?.projectAssignments as Record<
        string,
        Array<{ personName: string; roleName: string }>
      >) ?? {};
    const floatRoleNameHint = person
      ? mostCommonFloatRoleNameForPerson(projectAssignments, person.name)
      : null;
    roleId = resolveRoleIdForManualAssignmentAdd({
      workbenchRoles: roles,
      floatJobTitle: person?.floatJobTitle,
      floatRoleNameHint,
    });
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
  revalidateTag("portfolio-metrics", "max");
  revalidateTag(`project-resourcing:${id}`, "max");
  return NextResponse.json(assignment);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data: {
    roleId?: string;
    billRateOverride?: number | null;
    hiddenFromGrid?: boolean;
    syncRoleFromFloat?: boolean;
  } = {};
  if (parsed.data.roleId !== undefined) {
    data.roleId = parsed.data.roleId;
    data.syncRoleFromFloat = false;
  }
  if (parsed.data.billRateOverride !== undefined) data.billRateOverride = parsed.data.billRateOverride;
  if (parsed.data.hiddenFromGrid !== undefined) data.hiddenFromGrid = parsed.data.hiddenFromGrid;
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
  revalidateTag("portfolio-metrics", "max");
  revalidateTag(`project-resourcing:${id}`, "max");
  return NextResponse.json(assignment);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  if (!personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.plannedHours.deleteMany({
      where: { projectId: id, personId },
    }),
    prisma.projectAssignment.delete({
      where: {
        projectId_personId: { projectId: id, personId },
      },
    }),
  ]);
  revalidateTag("portfolio-metrics", "max");
  revalidateTag(`project-resourcing:${id}`, "max");
  return NextResponse.json({ ok: true });
}
