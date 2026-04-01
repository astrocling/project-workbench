import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import {
  buildCdaRowsForProject,
  roundToQuarter,
} from "@/lib/cdaMtdFromResourcing";
import { z } from "zod";

const patchSchema = z.object({
  rows: z.array(
    z.object({
      monthKey: z.string(),
      planned: z.number().min(0),
      /** Ignored — MTD actuals are computed from resourcing. Kept for older clients. */
      mtdActuals: z.number().min(0).optional(),
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
    select: { startDate: true, endDate: true, cdaMonths: true, actualHours: true, actualHoursMonthSplits: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = buildCdaRowsForProject({
    startDate: project.startDate,
    endDate: project.endDate,
    cdaMonths: project.cdaMonths,
    actualHours: project.actualHours,
    actualHoursMonthSplits: project.actualHoursMonthSplits,
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
    await prisma.cdaMonth.upsert({
      where: {
        projectId_monthKey: { projectId: id, monthKey: row.monthKey },
      },
      create: {
        projectId: id,
        monthKey: row.monthKey,
        planned,
        mtdActuals: 0,
      },
      update: { planned },
    });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      startDate: true,
      endDate: true,
      cdaMonths: true,
      actualHours: true,
      actualHoursMonthSplits: true,
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = buildCdaRowsForProject({
    startDate: project.startDate,
    endDate: project.endDate,
    cdaMonths: project.cdaMonths,
    actualHours: project.actualHours,
    actualHoursMonthSplits: project.actualHoursMonthSplits,
  });

  const mtdByKey = new Map(rows.map((r) => [r.monthKey, r.mtdActuals]));
  await Promise.all(
    project.cdaMonths.map((m) =>
      prisma.cdaMonth.update({
        where: { projectId_monthKey: { projectId: id, monthKey: m.monthKey } },
        data: { mtdActuals: mtdByKey.get(m.monthKey) ?? 0 },
      })
    )
  );

  return NextResponse.json({
    startDate: project.startDate,
    endDate: project.endDate,
    rows,
  });
}
