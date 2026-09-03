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

const postSchema = z.object({
  phaseId: z.string().min(1),
  type: planItemTypeEnum,
  label: z.string().min(1),
  startDate: dateString,
  endDate: dateString,
  order: z.number().int().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

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

  const startDate = parseDate(parsed.data.startDate);
  const endDate = parseDate(parsed.data.endDate);
  const rangeError = validateDateRange(startDate, endDate);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const maxOrder = await prisma.planItem.aggregate({
    where: { phaseId: phase.id },
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
      },
    });

    await touchPlan(phase.planId, getSessionUserId(auth.session));

    return NextResponse.json(serializePlanItem(item));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
