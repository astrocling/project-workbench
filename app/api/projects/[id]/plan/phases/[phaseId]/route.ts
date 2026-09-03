import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getSessionUserId,
  optionalHexColor,
  requireSession,
  resolveProjectId,
} from "@/lib/plan/api";
import { requirePlanEditSessionForProject } from "@/lib/plan/feature";
import { serializePlanPhase } from "@/lib/plan/serialize";
import { touchPlan } from "@/lib/plan/touchPlan";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  color: optionalHexColor,
  order: z.number().int().optional(),
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

  const planAuth = await requirePlanEditSessionForProject(projectResult.id);
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

  const updated = await prisma.planPhase.update({
    where: { id: phaseId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
    },
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

  const planAuth = await requirePlanEditSessionForProject(projectResult.id);
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
