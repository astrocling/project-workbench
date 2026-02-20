import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: id },
    select: { personId: true },
  });
  const personIds = assignments.map((a) => a.personId);
  const impacts = await prisma.pTOHolidayImpact.findMany({
    where: { personId: { in: personIds } },
  });
  return NextResponse.json(impacts);
}
