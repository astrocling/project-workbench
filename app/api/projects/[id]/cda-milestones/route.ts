import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const dateString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "Invalid date",
});

const postSchema = z.object({
  phase: z.string().min(1),
  devStartDate: dateString,
  devEndDate: dateString,
  uatStartDate: dateString,
  uatEndDate: dateString,
  deployDate: dateString,
});

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

  const milestone = await prisma.cdaMilestone.create({
    data: {
      projectId: id,
      phase,
      devStartDate: new Date(devStartDate),
      devEndDate: new Date(devEndDate),
      uatStartDate: new Date(uatStartDate),
      uatEndDate: new Date(uatEndDate),
      deployDate: new Date(deployDate),
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
}
