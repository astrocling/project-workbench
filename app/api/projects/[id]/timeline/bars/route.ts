import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const dateString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "Invalid date",
});

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a 6-digit hex (e.g. #1941FA)")
  .optional();

const postSchema = z.object({
  rowIndex: z.number().int().min(1).max(4),
  label: z.string().min(1),
  startDate: dateString,
  endDate: dateString,
  order: z.number().int().optional(),
  color: hexColor,
});

function toIsoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bars = await prisma.timelineBar.findMany({
    where: { projectId: id },
    orderBy: [{ rowIndex: "asc" }, { order: "asc" }, { startDate: "asc" }],
  });

  return NextResponse.json({
    bars: bars.map((b) => ({
      id: b.id,
      rowIndex: b.rowIndex,
      label: b.label,
      startDate: toIsoDate(b.startDate),
      endDate: toIsoDate(b.endDate),
      order: b.order,
      color: b.color ?? null,
    })),
  });
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

  const project = await prisma.project.findUnique({
    where: { id },
    select: { startDate: true, endDate: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { rowIndex, label, startDate, endDate, order, color } = parsed.data;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const projectStart = new Date(project.startDate);
  const projectEnd = project.endDate ? new Date(project.endDate) : null;

  if (start > end) {
    return NextResponse.json(
      { error: "Start date must be on or before end date" },
      { status: 400 }
    );
  }
  if (start < projectStart) {
    return NextResponse.json(
      { error: "Start date must be within project date range" },
      { status: 400 }
    );
  }
  if (projectEnd && end > projectEnd) {
    return NextResponse.json(
      { error: "End date must be within project date range" },
      { status: 400 }
    );
  }

  try {
    const bar = await prisma.timelineBar.create({
      data: {
        projectId: id,
        rowIndex,
        label,
        startDate: start,
        endDate: end,
        order: order ?? 0,
        color: color ?? null,
      },
    });

    return NextResponse.json({
      id: bar.id,
      rowIndex: bar.rowIndex,
      label: bar.label,
      startDate: toIsoDate(bar.startDate),
      endDate: toIsoDate(bar.endDate),
      order: bar.order,
      color: bar.color ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create timeline bar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
