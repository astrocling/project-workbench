import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";
import { getAsOfDate, getWeekStartDate, isCompletedWeek } from "@/lib/weekUtils";

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
    .refine(isQuarterIncrement, { message: "Hours must be in 0.25 increments" }),
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
  const rows = await prisma.plannedHours.findMany({
    where,
    select: { projectId: true, personId: true, weekStartDate: true, hours: true },
  });
  return NextResponse.json(rows);
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
  const rawItems = Array.isArray(body) ? body : [body];
  const parsedItems: { personId: string; weekStartDate: string; hours: number }[] = [];
  const asOf = getAsOfDate();
  for (const item of rawItems) {
    const parsed = updateSchema.safeParse(item);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const weekStart = getWeekStartDate(new Date(parsed.data.weekStartDate));
    if (isCompletedWeek(weekStart, asOf)) {
      return NextResponse.json(
        { error: "Cannot edit planned hours for past weeks." },
        { status: 403 }
      );
    }
    parsedItems.push(parsed.data);
  }
  const results = [];
  for (const data of parsedItems) {
    const weekStart = new Date(data.weekStartDate);
    const row = await prisma.plannedHours.upsert({
      where: {
        projectId_personId_weekStartDate: {
          projectId: id,
          personId: data.personId,
          weekStartDate: weekStart,
        },
      },
      create: {
        projectId: id,
        personId: data.personId,
        weekStartDate: weekStart,
        hours: data.hours,
      },
      update: { hours: data.hours },
    });
    results.push(row);
  }
  revalidateTag("portfolio-metrics", "max");
  revalidateTag("project-budget", "max");
  revalidateTag("project-revenue", "max");
  revalidateTag(`project-resourcing:${id}`, "max");
  return NextResponse.json(results.length === 1 ? results[0] : results);
}
