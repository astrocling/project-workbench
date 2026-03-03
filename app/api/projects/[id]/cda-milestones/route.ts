import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const optionalDateString = z
  .string()
  .optional()
  .refine((s) => s === undefined || s === "" || !Number.isNaN(Date.parse(s)), {
    message: "Invalid date",
  });

const postSchema = z.object({
  phase: z.string().min(1),
  devStartDate: optionalDateString,
  devEndDate: optionalDateString,
  uatStartDate: optionalDateString,
  uatEndDate: optionalDateString,
  deployDate: optionalDateString,
});

function toIsoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const milestones = await prisma.cdaMilestone.findMany({
    where: { projectId: id },
    orderBy: [{ devStartDate: "asc" }, { createdAt: "asc" }],
  });

  const list = milestones.map((m) => ({
    id: m.id,
    phase: m.phase,
    devStartDate: toIsoDate(m.devStartDate),
    devEndDate: toIsoDate(m.devEndDate),
    uatStartDate: toIsoDate(m.uatStartDate),
    uatEndDate: toIsoDate(m.uatEndDate),
    deployDate: toIsoDate(m.deployDate),
    completed: m.completed,
  }));

  return NextResponse.json({ milestones: list });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { phase, devStartDate, devEndDate, uatStartDate, uatEndDate, deployDate } =
    parsed.data;

  const toDate = (s: string | undefined): Date | undefined =>
    s && s.trim() ? new Date(s) : undefined;

  const dDevStart = toDate(devStartDate);
  const dDevEnd = toDate(devEndDate);
  const dUatStart = toDate(uatStartDate);
  const dUatEnd = toDate(uatEndDate);
  const dDeploy = toDate(deployDate);

  try {
    const milestone = await prisma.cdaMilestone.create({
      data: {
        project: { connect: { id } },
        phase,
        devStartDate: dDevStart ?? null,
        devEndDate: dDevEnd ?? null,
        uatStartDate: dUatStart ?? null,
        uatEndDate: dUatEnd ?? null,
        deployDate: dDeploy ?? null,
      },
    });

    return NextResponse.json({
      id: milestone.id,
      phase: milestone.phase,
      devStartDate: toIsoDate(milestone.devStartDate),
      devEndDate: toIsoDate(milestone.devEndDate),
      uatStartDate: toIsoDate(milestone.uatStartDate),
      uatEndDate: toIsoDate(milestone.uatEndDate),
      deployDate: toIsoDate(milestone.deployDate),
      completed: milestone.completed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create milestone";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
