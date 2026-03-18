import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { formatWeekKey } from "@/lib/weekUtils";

/**
 * Float uses weeks Sunday–Saturday; the CSV header is the Sunday.
 * Import stores our week start (Monday of that same week). Stored weekStartDate is already
 * the grid week key; return it as YYYY-MM-DD.
 */
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
  const rows = await prisma.floatScheduledHours.findMany({
    where,
    select: { projectId: true, personId: true, weekStartDate: true, hours: true },
  });
  return NextResponse.json(
    rows.map((r) => ({
      projectId: r.projectId,
      personId: r.personId,
      weekStartDate: formatWeekKey(r.weekStartDate),
      hours: r.hours,
    }))
  );
}
