import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  dateString,
  getSessionUserId,
  parseDate,
  planMeetingStatusEnum,
  requireEditSession,
  resolveProjectId,
  validateDateRange,
} from "@/lib/plan/api";
import { serializePlanMeeting } from "@/lib/plan/serialize";
import { touchPlan } from "@/lib/plan/touchPlan";

const patchSchema = z.object({
  label: z.string().min(1).optional(),
  status: planMeetingStatusEnum.optional(),
  windowStart: dateString.optional(),
  windowEnd: dateString.optional(),
  scheduledDate: dateString.optional().nullable(),
  scheduledTime: z.string().optional().nullable(),
  relatedPhaseId: z.string().optional().nullable(),
  relatedItemId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  order: z.number().int().optional(),
});

async function validateMeetingRelations(
  planId: string,
  relatedPhaseId: string | null | undefined,
  relatedItemId: string | null | undefined
): Promise<string | null> {
  if (relatedPhaseId) {
    const phase = await prisma.planPhase.findFirst({
      where: { id: relatedPhaseId, planId },
      select: { id: true },
    });
    if (!phase) return "Related phase not found on this plan";
  }

  if (relatedItemId) {
    const item = await prisma.planItem.findFirst({
      where: { id: relatedItemId, phase: { planId } },
      select: { id: true },
    });
    if (!item) return "Related item not found on this plan";
  }

  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  const auth = await requireEditSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug, meetingId } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const meeting = await prisma.planMeeting.findFirst({
    where: {
      id: meetingId,
      plan: { projectId: projectResult.id },
    },
    select: {
      id: true,
      planId: true,
      status: true,
      scheduledDate: true,
      windowStart: true,
      windowEnd: true,
    },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const relationError = await validateMeetingRelations(
    meeting.planId,
    parsed.data.relatedPhaseId,
    parsed.data.relatedItemId
  );
  if (relationError) {
    return NextResponse.json({ error: relationError }, { status: 400 });
  }

  const status = parsed.data.status ?? meeting.status;
  const scheduledDate =
    parsed.data.scheduledDate !== undefined
      ? parsed.data.scheduledDate != null && parsed.data.scheduledDate !== ""
        ? parseDate(parsed.data.scheduledDate)
        : null
      : meeting.scheduledDate;

  if (status === "scheduled" && !scheduledDate) {
    return NextResponse.json(
      { error: "scheduledDate is required when status is scheduled" },
      { status: 400 }
    );
  }

  const windowStart =
    parsed.data.windowStart !== undefined
      ? parseDate(parsed.data.windowStart)
      : meeting.windowStart;
  const windowEnd =
    parsed.data.windowEnd !== undefined ? parseDate(parsed.data.windowEnd) : meeting.windowEnd;

  const rangeError = validateDateRange(windowStart, windowEnd);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const updated = await prisma.planMeeting.update({
    where: { id: meetingId },
    data: {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.windowStart !== undefined || parsed.data.windowEnd !== undefined
        ? { windowStart, windowEnd }
        : {}),
      ...(parsed.data.scheduledDate !== undefined ? { scheduledDate } : {}),
      ...(parsed.data.scheduledTime !== undefined
        ? { scheduledTime: parsed.data.scheduledTime }
        : {}),
      ...(parsed.data.relatedPhaseId !== undefined
        ? { relatedPhaseId: parsed.data.relatedPhaseId }
        : {}),
      ...(parsed.data.relatedItemId !== undefined
        ? { relatedItemId: parsed.data.relatedItemId }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
    },
  });

  await touchPlan(meeting.planId, getSessionUserId(auth.session));

  return NextResponse.json(serializePlanMeeting(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  const auth = await requireEditSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug, meetingId } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const meeting = await prisma.planMeeting.findFirst({
    where: {
      id: meetingId,
      plan: { projectId: projectResult.id },
    },
    select: { id: true, planId: true },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.planMeeting.delete({ where: { id: meetingId } });
  await touchPlan(meeting.planId, getSessionUserId(auth.session));

  return new NextResponse(null, { status: 204 });
}
