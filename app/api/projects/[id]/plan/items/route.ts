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
  requireSession,
  resolveProjectId,
  validateDateRange,
  validateItemPayload,
} from "@/lib/plan/api";
import { requirePlanEditSessionForProject } from "@/lib/plan/feature";
import { serializePlanItem } from "@/lib/plan/serialize";
import { touchPlan } from "@/lib/plan/touchPlan";

const postSchema = z.object({
  phaseId: z.string().min(1),
  type: planItemTypeEnum,
  label: z.string().min(1),
  startDate: dateString,
  endDate: dateString,
  order: z.number().int().optional(),
  parentItemId: z.string().min(1).nullable().optional(),
  meetingStatus: planMeetingStatusEnum.nullable().optional(),
  scheduledTime: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idOrSlug } = await params;

  const sessionAuth = await requireSession();
  if ("error" in sessionAuth) return sessionAuth.error;

  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const planAuth = await requirePlanEditSessionForProject(projectResult.id, sessionAuth.session);
  if ("error" in planAuth) return planAuth.error;

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const phase = await prisma.planPhase.findFirst({
    where: {
      id: parsed.data.phaseId,
      plan: { projectId: projectResult.id },
    },
    select: { id: true, planId: true },
  });
  if (!phase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meetingStatus = parsed.data.type === "meeting" ? parsed.data.meetingStatus ?? null : null;
  const scheduledTime = parsed.data.type === "meeting" ? parsed.data.scheduledTime ?? null : null;
  const parentItemId = parsed.data.parentItemId ?? null;
  const dates = normalizeItemDates({
    type: parsed.data.type,
    meetingStatus,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
  });

  const siblings = await getPlanItemsForValidation(phase.planId);
  const payloadError = validateItemPayload(
    {
      type: parsed.data.type,
      meetingStatus,
      startDate: dates.startDate,
      endDate: dates.endDate,
      phaseId: phase.id,
      parentItemId,
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

  const maxOrder = await prisma.planItem.aggregate({
    where: { phaseId: phase.id, parentItemId },
    _max: { order: true },
  });
  const order = parsed.data.order ?? (maxOrder._max.order ?? -1) + 1;

  try {
    const item = await prisma.planItem.create({
      data: {
        phaseId: phase.id,
        type: parsed.data.type,
        label: parsed.data.label,
        startDate,
        endDate,
        order,
        parentItemId,
        meetingStatus,
        scheduledTime,
      },
    });

    await touchPlan(phase.planId, getSessionUserId(planAuth.session));

    return NextResponse.json(serializePlanItem(item));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
