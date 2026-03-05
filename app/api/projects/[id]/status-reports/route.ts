import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getProjectId } from "@/lib/slug";
import { projectHasMissingActuals } from "@/lib/projectActualsStale";
import { buildStatusReportPdfData } from "@/lib/statusReportPdfData";
import type { StatusReportSnapshot } from "@/lib/statusReportPdfData";
import { z } from "zod";

const variationEnum = z.enum(["Standard", "Milestones", "CDA"]);
const ragEnum = z.enum(["Red", "Amber", "Green"]);

const createSchema = z.object({
  reportDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  variation: variationEnum.default("Standard"),
  completedActivities: z.string(),
  upcomingActivities: z.string(),
  risksIssuesDecisions: z.string(),
  meetingNotes: z.string().nullable().optional(),
  ragOverall: ragEnum.nullable().optional(),
  ragScope: ragEnum.nullable().optional(),
  ragSchedule: ragEnum.nullable().optional(),
  ragBudget: ragEnum.nullable().optional(),
  ragOverallExplanation: z.string().nullable().optional(),
  ragScopeExplanation: z.string().nullable().optional(),
  ragScheduleExplanation: z.string().nullable().optional(),
  ragBudgetExplanation: z.string().nullable().optional(),
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
        ragOverall: true,
        ragScope: true,
        ragSchedule: true,
        ragBudget: true,
        ragOverallExplanation: true,
        ragScopeExplanation: true,
        ragScheduleExplanation: true,
        ragBudgetExplanation: true,
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

  const missingActuals = await projectHasMissingActuals(id);
  if (missingActuals) {
    return NextResponse.json(
      {
        error:
          "Actuals are stale. Update hours in the Resourcing tab before creating a new status report.",
      },
      { status: 400 }
    );
  }

  const report = await prisma.statusReport.create({
    data: {
      projectId: id,
      reportDate,
      variation: parsed.data.variation as "Standard" | "Milestones" | "CDA",
      completedActivities: parsed.data.completedActivities,
      upcomingActivities: parsed.data.upcomingActivities,
      risksIssuesDecisions: parsed.data.risksIssuesDecisions,
      meetingNotes: parsed.data.meetingNotes ?? null,
      ragOverall: parsed.data.ragOverall ?? null,
      ragScope: parsed.data.ragScope ?? null,
      ragSchedule: parsed.data.ragSchedule ?? null,
      ragBudget: parsed.data.ragBudget ?? null,
      ragOverallExplanation: parsed.data.ragOverallExplanation ?? null,
      ragScopeExplanation: parsed.data.ragScopeExplanation ?? null,
      ragScheduleExplanation: parsed.data.ragScheduleExplanation ?? null,
      ragBudgetExplanation: parsed.data.ragBudgetExplanation ?? null,
    },
  });

  // Lock period, budget, milestones, and timeline to creation time so they don't change when project is edited
  const pdfData = await buildStatusReportPdfData(id, report.id);
  if (pdfData) {
    const snapshot: StatusReportSnapshot = {
      period: pdfData.period,
      today: pdfData.today,
      budget: pdfData.budget,
      cda: pdfData.cda,
      timeline: pdfData.timeline,
    };
    await prisma.statusReport.update({
      where: { id: report.id },
      data: { snapshot: snapshot as Prisma.InputJsonValue },
    });
  }

  const updated = await prisma.statusReport.findUnique({
    where: { id: report.id },
  });
  return NextResponse.json(updated ?? report);
}
