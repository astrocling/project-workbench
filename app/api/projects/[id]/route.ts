import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional().nullable(),
  status: z.enum(["Active", "Closed"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assignments: {
        include: { person: true, role: true },
      },
      projectRoleRates: { include: { role: true } },
      projectKeyRoles: { include: { person: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name != null) data.name = parsed.data.name;
  if (parsed.data.clientName != null) data.clientName = parsed.data.clientName;
  if (parsed.data.startDate != null) data.startDate = parsed.data.startDate instanceof Date ? parsed.data.startDate : new Date(parsed.data.startDate);
  if (parsed.data.endDate !== undefined) data.endDate = parsed.data.endDate ? (parsed.data.endDate instanceof Date ? parsed.data.endDate : new Date(parsed.data.endDate)) : null;
  if (parsed.data.status != null) data.status = parsed.data.status;

  const project = await prisma.project.update({
    where: { id },
    data: data as Parameters<typeof prisma.project.update>[0]["data"],
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "Admin" && role !== "Editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
