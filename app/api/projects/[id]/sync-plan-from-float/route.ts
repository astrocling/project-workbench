import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { getAsOfDate } from "@/lib/weekUtils";
import { syncPlannedHoursFromFloat } from "@/lib/syncPlanFromFloat";

export const maxDuration = 120;

/**
 * Sync PlannedHours (project plan) from Float scheduled hours in the DB.
 *
 * - **All weeks** that exist in `FloatScheduledHours` for assigned people are copied
 *   into `PlannedHours` (current, future, and past). That fixes cases like Planned still
 *   at an old value (e.g. 10.5) while the Float column already shows the latest sync (e.g. 7.5).
 * - **Gap fill for completed weeks only:** For past weeks with no Float row in the DB,
 *   stored Float import JSON (streamed from `FloatImportRun`) is used so revenue recovery
 *   still gets historical hours from exports.
 *
 * **Important:** Past `FloatScheduledHours` rows are **not** updated by Admin Float API sync
 * (only current/future are overwritten). If the Float **product** shows different hours than
 * Workbench’s Float column for a **completed** week, the DB is stale until a **Backfill**
 * or a deliberate data fix; this route cannot invent Float values that were never stored.
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

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      assignments: {
        where: { hiddenFromGrid: false },
        select: { personId: true },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const assignedPersonIds = new Set(project.assignments.map((a) => a.personId));

  try {
    const result = await syncPlannedHoursFromFloat(prisma, {
      projectId: id,
      projectName: project.name,
      assignedPersonIds,
      asOf: getAsOfDate(),
    });

    if (result.updated > 0) {
      revalidateTag("portfolio-metrics", "max");
      revalidateTag("project-budget", "max");
      revalidateTag("project-revenue", "max");
      revalidateTag(`project-resourcing:${id}`, "max");
    }

    return NextResponse.json({ ok: true, updated: result.updated, message: result.message });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/projects/[id]/sync-plan-from-float]", err);
    return NextResponse.json({ error: "Sync failed", detail: message }, { status: 500 });
  }
}
