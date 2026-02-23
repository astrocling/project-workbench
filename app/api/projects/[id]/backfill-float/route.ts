import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

/**
 * Backfill FloatScheduledHours for an existing project from the last float import.
 * Use when a project was created after the import (or before projectFloatHours was stored).
 * Matches by project name (case-insensitive) in the import's projectFloatHours.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });
  const projectFloatHours =
    (lastImport?.projectFloatHours as Record<
      string,
      Array<{
        personName: string;
        roleName: string;
        weeks: Array<{ weekStart: string; hours: number }>;
      }>
    >) ?? {};

  const floatKey = Object.keys(projectFloatHours).find(
    (k) => k.toLowerCase() === project.name.toLowerCase()
  );
  const floatList = floatKey ? projectFloatHours[floatKey] : [];

  if (floatList.length === 0) {
    return NextResponse.json(
      {
        error: "No float data found",
        detail:
          "The last import has no float data for this project name. Re-import the Float CSV first, then try again.",
        projectName: project.name,
        availableInImport: Object.keys(projectFloatHours),
      },
      { status: 404 }
    );
  }

  let count = 0;
  for (const { personName, weeks } of floatList) {
    const person = await prisma.person.findFirst({
      where: { name: { equals: personName, mode: "insensitive" } },
    });
    if (!person) continue;
    for (const { weekStart, hours } of weeks) {
      if (hours == null || hours === undefined) continue;
      const weekStartDate = new Date(weekStart + "T00:00:00.000Z");
      await prisma.floatScheduledHours.upsert({
        where: {
          projectId_personId_weekStartDate: {
            projectId: id,
            personId: person.id,
            weekStartDate,
          },
        },
        create: {
          projectId: id,
          personId: person.id,
          weekStartDate,
          hours,
        },
        update: { hours },
      });
      count++;
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Backfilled ${count} float hour entries for ${project.name}`,
    count,
  });
}
