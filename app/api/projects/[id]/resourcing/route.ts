import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { formatWeekKey } from "@/lib/weekUtils";

/**
 * Single GET that returns all data needed for the Resourcing tab:
 * project (dates, thresholds), assignments, plannedHours, actualHours,
 * floatHours, readyForFloat, cellComments. Replaces 7 separate API calls.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [project, floatRows, readyForFloatRows, commentRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        startDate: true,
        endDate: true,
        actualsLowThresholdPercent: true,
        actualsHighThresholdPercent: true,
        assignments: { include: { person: true, role: true } },
        plannedHours: true,
        actualHours: true,
      },
    }),
    prisma.floatScheduledHours.findMany({
      where: { projectId: id },
    }),
    prisma.readyForFloatUpdate.findMany({
      where: { projectId: id },
    }),
    prisma.gridCellComment.findMany({
      where: { projectId: id },
    }),
  ]);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const toDateStr = (d: Date | string): string =>
    typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);

  return NextResponse.json({
    project: {
      startDate: project.startDate,
      endDate: project.endDate,
      actualsLowThresholdPercent: project.actualsLowThresholdPercent ?? null,
      actualsHighThresholdPercent: project.actualsHighThresholdPercent ?? null,
    },
    assignments: project.assignments,
    plannedHours: project.plannedHours.map((r) => ({
      ...r,
      weekStartDate: toDateStr(r.weekStartDate),
      hours: Number(r.hours),
    })),
    actualHours: project.actualHours.map((r) => ({
      ...r,
      weekStartDate: toDateStr(r.weekStartDate),
      hours: r.hours != null ? Number(r.hours) : null,
    })),
    floatHours: floatRows.map((r) => ({
      projectId: r.projectId,
      personId: r.personId,
      weekStartDate: formatWeekKey(r.weekStartDate),
      hours: Number(r.hours),
    })),
    readyForFloat: readyForFloatRows,
    cellComments: commentRows.map((r) => ({
      projectId: r.projectId,
      personId: r.personId,
      weekStartDate: toDateStr(r.weekStartDate),
      gridType: r.gridType,
      comment: r.comment,
    })),
  });
}
