import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const upsertSchema = z.object({
  roleId: z.string(),
  billRate: z.number().min(0),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rates = await prisma.projectRoleRate.findMany({
    where: { projectId: id },
    include: { role: true },
  });
  return NextResponse.json(rates);
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

  const { id } = await params;
  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const rate = await prisma.projectRoleRate.upsert({
    where: {
      projectId_roleId: {
        projectId: id,
        roleId: parsed.data.roleId,
      },
    },
    create: {
      projectId: id,
      roleId: parsed.data.roleId,
      billRate: parsed.data.billRate,
    },
    update: { billRate: parsed.data.billRate },
    include: { role: true },
  });
  return NextResponse.json(rate);
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

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const roleId = searchParams.get("roleId");
  if (!roleId) {
    return NextResponse.json({ error: "roleId required" }, { status: 400 });
  }

  await prisma.projectRoleRate.deleteMany({
    where: {
      projectId: id,
      roleId,
    },
  });
  return NextResponse.json({ ok: true });
}
