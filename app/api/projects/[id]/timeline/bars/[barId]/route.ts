import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const dateString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "Invalid date",
});

const patchSchema = z.object({
  rowIndex: z.number().int().min(1).max(4).optional(),
  label: z.string().min(1).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  order: z.number().int().optional(),
});

function toIsoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; barId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, barId } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bar = await prisma.timelineBar.findFirst({
    where: { id: barId, projectId: id },
  });
  if (!bar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { startDate: true, endDate: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projectStart = new Date(project.startDate);
  const projectEnd = project.endDate ? new Date(project.endDate) : null;

  const data: {
    rowIndex?: number;
    label?: string;
    startDate?: Date;
    endDate?: Date;
    order?: number;
  } = {};

  if (parsed.data.rowIndex !== undefined) data.rowIndex = parsed.data.rowIndex;
  if (parsed.data.label !== undefined) data.label = parsed.data.label;
  if (parsed.data.order !== undefined) data.order = parsed.data.order;

  if (parsed.data.startDate !== undefined) {
    const start = new Date(parsed.data.startDate);
    if (start < projectStart) {
      return NextResponse.json(
        { error: "Start date must be within project date range" },
        { status: 400 }
      );
    }
    data.startDate = start;
  }
  if (parsed.data.endDate !== undefined) {
    const end = new Date(parsed.data.endDate);
    if (projectEnd && end > projectEnd) {
      return NextResponse.json(
        { error: "End date must be within project date range" },
        { status: 400 }
      );
    }
    data.endDate = end;
  }

  const startDate = data.startDate ?? bar.startDate;
  const endDate = data.endDate ?? bar.endDate;
  if (startDate > endDate) {
    return NextResponse.json(
      { error: "Start date must be on or before end date" },
      { status: 400 }
    );
  }

  const updated = await prisma.timelineBar.update({
    where: { id: barId },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    rowIndex: updated.rowIndex,
    label: updated.label,
    startDate: toIsoDate(updated.startDate),
    endDate: toIsoDate(updated.endDate),
    order: updated.order,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; barId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, barId } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bar = await prisma.timelineBar.findFirst({
    where: { id: barId, projectId: id },
  });
  if (!bar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.timelineBar.delete({ where: { id: barId } });
  return new NextResponse(null, { status: 204 });
}
