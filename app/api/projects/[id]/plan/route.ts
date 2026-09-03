import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  dateString,
  getPlanForProject,
  getProjectDates,
  getSessionUserId,
  parseDate,
  requireEditSession,
  requireSession,
  resolveProjectId,
  validateDateRange,
} from "@/lib/plan/api";
import {
  computeDateMismatch,
  serializePlan,
  toIsoDate,
} from "@/lib/plan/serialize";

const createPhaseSchema = z.object({
  name: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a 6-digit hex (e.g. #1941FA)")
    .optional(),
  order: z.number().int().optional(),
});

const postSchema = z.object({
  kickoffDate: dateString.optional(),
  endDate: dateString.optional(),
  phases: z.array(createPhaseSchema).optional(),
});

const patchSchema = z.object({
  kickoffDate: dateString.optional(),
  endDate: dateString.optional(),
  assumptions: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const datesResult = await getProjectDates(projectResult.id);
  if ("error" in datesResult) return datesResult.error;

  const plan = await getPlanForProject(projectResult.id);
  const projectPayload = {
    startDate: toIsoDate(datesResult.project.startDate),
    endDate: datesResult.project.endDate ? toIsoDate(datesResult.project.endDate) : null,
  };

  if (!plan) {
    return NextResponse.json({
      plan: null,
      project: projectPayload,
    });
  }

  return NextResponse.json({
    plan: serializePlan(plan),
    project: projectPayload,
    dateMismatch: computeDateMismatch(datesResult.project, plan),
  });
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

  const datesResult = await getProjectDates(projectResult.id);
  if ("error" in datesResult) return datesResult.error;

  const existing = await prisma.projectPlan.findUnique({
    where: { projectId: projectResult.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Plan already exists for this project" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const kickoffDate = parseDate(
    parsed.data.kickoffDate ?? toIsoDate(datesResult.project.startDate)
  );
  const endDate = parseDate(
    parsed.data.endDate ??
      (datesResult.project.endDate
        ? toIsoDate(datesResult.project.endDate)
        : toIsoDate(datesResult.project.startDate))
  );

  const rangeError = validateDateRange(kickoffDate, endDate);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const userId = getSessionUserId(auth.session);

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.projectPlan.create({
        data: {
          projectId: projectResult.id,
          kickoffDate,
          endDate,
          assumptions: [],
          updatedByUserId: userId ?? null,
        },
      });

      if (parsed.data.phases?.length) {
        for (let i = 0; i < parsed.data.phases.length; i++) {
          const phase = parsed.data.phases[i]!;
          await tx.planPhase.create({
            data: {
              planId: created.id,
              name: phase.name,
              color: phase.color ?? "#1941FA",
              order: phase.order ?? i,
            },
          });
        }
      }

      return tx.projectPlan.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          phases: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
          updatedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      });
    });

    return NextResponse.json(serializePlan(plan));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEditSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const plan = await getPlanForProject(projectResult.id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const kickoffDate =
    parsed.data.kickoffDate !== undefined ? parseDate(parsed.data.kickoffDate) : plan.kickoffDate;
  const endDate =
    parsed.data.endDate !== undefined ? parseDate(parsed.data.endDate) : plan.endDate;

  const rangeError = validateDateRange(kickoffDate, endDate);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const userId = getSessionUserId(auth.session);

  const updated = await prisma.projectPlan.update({
    where: { id: plan.id },
    data: {
      kickoffDate,
      endDate,
      ...(parsed.data.assumptions !== undefined
        ? { assumptions: parsed.data.assumptions }
        : {}),
      updatedByUserId: userId ?? null,
    },
    include: {
      phases: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
      updatedBy: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  const datesResult = await getProjectDates(projectResult.id);
  if ("error" in datesResult) return datesResult.error;

  return NextResponse.json({
    ...serializePlan(updated),
    dateMismatch: computeDateMismatch(datesResult.project, updated),
  });
}

export async function DELETE(
  _req: NextRequest,
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

  await prisma.projectPlan.delete({ where: { id: plan.id } });
  return new NextResponse(null, { status: 204 });
}
