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

const postSchema = z.object({
  label: z.string().min(1),
  status: planMeetingStatusEnum,
  windowStart: dateString,
  windowEnd: dateString,
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const plan = await prisma.projectPlan.findUnique({
    where: { projectId: projectResult.id },
    select: { id: true },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const windowStart = parseDate(parsed.data.windowStart);
  const windowEnd = parseDate(parsed.data.windowEnd);
  const rangeError = validateDateRange(windowStart, windowEnd);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const relationError = await validateMeetingRelations(
    plan.id,
    parsed.data.relatedPhaseId,
    parsed.data.relatedItemId
  );
  if (relationError) {
    return NextResponse.json({ error: relationError }, { status: 400 });
  }

  if (parsed.data.status === "scheduled" && !parsed.data.scheduledDate) {
    return NextResponse.json(
      { error: "scheduledDate is required when status is scheduled" },
      { status: 400 }
    );
  }

  const scheduledDate =
    parsed.data.scheduledDate != null && parsed.data.scheduledDate !== ""
      ? parseDate(parsed.data.scheduledDate)
      : null;

  const maxOrder = await prisma.planMeeting.aggregate({
    where: { planId: plan.id },
    _max: { order: true },
  });
  const order = parsed.data.order ?? (maxOrder._max.order ?? -1) + 1;

  try {
    const meeting = await prisma.planMeeting.create({
      data: {
        planId: plan.id,
        label: parsed.data.label,
        status: parsed.data.status,
        windowStart,
        windowEnd,
        scheduledDate,
        scheduledTime: parsed.data.scheduledTime ?? null,
        relatedPhaseId: parsed.data.relatedPhaseId ?? null,
        relatedItemId: parsed.data.relatedItemId ?? null,
        notes: parsed.data.notes ?? null,
        order,
      },
    });

    await touchPlan(plan.id, getSessionUserId(auth.session));

    return NextResponse.json(serializePlanMeeting(meeting));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create meeting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
