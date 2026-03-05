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

const postSchema = z.object({
  label: z.string().min(1),
  date: dateString,
  rowIndex: z.number().int().min(1).max(4).optional(),
  shape: shapeEnum.optional(),
  order: z.number().int().optional(),
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

  const markers = await prisma.timelineMarker.findMany({
    where: { projectId: id },
    orderBy: [{ date: "asc" }, { order: "asc" }],
  });

  return NextResponse.json({
    markers: markers.map((m) => ({
      id: m.id,
      rowIndex: m.rowIndex,
      shape: m.shape,
      label: m.label,
      date: toIsoDate(m.date),
      order: m.order,
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

  const { label, date, rowIndex, shape, order } = parsed.data;
  const d = new Date(date);
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

  try {
    const marker = await prisma.timelineMarker.create({
      data: {
        projectId: id,
        label,
        date: d,
        rowIndex: rowIndex ?? 1,
        shape: shape ?? "Pin",
        order: order ?? 0,
      },
    });

    return NextResponse.json({
      id: marker.id,
      rowIndex: marker.rowIndex,
      shape: marker.shape,
      label: marker.label,
      date: toIsoDate(marker.date),
      order: marker.order,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create timeline marker";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
