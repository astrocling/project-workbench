import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  dateString,
  getPlanItemsForValidation,
  getSessionUserId,
  normalizeItemDates,
  parseDate,
  planItemTypeEnum,
  planMeetingStatusEnum,
  requireEditSession,
  resolveProjectId,
  validateDateRange,
  validateItemPayload,
} from "@/lib/plan/api";
import { collectDescendantIds } from "@/lib/plan/tree";
import { serializePlanItem } from "@/lib/plan/serialize";
import { touchPlan } from "@/lib/plan/touchPlan";

const patchSchema = z.object({
  phaseId: z.string().min(1).optional(),
  type: planItemTypeEnum.optional(),
  label: z.string().min(1).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  order: z.number().int().optional(),
  parentItemId: z.string().min(1).nullable().optional(),
  meetingStatus: planMeetingStatusEnum.nullable().optional(),
  scheduledTime: z.string().nullable().optional(),
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

  const nextPhaseId = parsed.data.phaseId ?? item.phaseId;
  const nextType = parsed.data.type ?? item.type;
  const nextMeetingStatus =
    nextType === "meeting"
      ? parsed.data.meetingStatus !== undefined
        ? parsed.data.meetingStatus
        : item.meetingStatus
      : null;
  const nextScheduledTime =
    nextType === "meeting"
      ? parsed.data.scheduledTime !== undefined
        ? parsed.data.scheduledTime
        : item.scheduledTime
      : null;
  const nextParentItemId =
    parsed.data.parentItemId !== undefined
      ? parsed.data.parentItemId
      : nextPhaseId !== item.phaseId
        ? null
        : item.parentItemId;

  const rawStart =
    parsed.data.startDate !== undefined
      ? parsed.data.startDate
      : item.startDate.toISOString().slice(0, 10);
  const rawEnd =
    parsed.data.endDate !== undefined
      ? parsed.data.endDate
      : item.endDate.toISOString().slice(0, 10);
  const dates = normalizeItemDates({
    type: nextType,
    meetingStatus: nextMeetingStatus,
    startDate: rawStart,
    endDate: rawEnd,
  });

  const siblings = await getPlanItemsForValidation(item.phase.planId);
  const payloadError = validateItemPayload(
    {
      type: nextType,
      meetingStatus: nextMeetingStatus,
      startDate: dates.startDate,
      endDate: dates.endDate,
      phaseId: nextPhaseId,
      parentItemId: nextParentItemId,
      itemId,
    },
    siblings
  );
  if (payloadError) {
    return NextResponse.json({ error: payloadError }, { status: 400 });
  }

  const startDate = parseDate(dates.startDate);
  const endDate = parseDate(dates.endDate);
  const rangeError = validateDateRange(startDate, endDate);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const phaseChanged = nextPhaseId !== item.phaseId;
  const descendantIds = phaseChanged ? collectDescendantIds(siblings, itemId) : [];

  const updated = await prisma.$transaction(async (tx) => {
    if (descendantIds.length > 0) {
      await tx.planItem.updateMany({
        where: { id: { in: descendantIds } },
        data: { phaseId: nextPhaseId },
      });
    }

    return tx.planItem.update({
      where: { id: itemId },
      data: {
        phaseId: nextPhaseId,
        type: nextType,
        ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
        startDate,
        endDate,
        ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
        parentItemId: nextParentItemId,
        meetingStatus: nextMeetingStatus,
        scheduledTime: nextScheduledTime,
      },
    });
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
