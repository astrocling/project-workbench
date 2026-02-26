import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";
import { getWeekStartDate } from "@/lib/weekUtils";

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await prisma.plannedHours.findMany({
    where: { projectId: id },
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
  const items = Array.isArray(body) ? body : [body];
  const results = [];
  for (const item of items) {
    const parsed = updateSchema.safeParse(item);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const weekStart = new Date(parsed.data.weekStartDate);
    const row = await prisma.plannedHours.upsert({
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
  return NextResponse.json(results.length === 1 ? results[0] : results);
}
