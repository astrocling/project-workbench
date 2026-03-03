import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const variationEnum = z.enum(["Standard", "Milestones", "CDA"]);

const createSchema = z.object({
  reportDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  variation: variationEnum.default("Standard"),
  completedActivities: z.string(),
  upcomingActivities: z.string(),
  risksIssuesDecisions: z.string(),
  meetingNotes: z.string().nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const previousFor = searchParams.get("previousFor");
  if (previousFor) {
    const limit = new Date(previousFor);
    if (isNaN(limit.getTime())) {
      return NextResponse.json({ error: "Invalid previousFor date" }, { status: 400 });
    }
    const report = await prisma.statusReport.findFirst({
      where: {
        projectId: id,
        reportDate: { lt: limit },
      },
      orderBy: { reportDate: "desc" },
      select: {
        id: true,
        reportDate: true,
        variation: true,
        completedActivities: true,
        upcomingActivities: true,
        risksIssuesDecisions: true,
      },
    });
    return NextResponse.json(report ?? null);
  }

  const reports = await prisma.statusReport.findMany({
    where: { projectId: id },
    orderBy: { reportDate: "desc" },
  });
  return NextResponse.json(reports);
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const reportDate = new Date(parsed.data.reportDate);
  reportDate.setUTCHours(0, 0, 0, 0);

  const report = await prisma.statusReport.create({
    data: {
      projectId: id,
      reportDate,
      variation: parsed.data.variation as "Standard" | "Milestones" | "CDA",
      completedActivities: parsed.data.completedActivities,
      upcomingActivities: parsed.data.upcomingActivities,
      risksIssuesDecisions: parsed.data.risksIssuesDecisions,
      meetingNotes: parsed.data.meetingNotes ?? null,
    },
  });
  return NextResponse.json(report);
}
