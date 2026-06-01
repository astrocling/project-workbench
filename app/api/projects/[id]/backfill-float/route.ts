import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import {
  backfillFloatScheduledHoursForProjectStreaming,
  loadAvailableFloatProjectNamesFromRuns,
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
  // #region agent log
  const debugLog = (
    location: string,
    message: string,
    data: Record<string, unknown>,
    hypothesisId: string
  ) => {
    const payload = {
      sessionId: "536d73",
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    };
    console.log("[backfill-float debug]", JSON.stringify(payload));
    fetch("http://127.0.0.1:7317/ingest/34fb4332-1a06-4b76-a460-798d5289d367", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "536d73" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  };
  // #endregion

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

  // #region agent log
  debugLog(
    "backfill-float/route.ts:POST",
    "backfill start",
    { projectId: id, projectName: project.name, heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
    "H1"
  );
  // #endregion

  try {
    const { upserted, hadImportData, importRunCount } =
      await backfillFloatScheduledHoursForProjectStreaming(prisma, {
        projectId: id,
        projectName: project.name,
      });

    // #region agent log
    debugLog(
      "backfill-float/route.ts:POST",
      "backfill complete",
      {
        projectId: id,
        importRunCount,
        upserted,
        hadImportData,
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      "H1"
    );
    // #endregion

    if (!hadImportData) {
      const availableInImport = await loadAvailableFloatProjectNamesFromRuns(prisma);
      return NextResponse.json(
        {
          error: "No float data found",
          detail:
            importRunCount > 0
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // #region agent log
    debugLog(
      "backfill-float/route.ts:POST",
      "backfill failed",
      {
        projectId: id,
        error: message,
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      "H1"
    );
    // #endregion
    console.error("[POST /api/projects/[id]/backfill-float]", err);
    return NextResponse.json({ error: "Backfill failed", detail: message }, { status: 500 });
  }
}
