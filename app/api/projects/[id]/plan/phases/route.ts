import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getSessionUserId,
  optionalHexColor,
  requireEditSession,
  resolveProjectId,
} from "@/lib/plan/api";
import { serializePlanPhase } from "@/lib/plan/serialize";
import { touchPlan } from "@/lib/plan/touchPlan";

const postSchema = z.object({
  name: z.string().min(1),
  color: optionalHexColor,
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

  const maxOrder = await prisma.planPhase.aggregate({
    where: { planId: plan.id },
    _max: { order: true },
  });
  const order = parsed.data.order ?? (maxOrder._max.order ?? -1) + 1;

  try {
    const phase = await prisma.planPhase.create({
      data: {
        planId: plan.id,
        name: parsed.data.name,
        color: parsed.data.color ?? "#1941FA",
        order,
      },
      include: { items: { orderBy: { order: "asc" } } },
    });

    await touchPlan(plan.id, getSessionUserId(auth.session));

    return NextResponse.json(serializePlanPhase(phase));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create phase";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
