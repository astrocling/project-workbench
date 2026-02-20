import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSchema = z.object({
  personId: z.string(),
  roleId: z.string(),
  billRateOverride: z.number().optional().nullable(),
});

const removeSchema = z.object({
  personId: z.string(),
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

  const assignment = await prisma.projectAssignment.create({
    data: {
      projectId: id,
      personId: parsed.data.personId,
      roleId: parsed.data.roleId,
      billRateOverride: parsed.data.billRateOverride ?? null,
    },
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
