import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getSessionUserId,
  optionalHexColor,
  optionalReportLabel,
  requireSession,
  resolveProjectId,
} from "@/lib/plan/api";
import { requirePlanEditSessionForProject } from "@/lib/plan/feature";
import { serializePlanPhase } from "@/lib/plan/serialize";
import { touchPlan } from "@/lib/plan/touchPlan";
import { reindexPhaseOrders, validateInsertBeforePhase } from "@/lib/plan/phaseDrop";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  color: optionalHexColor,
  order: z.number().int().optional(),
  insertBeforePhaseId: z.string().min(1).nullable().optional(),
  showOnReports: z.boolean().optional(),
  reportLabel: optionalReportLabel,
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const { id: idOrSlug, phaseId } = await params;

  const sessionAuth = await requireSession();
  if ("error" in sessionAuth) return sessionAuth.error;

  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const planAuth = await requirePlanEditSessionForProject(projectResult.id, sessionAuth.session);
  if ("error" in planAuth) return planAuth.error;

  const phase = await prisma.planPhase.findFirst({
    where: { id: phaseId, plan: { projectId: projectResult.id } },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!phase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const placeRequested = parsed.data.insertBeforePhaseId !== undefined;
  const insertBeforePhaseId = placeRequested ? parsed.data.insertBeforePhaseId ?? null : null;
  const siblingPhases = placeRequested
    ? await prisma.planPhase.findMany({
        where: { planId: phase.planId },
        select: { id: true, order: true },
      })
    : [];

  if (placeRequested) {
    const placeError = validateInsertBeforePhase(siblingPhases, phaseId, insertBeforePhaseId);
    if (placeError) {
      return NextResponse.json({ error: placeError }, { status: 400 });
    }
  }

  const phaseOrders = placeRequested
    ? reindexPhaseOrders(siblingPhases, phaseId, insertBeforePhaseId)
    : null;
  const movedOrder = phaseOrders?.find((row) => row.id === phaseId)?.order;

  const data = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    ...(movedOrder !== undefined
      ? { order: movedOrder }
      : parsed.data.order !== undefined
        ? { order: parsed.data.order }
        : {}),
    ...(parsed.data.showOnReports !== undefined ? { showOnReports: parsed.data.showOnReports } : {}),
    ...(parsed.data.reportLabel !== undefined ? { reportLabel: parsed.data.reportLabel } : {}),
  };

  const updated = phaseOrders
    ? await prisma.$transaction(async (tx) => {
        for (const row of phaseOrders) {
          if (row.id === phaseId) continue;
          await tx.planPhase.update({
            where: { id: row.id },
            data: { order: row.order },
          });
        }
        return tx.planPhase.update({
          where: { id: phaseId },
          data,
          include: { items: { orderBy: { order: "asc" } } },
        });
      })
    : await prisma.planPhase.update({
        where: { id: phaseId },
        data,
        include: { items: { orderBy: { order: "asc" } } },
      });

  await touchPlan(phase.planId, getSessionUserId(planAuth.session));

  return NextResponse.json(serializePlanPhase(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const { id: idOrSlug, phaseId } = await params;

  const sessionAuth = await requireSession();
  if ("error" in sessionAuth) return sessionAuth.error;

  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const planAuth = await requirePlanEditSessionForProject(projectResult.id, sessionAuth.session);
  if ("error" in planAuth) return planAuth.error;

  const phase = await prisma.planPhase.findFirst({
    where: { id: phaseId, plan: { projectId: projectResult.id } },
    select: { id: true, planId: true },
  });
  if (!phase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.planPhase.delete({ where: { id: phaseId } });
  await touchPlan(phase.planId, getSessionUserId(planAuth.session));

  return new NextResponse(null, { status: 204 });
}
