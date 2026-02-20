import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  personId: z.string(),
  ready: z.boolean(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await prisma.readyForFloatUpdate.findMany({
    where: { projectId: id },
  });
  return NextResponse.json(rows);
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

  const row = await prisma.readyForFloatUpdate.upsert({
    where: {
      projectId_personId: {
        projectId: id,
        personId: parsed.data.personId,
      },
    },
    create: {
      projectId: id,
      personId: parsed.data.personId,
      ready: parsed.data.ready,
    },
    update: { ready: parsed.data.ready },
  });
  return NextResponse.json(row);
}
