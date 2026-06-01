import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { floatClientFromEnv } from "@/lib/float/client";
import {
  backfillFloatScheduledHoursForProjectStreaming,
  loadAvailableFloatProjectNamesWithHoursFromRuns,
  suggestCloseFloatProjectNames,
} from "@/lib/backfillFloatFromImports";
import { normalizeProjectNameForLookup } from "@/lib/floatImportUtils";

function buildNoFloatDataDetail(diagnostics: {
  lookupName: string;
  importRunCount: number;
  runsWithNameMatch: number;
  runsWithFloatHours: number;
  runsWithAssignmentsOnly: number;
  lastMatchedKey: string | null;
}, suggestedNames: string[]): string {
  if (diagnostics.importRunCount === 0) {
    return "No Float sync has been run yet. Run Float sync in Admin first, then try again.";
  }
  if (diagnostics.runsWithNameMatch === 0) {
    const hint =
      suggestedNames.length > 0
        ? ` Similar names in sync history (verify these are the same project, not a sibling): ${suggestedNames.join("; ")}.`
        : "";
    return `No sync run matched the Workbench name "${diagnostics.lookupName}". The name must match Float exactly (Settings → Details). If this is a new Float project, sync history may not have hours yet — use Admin → Float sync instead.${hint}`;
  }
  if (diagnostics.runsWithFloatHours === 0 && diagnostics.runsWithAssignmentsOnly > 0) {
    return `Found "${diagnostics.lookupName}" in ${diagnostics.runsWithNameMatch} sync run(s) with people assigned, but none stored scheduled hours (often 0h tasks in Float). Run Float sync in Admin to pull current hours from Float.`;
  }
  if (diagnostics.lastMatchedKey && diagnostics.lastMatchedKey !== diagnostics.lookupName) {
    return `Matched Float key "${diagnostics.lastMatchedKey}" but no hour rows were merged. Run Float sync in Admin, then try again.`;
  }
  return `No float hours for "${diagnostics.lookupName}" in ${diagnostics.importRunCount} sync run(s). Run Float sync in Admin if hours exist in Float now.`;
}

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
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, floatExternalId: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // #region agent log
  debugLog(
    "backfill-float/route.ts:POST",
    "backfill start",
    {
      projectId: id,
      projectName: project.name,
      floatExternalId: project.floatExternalId,
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    "H2"
  );
  // #endregion

  try {
    let lookupName = project.name;
    let result = await backfillFloatScheduledHoursForProjectStreaming(prisma, {
      projectId: id,
      projectName: lookupName,
    });

    if (!result.hadImportData && project.floatExternalId) {
      try {
        const client = floatClientFromEnv();
        const floatProjects = await client.listAllPages<{ project_id: number; name: string }>(
          "/v3/projects"
        );
        const floatProject = floatProjects.find(
          (p) => String(p.project_id) === project.floatExternalId
        );
        const floatName = floatProject?.name?.trim();
        if (
          floatName &&
          normalizeProjectNameForLookup(floatName) !==
            normalizeProjectNameForLookup(lookupName)
        ) {
          // #region agent log
          debugLog(
            "backfill-float/route.ts:POST",
            "retry with Float API name",
            { workbenchName: lookupName, floatApiName: floatName },
            "H6"
          );
          // #endregion
          lookupName = floatName;
          result = await backfillFloatScheduledHoursForProjectStreaming(prisma, {
            projectId: id,
            projectName: lookupName,
          });
        }
      } catch (floatErr) {
        const message = floatErr instanceof Error ? floatErr.message : String(floatErr);
        // #region agent log
        debugLog(
          "backfill-float/route.ts:POST",
          "Float API name lookup failed",
          { error: message },
          "H6"
        );
        // #endregion
      }
    }

    // #region agent log
    debugLog(
      "backfill-float/route.ts:POST",
      "backfill complete",
      {
        projectId: id,
        lookupName,
        ...result.diagnostics,
        upserted: result.upserted,
        hadImportData: result.hadImportData,
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      "H2"
    );
    // #endregion

    if (!result.hadImportData) {
      const availableWithHours = await loadAvailableFloatProjectNamesWithHoursFromRuns(prisma);
      const suggestedNames = suggestCloseFloatProjectNames(
        project.name,
        availableWithHours
      );
      const existingHourRows = await prisma.floatScheduledHours.count({
        where: { projectId: id },
      });
      let detail = buildNoFloatDataDetail(result.diagnostics, suggestedNames);
      if (existingHourRows > 0) {
        detail += ` This project already has ${existingHourRows} float hour row(s) in the database — those were likely written by Admin Float sync (not this backfill request).`;
      }
      return NextResponse.json(
        {
          error: "No float data found",
          detail,
          projectName: project.name,
          lookupName,
          diagnostics: result.diagnostics,
          existingHourRows,
          suggestedNames: suggestedNames.length > 0 ? suggestedNames : undefined,
          availableWithHours:
            availableWithHours.length > 0 ? availableWithHours.slice(0, 20) : undefined,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        lookupName !== project.name
          ? `Backfilled ${result.upserted} float hour entries using Float name "${lookupName}" (Workbench name is "${project.name}").`
          : `Backfilled ${result.upserted} float hour entries for ${lookupName}`,
      count: result.upserted,
      floatNameUsed: lookupName !== project.name ? lookupName : undefined,
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
