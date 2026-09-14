import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { coercePlanItemDates } from "@/lib/plan/dateInput";
import {
  dateString,
  getPlanItemsForValidation,
  getSessionUserId,
  normalizeItemDates,
  optionalReportLabel,
  parseDate,
  planItemStatusEnum,
  planItemTypeEnum,
  planMeetingStatusEnum,
  requireSession,
  resolveProjectId,
  validateDateRange,
  validateItemPayload,
} from "@/lib/plan/api";
import { requirePlanEditSessionForProject } from "@/lib/plan/feature";
import { reindexSiblingOrders, validateInsertBefore } from "@/lib/plan/itemDrop";
import { collectDescendantIds } from "@/lib/plan/tree";
import { serializePlanItem } from "@/lib/plan/serialize";
import { touchPlan } from "@/lib/plan/touchPlan";
import { defaultShowOnReports } from "@/lib/plan/reportVisibility";
import { completedAtForStatus } from "@/lib/plan/completion";

const patchSchema = z.object({
  phaseId: z.string().min(1).optional(),
  type: planItemTypeEnum.optional(),
  label: z.string().min(1).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  order: z.number().int().optional(),
  parentItemId: z.string().min(1).nullable().optional(),
  insertBeforeItemId: z.string().min(1).nullable().optional(),
  meetingStatus: planMeetingStatusEnum.nullable().optional(),
  scheduledTime: z.string().nullable().optional(),
  showOnReports: z.boolean().optional(),
  reportLabel: optionalReportLabel,
  status: planItemStatusEnum.optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: idOrSlug, itemId } = await params;

  const sessionAuth = await requireSession();
  if ("error" in sessionAuth) return sessionAuth.error;

  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const planAuth = await requirePlanEditSessionForProject(projectResult.id, sessionAuth.session);
  if ("error" in planAuth) return planAuth.error;

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
  const nextShowOnReports =
    parsed.data.showOnReports !== undefined
      ? parsed.data.showOnReports
      : parsed.data.type !== undefined || parsed.data.meetingStatus !== undefined
        ? defaultShowOnReports(nextType, nextMeetingStatus)
        : item.showOnReports;
  const nextStatus = parsed.data.status ?? item.status;
  const nextParentItemId =
    parsed.data.parentItemId !== undefined
      ? parsed.data.parentItemId
      : nextPhaseId !== item.phaseId
        ? null
        : item.parentItemId;

  const storedStart = item.startDate.toISOString().slice(0, 10);
  const storedEnd = item.endDate.toISOString().slice(0, 10);
  const coerced = coercePlanItemDates({
    previousStart: storedStart,
    previousEnd: storedEnd,
    nextStart: parsed.data.startDate,
    nextEnd: parsed.data.endDate,
  });
  const dates = normalizeItemDates({
    type: nextType,
    meetingStatus: nextMeetingStatus,
    startDate: coerced.startDate,
    endDate: coerced.endDate,
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
  const placeRequested = parsed.data.insertBeforeItemId !== undefined;
  const insertBeforeItemId = placeRequested ? parsed.data.insertBeforeItemId ?? null : null;

  if (placeRequested) {
    const placeError = validateInsertBefore(
      siblings,
      itemId,
      nextPhaseId,
      nextParentItemId,
      insertBeforeItemId
    );
    if (placeError) {
      return NextResponse.json({ error: placeError }, { status: 400 });
    }
  }

  const siblingOrders = placeRequested
    ? reindexSiblingOrders(
        siblings,
        itemId,
        nextPhaseId,
        nextParentItemId,
        insertBeforeItemId
      )
    : null;

  const movedOrder = siblingOrders?.find((row) => row.id === itemId)?.order;

  const data: Prisma.PlanItemUpdateInput = {
    type: nextType,
    startDate,
    endDate,
    meetingStatus: nextMeetingStatus,
    scheduledTime: nextScheduledTime,
    ...(nextPhaseId !== item.phaseId ? { phase: { connect: { id: nextPhaseId } } } : {}),
    ...(nextParentItemId !== item.parentItemId
      ? {
          parent: nextParentItemId
            ? { connect: { id: nextParentItemId } }
            : { disconnect: true },
        }
      : {}),
    ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
    ...(movedOrder !== undefined
      ? { order: movedOrder }
      : parsed.data.order !== undefined
        ? { order: parsed.data.order }
        : {}),
    ...(nextShowOnReports !== undefined ? { showOnReports: nextShowOnReports } : {}),
    ...(parsed.data.reportLabel !== undefined ? { reportLabel: parsed.data.reportLabel } : {}),
    ...(nextStatus !== undefined
      ? {
          status: nextStatus,
          completedAt: completedAtForStatus(nextStatus, item.completedAt) ?? null,
        }
      : {}),
  };

  const needsMoveTx = descendantIds.length > 0 || siblingOrders != null;
  const updated = needsMoveTx
    ? await prisma.$transaction(async (tx) => {
        if (descendantIds.length > 0) {
          await tx.planItem.updateMany({
            where: { id: { in: descendantIds } },
            data: { phaseId: nextPhaseId },
          });
        }
        if (siblingOrders) {
          for (const row of siblingOrders) {
            if (row.id === itemId) continue;
            await tx.planItem.update({
              where: { id: row.id },
              data: { order: row.order },
            });
          }
        }
        return tx.planItem.update({ where: { id: itemId }, data });
      })
    : await prisma.planItem.update({ where: { id: itemId }, data });

  await touchPlan(item.phase.planId, getSessionUserId(planAuth.session));

  return NextResponse.json(serializePlanItem(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: idOrSlug, itemId } = await params;

  const sessionAuth = await requireSession();
  if ("error" in sessionAuth) return sessionAuth.error;

  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const planAuth = await requirePlanEditSessionForProject(projectResult.id, sessionAuth.session);
  if ("error" in planAuth) return planAuth.error;

  const item = await prisma.planItem.findFirst({
    where: {
      id: itemId,
      phase: { plan: { projectId: projectResult.id } },
    },
    include: { phase: { select: { planId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.planItem.delete({ where: { id: itemId } });
  await touchPlan(item.phase.planId, getSessionUserId(planAuth.session));

  return new NextResponse(null, { status: 204 });
}
