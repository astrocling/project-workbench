import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { getProjectDataFromAllImports } from "@/lib/floatImportUtils";

/**
 * Backfill FloatScheduledHours for an existing project from all float imports.
 * Use when a project was created after the import (or before projectFloatHours was stored).
 * Matches by project name (normalized: trim, collapse spaces, case-insensitive).
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

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const allRuns = await prisma.floatImportRun.findMany({
    orderBy: { completedAt: "asc" },
    select: {
      completedAt: true,
      projectNames: true,
      projectAssignments: true,
      projectFloatHours: true,
    },
  });
  const { floatList } = getProjectDataFromAllImports(allRuns, project.name);
  const availableInImport = Array.from(
    new Set(
      allRuns.flatMap((run) => {
        const hours = run.projectFloatHours as Record<string, unknown[]> | undefined;
        return hours ? Object.keys(hours) : [];
      })
    )
  );

  if (floatList.length === 0) {
    return NextResponse.json(
      {
        error: "No float data found",
        detail:
          allRuns.length > 0
            ? `No float data for "${project.name}" in any import. Check that the project name matches (including spaces). Re-import the Float CSV if needed.`
            : "No Float import has been run yet. Upload a Float CSV in Admin first, then try again.",
        projectName: project.name,
        availableInImport: availableInImport.length > 0 ? availableInImport : undefined,
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
