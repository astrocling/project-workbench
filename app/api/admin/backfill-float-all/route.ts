import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import {
  backfillFloatScheduledHoursAllProjectsFromRuns,
  loadFloatImportRunsForBackfill,
} from "@/lib/backfillFloatFromImports";

/**
 * One-shot: restore FloatScheduledHours for every project from merged FloatImportRun history
 * (same logic as POST /api/projects/[id]/backfill-float per project). Admin-only.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runs = await loadFloatImportRunsForBackfill(prisma);
  if (runs.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "No Float import runs in the database. Run Float sync first.",
      upsertsTotal: 0,
      projectsWithData: 0,
      projectsSkipped: 0,
    });
  }

  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const people = await prisma.person.findMany({ select: { id: true, name: true } });
  const personIdByLowerName = new Map(
    people.map((p) => [p.name.trim().toLowerCase(), p.id] as const)
  );

  const { upsertsTotal, projectsWithData, projectsSkipped } =
    await backfillFloatScheduledHoursAllProjectsFromRuns(prisma, {
      projects,
      runs,
      personIdByLowerName,
    });

  revalidateTag("project-resourcing", "max");

  return NextResponse.json({
    ok: true,
    upsertsTotal,
    projectsWithData,
    projectsSkipped,
    importRunCount: runs.length,
    message: `Backfilled ${upsertsTotal} float hour rows across ${projectsWithData} project(s). ${projectsSkipped} project(s) had no matching data in import history.`,
  });
}
