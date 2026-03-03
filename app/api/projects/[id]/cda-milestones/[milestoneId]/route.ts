import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const patchSchema = z.object({
  completed: z.boolean().optional(),
  phase: z.string().min(1).optional(),
  devStartDate: z.string().optional(),
  devEndDate: z.string().optional(),
  uatStartDate: z.string().optional(),
  uatEndDate: z.string().optional(),
  deployDate: z.string().optional(),
});

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, milestoneId } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const milestone = await prisma.cdaMilestone.findFirst({
    where: { id: milestoneId, projectId: id },
  });
  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data: {
    completed?: boolean;
    phase?: string;
    devStartDate?: Date;
    devEndDate?: Date;
    uatStartDate?: Date;
    uatEndDate?: Date;
    deployDate?: Date;
  } = {};
  if (parsed.data.completed !== undefined) data.completed = parsed.data.completed;
  if (parsed.data.phase !== undefined) data.phase = parsed.data.phase;
  if (parsed.data.devStartDate !== undefined)
    data.devStartDate = new Date(parsed.data.devStartDate);
  if (parsed.data.devEndDate !== undefined)
    data.devEndDate = new Date(parsed.data.devEndDate);
  if (parsed.data.uatStartDate !== undefined)
    data.uatStartDate = new Date(parsed.data.uatStartDate);
  if (parsed.data.uatEndDate !== undefined)
    data.uatEndDate = new Date(parsed.data.uatEndDate);
  if (parsed.data.deployDate !== undefined)
    data.deployDate = new Date(parsed.data.deployDate);

  const updated = await prisma.cdaMilestone.update({
    where: { id: milestoneId },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    phase: updated.phase,
    devStartDate: toIsoDate(updated.devStartDate),
    devEndDate: toIsoDate(updated.devEndDate),
    uatStartDate: toIsoDate(updated.uatStartDate),
    uatEndDate: toIsoDate(updated.uatEndDate),
    deployDate: toIsoDate(updated.deployDate),
    completed: updated.completed,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, milestoneId } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const milestone = await prisma.cdaMilestone.findFirst({
    where: { id: milestoneId, projectId: id },
  });
  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.cdaMilestone.delete({ where: { id: milestoneId } });
  return new NextResponse(null, { status: 204 });
}
