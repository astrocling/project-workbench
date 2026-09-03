import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  dateString,
  getSessionUserId,
  parseDate,
  planItemTypeEnum,
  requireEditSession,
  resolveProjectId,
  validateDateRange,
} from "@/lib/plan/api";
import { serializePlanItem } from "@/lib/plan/serialize";
import { touchPlan } from "@/lib/plan/touchPlan";

const patchSchema = z.object({
  phaseId: z.string().min(1).optional(),
  type: planItemTypeEnum.optional(),
  label: z.string().min(1).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  order: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireEditSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug, itemId } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const item = await prisma.planItem.findFirst({
    where: {
      id: itemId,
      phase: { plan: { projectId: projectResult.id } },
    },
    include: { phase: { select: { planId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  if (parsed.data.phaseId !== undefined && parsed.data.phaseId !== item.phaseId) {
    const targetPhase = await prisma.planPhase.findFirst({
      where: {
        id: parsed.data.phaseId,
        planId: item.phase.planId,
      },
      select: { id: true },
    });
    if (!targetPhase) {
      return NextResponse.json({ error: "Target phase not found on this plan" }, { status: 400 });
    }
  }

  const startDate =
    parsed.data.startDate !== undefined ? parseDate(parsed.data.startDate) : item.startDate;
  const endDate =
    parsed.data.endDate !== undefined ? parseDate(parsed.data.endDate) : item.endDate;
  const rangeError = validateDateRange(startDate, endDate);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const updated = await prisma.planItem.update({
    where: { id: itemId },
    data: {
      ...(parsed.data.phaseId !== undefined ? { phaseId: parsed.data.phaseId } : {}),
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.startDate !== undefined ? { startDate } : {}),
      ...(parsed.data.endDate !== undefined ? { endDate } : {}),
      ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
    },
  });

  await touchPlan(item.phase.planId, getSessionUserId(auth.session));

  return NextResponse.json(serializePlanItem(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireEditSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug, itemId } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const item = await prisma.planItem.findFirst({
    where: {
      id: itemId,
      phase: { plan: { projectId: projectResult.id } },
    },
    include: { phase: { select: { planId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.planItem.delete({ where: { id: itemId } });
  await touchPlan(item.phase.planId, getSessionUserId(auth.session));

  return new NextResponse(null, { status: 204 });
}
