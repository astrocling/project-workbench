import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";

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

  const project = await prisma.project.findUnique({
    where: { id },
    select: { startDate: true, endDate: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [bars, markers] = await Promise.all([
    prisma.timelineBar.findMany({
      where: { projectId: id },
      orderBy: [{ rowIndex: "asc" }, { order: "asc" }, { startDate: "asc" }],
    }),
    prisma.timelineMarker.findMany({
      where: { projectId: id },
      orderBy: [{ date: "asc" }, { order: "asc" }],
    }),
  ]);

  return NextResponse.json({
    project: {
      startDate: toIsoDate(project.startDate),
      endDate: project.endDate ? toIsoDate(project.endDate) : null,
    },
    bars: bars.map((b) => ({
      id: b.id,
      rowIndex: b.rowIndex,
      label: b.label,
      startDate: toIsoDate(b.startDate),
      endDate: toIsoDate(b.endDate),
      order: b.order,
      color: b.color ?? null,
    })),
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
