import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const dateString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "Invalid date",
});

const shapeEnum = z.enum(["BadgeAlert", "ThumbsUp", "TrendingUpDown", "Rocket", "PencilRuler", "Pin"]);

const patchSchema = z.object({
  label: z.string().min(1).optional(),
  date: dateString.optional(),
  rowIndex: z.number().int().min(1).max(4).optional(),
  shape: shapeEnum.optional(),
  order: z.number().int().optional(),
});

function toIsoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; markerId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, markerId } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const marker = await prisma.timelineMarker.findFirst({
    where: { id: markerId, projectId: id },
  });
  if (!marker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data: { label?: string; date?: Date; rowIndex?: number; shape?: string; order?: number } = {};
  if (parsed.data.label !== undefined) data.label = parsed.data.label;
  if (parsed.data.order !== undefined) data.order = parsed.data.order;
  if (parsed.data.rowIndex !== undefined) data.rowIndex = parsed.data.rowIndex;
  if (parsed.data.shape !== undefined) data.shape = parsed.data.shape;

  if (parsed.data.date !== undefined) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { startDate: true, endDate: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const d = new Date(parsed.data.date);
    const projectStart = new Date(project.startDate);
    const projectEnd = project.endDate ? new Date(project.endDate) : null;

    if (d < projectStart) {
      return NextResponse.json(
        { error: "Date must be within project date range" },
        { status: 400 }
      );
    }
    if (projectEnd && d > projectEnd) {
      return NextResponse.json(
        { error: "Date must be within project date range" },
        { status: 400 }
      );
    }
    data.date = d;
  }

  const updated = await prisma.timelineMarker.update({
    where: { id: markerId },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    rowIndex: updated.rowIndex,
    shape: updated.shape,
    label: updated.label,
    date: toIsoDate(updated.date),
    order: updated.order,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; markerId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, markerId } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const marker = await prisma.timelineMarker.findFirst({
    where: { id: markerId, projectId: id },
  });
  if (!marker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.timelineMarker.delete({ where: { id: markerId } });
  return new NextResponse(null, { status: 204 });
}
