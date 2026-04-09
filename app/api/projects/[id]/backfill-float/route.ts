import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import {
  backfillFloatScheduledHoursForProjectFromRuns,
  loadFloatImportRunsForBackfill,
} from "@/lib/backfillFloatFromImports";

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

  const allRuns = await loadFloatImportRunsForBackfill(prisma);
  const availableInImport = Array.from(
    new Set(
      allRuns.flatMap((run) => {
        const hours = run.projectFloatHours as Record<string, unknown[]> | undefined;
        return hours ? Object.keys(hours) : [];
      })
    )
  );

  const { upserted, hadImportData } = await backfillFloatScheduledHoursForProjectFromRuns(
    prisma,
    {
      projectId: id,
      projectName: project.name,
      runs: allRuns,
    }
  );

  if (!hadImportData) {
    return NextResponse.json(
      {
        error: "No float data found",
        detail:
          allRuns.length > 0
            ? `No float data for "${project.name}" in any sync. Check that the project name matches (including spaces). Run Float sync again if needed.`
            : "No Float sync has been run yet. Run Float sync in Admin first, then try again.",
        projectName: project.name,
        availableInImport: availableInImport.length > 0 ? availableInImport : undefined,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Backfilled ${upserted} float hour entries for ${project.name}`,
    count: upserted,
  });
}
