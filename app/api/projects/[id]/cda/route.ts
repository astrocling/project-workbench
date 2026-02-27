import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { getMonthsInRange } from "@/lib/monthUtils";
import { z } from "zod";

function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

const patchSchema = z.object({
  rows: z.array(
    z.object({
      monthKey: z.string(),
      planned: z.number().min(0),
      mtdActuals: z.number().min(0),
    })
  ),
});

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
    select: { startDate: true, endDate: true, cdaMonths: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const end = project.endDate ?? new Date();
  const months = getMonthsInRange(project.startDate, end);
  const byKey = new Map(
    project.cdaMonths.map((m) => [
      m.monthKey,
      { planned: Number(m.planned), mtdActuals: Number(m.mtdActuals) },
    ])
  );

  const rows = months.map(({ monthKey, label }) => {
    const data = byKey.get(monthKey) ?? { planned: 0, mtdActuals: 0 };
    return {
      monthKey,
      monthLabel: label,
      planned: data.planned,
      mtdActuals: data.mtdActuals,
    };
  });

  return NextResponse.json({
    startDate: project.startDate,
    endDate: project.endDate,
    rows,
  });
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

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  for (const row of parsed.data.rows) {
    const planned = roundToQuarter(row.planned);
    const mtdActuals = roundToQuarter(row.mtdActuals);
    await prisma.cdaMonth.upsert({
      where: {
        projectId_monthKey: { projectId: id, monthKey: row.monthKey },
      },
      create: {
        projectId: id,
        monthKey: row.monthKey,
        planned,
        mtdActuals,
      },
      update: { planned, mtdActuals },
    });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { startDate: true, endDate: true, cdaMonths: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const end = project.endDate ?? new Date();
  const months = getMonthsInRange(project.startDate, end);
  const byKey = new Map(
    project.cdaMonths.map((m) => [
      m.monthKey,
      { planned: Number(m.planned), mtdActuals: Number(m.mtdActuals) },
    ])
  );

  const rows = months.map(({ monthKey, label }) => {
    const data = byKey.get(monthKey) ?? { planned: 0, mtdActuals: 0 };
    return {
      monthKey,
      monthLabel: label,
      planned: data.planned,
      mtdActuals: data.mtdActuals,
    };
  });

  return NextResponse.json({
    startDate: project.startDate,
    endDate: project.endDate,
    rows,
  });
}
