import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { formatWeekKey } from "@/lib/weekUtils";

/**
 * Float uses weeks Sunday–Saturday; the CSV header is the Sunday.
 * Import stores our week start (Monday of that same week). Stored weekStartDate is already
 * the grid week key; return it as YYYY-MM-DD.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await prisma.floatScheduledHours.findMany({
    where: { projectId: id },
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
