import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { getMonthKeysForWeek } from "@/lib/monthUtils";
import { z } from "zod";

const QUARTER_HOUR_EPS = 1e-9;
function isQuarterIncrement(n: number): boolean {
  return Number.isFinite(n) && Math.abs((n * 4) - Math.round(n * 4)) < QUARTER_HOUR_EPS;
}

const updateSchema = z.object({
  personId: z.string(),
  weekStartDate: z.string(),
  hours: z
    .number()
    .min(0)
    .nullable()
    .refine((v) => v === null || isQuarterIncrement(v), {
      message: "Hours must be in 0.25 increments",
    }),
});

const updateSplitPartSchema = z.object({
  monthKey: z.string(),
  hours: z.number().min(0).refine(isQuarterIncrement, {
    message: "Hours must be in 0.25 increments",
  }),
});

const updateSplitSchema = z.object({
  personId: z.string(),
  weekStartDate: z.string(),
  parts: z
    .array(updateSplitPartSchema)
    .length(2)
    .refine(
      (parts) => {
        const keys = new Set(parts.map((p) => p.monthKey));
        return keys.size === 2;
      },
      { message: "parts must have two distinct monthKeys" }
    ),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fromWeek = req.nextUrl.searchParams.get("fromWeek");
  const toWeek = req.nextUrl.searchParams.get("toWeek");
  const where =
    fromWeek && toWeek
      ? {
          projectId: id,
          weekStartDate: {
            gte: new Date(fromWeek + "T00:00:00.000Z"),
            lte: new Date(toWeek + "T00:00:00.000Z"),
          },
        }
      : { projectId: id };

  const rows = await prisma.actualHours.findMany({
    where,
    select: { projectId: true, personId: true, weekStartDate: true, hours: true },
  });

  let monthSplits: Array<{
    projectId: string;
    personId: string;
    weekStartDate: Date;
    monthKey: string;
    hours: unknown;
  }> = [];
  try {
    monthSplits = await prisma.actualHoursMonthSplit.findMany({ where });
  } catch {
    // ActualHoursMonthSplit table may not exist on older branches or before migration
  }

  return NextResponse.json({
    rows,
    monthSplits: monthSplits.map((m) => ({
      projectId: m.projectId,
      personId: m.personId,
      weekStartDate: m.weekStartDate,
      monthKey: m.monthKey,
      hours: Number(m.hours),
    })),
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

  // Split-week update: { personId, weekStartDate, parts: [{ monthKey, hours }, { monthKey, hours }] }
  const splitParsed = updateSplitSchema.safeParse(body);
  if (splitParsed.success) {
    const { personId, weekStartDate, parts } = splitParsed.data;
    const weekStart = new Date(weekStartDate);
    const allowedMonths = getMonthKeysForWeek(weekStart);
    if (allowedMonths.length !== 2) {
      return NextResponse.json(
        { error: "Week does not span two months; use single value update" },
        { status: 400 }
      );
    }
    for (const p of parts) {
      if (!allowedMonths.includes(p.monthKey)) {
        return NextResponse.json(
          { error: `Invalid monthKey ${p.monthKey} for this week` },
          { status: 400 }
        );
      }
    }
    const totalHours = parts[0].hours + parts[1].hours;
    const hasMonthSplit = "actualHoursMonthSplit" in prisma && prisma.actualHoursMonthSplit != null;
    if (hasMonthSplit) {
      await prisma.$transaction([
        prisma.actualHoursMonthSplit.upsert({
          where: {
            projectId_personId_weekStartDate_monthKey: {
              projectId: id,
              personId,
              weekStartDate: weekStart,
              monthKey: parts[0].monthKey,
            },
          },
          create: {
            projectId: id,
            personId,
            weekStartDate: weekStart,
            monthKey: parts[0].monthKey,
            hours: parts[0].hours,
          },
          update: { hours: parts[0].hours },
        }),
        prisma.actualHoursMonthSplit.upsert({
          where: {
            projectId_personId_weekStartDate_monthKey: {
              projectId: id,
              personId,
              weekStartDate: weekStart,
              monthKey: parts[1].monthKey,
            },
          },
          create: {
            projectId: id,
            personId,
            weekStartDate: weekStart,
            monthKey: parts[1].monthKey,
            hours: parts[1].hours,
          },
          update: { hours: parts[1].hours },
        }),
        prisma.actualHours.upsert({
          where: {
            projectId_personId_weekStartDate: {
              projectId: id,
              personId,
              weekStartDate: weekStart,
            },
          },
          create: {
            projectId: id,
            personId,
            weekStartDate: weekStart,
            hours: totalHours,
          },
          update: { hours: totalHours },
        }),
      ]);
    } else {
      await prisma.actualHours.upsert({
        where: {
          projectId_personId_weekStartDate: {
            projectId: id,
            personId,
            weekStartDate: weekStart,
          },
        },
        create: {
          projectId: id,
          personId,
          weekStartDate: weekStart,
          hours: totalHours,
        },
        update: { hours: totalHours },
      });
    }
    const updated = await prisma.actualHours.findFirst({
      where: {
        projectId: id,
        personId,
        weekStartDate: weekStart,
      },
    });
    return NextResponse.json(updated);
  }

  // Single value update (unchanged): { personId, weekStartDate, hours }
  const items = Array.isArray(body) ? body : [body];
  const results = [];
  for (const item of items) {
    const parsed = updateSchema.safeParse(item);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const weekStart = new Date(parsed.data.weekStartDate);
    if ("actualHoursMonthSplit" in prisma && prisma.actualHoursMonthSplit != null) {
      await prisma.actualHoursMonthSplit.deleteMany({
        where: {
          projectId: id,
          personId: parsed.data.personId,
          weekStartDate: weekStart,
        },
      });
    }
    const row = await prisma.actualHours.upsert({
      where: {
        projectId_personId_weekStartDate: {
          projectId: id,
          personId: parsed.data.personId,
          weekStartDate: weekStart,
        },
      },
      create: {
        projectId: id,
        personId: parsed.data.personId,
        weekStartDate: weekStart,
        hours: parsed.data.hours,
      },
      update: { hours: parsed.data.hours },
    });
    results.push(row);
  }
  revalidateTag("portfolio-metrics", "max");
  revalidateTag("project-budget", "max");
  revalidateTag("project-revenue", "max");
  revalidateTag(`project-resourcing:${id}`, "max");
  return NextResponse.json(results.length === 1 ? results[0] : results);
}
