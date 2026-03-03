import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const variationEnum = z.enum(["Standard", "Milestones", "CDA"]);

const patchSchema = z.object({
  reportDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date").optional(),
  variation: variationEnum.optional(),
  completedActivities: z.string().optional(),
  upcomingActivities: z.string().optional(),
  risksIssuesDecisions: z.string().optional(),
  meetingNotes: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug, reportId } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = await prisma.statusReport.findFirst({
    where: { id: reportId, projectId },
    include: { project: true },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(report);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, reportId } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.statusReport.findFirst({
    where: { id: reportId, projectId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const data: { reportDate?: Date; variation?: "Standard" | "Milestones" | "CDA"; completedActivities?: string; upcomingActivities?: string; risksIssuesDecisions?: string; meetingNotes?: string | null } = {};
  if (parsed.data.reportDate != null) {
    const d = new Date(parsed.data.reportDate);
    d.setUTCHours(0, 0, 0, 0);
    data.reportDate = d;
  }
  if (parsed.data.variation != null) data.variation = parsed.data.variation as "Standard" | "Milestones" | "CDA";
  if (parsed.data.completedActivities != null) data.completedActivities = parsed.data.completedActivities;
  if (parsed.data.upcomingActivities != null) data.upcomingActivities = parsed.data.upcomingActivities;
  if (parsed.data.risksIssuesDecisions != null) data.risksIssuesDecisions = parsed.data.risksIssuesDecisions;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "meetingNotes")) data.meetingNotes = parsed.data.meetingNotes ?? null;

  const report = await prisma.statusReport.update({
    where: { id: reportId },
    data,
  });
  return NextResponse.json(report);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug, reportId } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.statusReport.findFirst({
    where: { id: reportId, projectId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.statusReport.delete({ where: { id: reportId } });
  return new NextResponse(null, { status: 204 });
}
