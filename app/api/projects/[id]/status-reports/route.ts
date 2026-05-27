import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getProjectId } from "@/lib/slug";
import { projectHasMissingActuals } from "@/lib/projectActualsStale";
import { buildStatusReportPdfData } from "@/lib/statusReportPdfData";
import type { StatusReportSnapshot } from "@/lib/statusReportPdfData";
import { MODULAR_DEFAULT_PANELS, type ReportPanel } from "@/lib/reportPanels";
import { z } from "zod";

const variationEnum = z.enum(["Standard", "Milestones", "CDA", "Modular"]);
const ragEnum = z.enum(["Red", "Amber", "Green"]);

const createSchema = z.object({
  reportDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  variation: variationEnum.default("Standard"),
  /** Number of months before report date to show on timeline (1–4). Default 1. */
  timelinePreviousMonths: z.number().int().min(1).max(4).default(1),
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
  /** When false, Standard report omits bottom budget table and burn chart. Default true. */
  showBudget: z.boolean().default(true),
  panels: z.array(z.any()).optional(),
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
        reportDate: { lte: limit },
      },
      orderBy: { reportDate: "desc" },
      select: {
        id: true,
        reportDate: true,
        variation: true,
        completedActivities: true,
        upcomingActivities: true,
        risksIssuesDecisions: true,
        meetingNotes: true,
        ragOverall: true,
        ragScope: true,
        ragSchedule: true,
        ragBudget: true,
        ragOverallExplanation: true,
        ragScopeExplanation: true,
        ragScheduleExplanation: true,
        ragBudgetExplanation: true,
        snapshot: true,
      },
    });
    return NextResponse.json(report ?? null);
  }

  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");

  const listSelect = {
    id: true,
    reportDate: true,
    variation: true,
    updatedAt: true,
    createdAt: true,
    completedActivities: true,
    upcomingActivities: true,
    risksIssuesDecisions: true,
    meetingNotes: true,
    ragOverall: true,
    ragScope: true,
    ragSchedule: true,
    ragBudget: true,
    ragOverallExplanation: true,
    ragScopeExplanation: true,
    ragScheduleExplanation: true,
    ragBudgetExplanation: true,
    snapshot: true,
    panels: true,
  } as const;

  if (pageParam != null && limitParam != null) {
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 10));
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      prisma.statusReport.findMany({
        where: { projectId: id },
        orderBy: { reportDate: "desc" },
        select: listSelect,
        skip,
        take: limit,
      }),
      prisma.statusReport.count({ where: { projectId: id } }),
    ]);
    return NextResponse.json({ reports, total });
  }

  const reports = await prisma.statusReport.findMany({
    where: { projectId: id },
    orderBy: { reportDate: "desc" },
    select: listSelect,
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
  if (missingActuals && parsed.data.variation !== "Modular") {
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
      variation: parsed.data.variation as "Standard" | "Milestones" | "CDA" | "Modular",
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
      panels: ((parsed.data.panels as ReportPanel[] | undefined) ??
        (parsed.data.variation === "Modular" ? MODULAR_DEFAULT_PANELS : undefined)) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });

  if (parsed.data.variation === "Modular") {
    const forPeriod = new Date(report.reportDate);
    forPeriod.setHours(0, 0, 0, 0);
    const todayStr = forPeriod.toLocaleDateString("en-US", { dateStyle: "medium" });
    const dayOfWeek = forPeriod.getDay();
    const daysToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(forPeriod);
    thisMonday.setDate(forPeriod.getDate() - daysToThisMonday);
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);
    const prevFriday = new Date(prevMonday);
    prevFriday.setDate(prevMonday.getDate() + 4);
    const periodStr = `${prevMonday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${prevFriday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const snapshot: StatusReportSnapshot = {
      period: periodStr,
      today: todayStr,
    };
    await prisma.statusReport.update({
      where: { id: report.id },
      data: { snapshot: snapshot as Prisma.InputJsonValue },
    });
  } else {
    // Lock period, budget, milestones, and timeline to creation time so they don't change when project is edited
    const pdfData = await buildStatusReportPdfData(id, report.id, {
      timelinePreviousMonths: parsed.data.timelinePreviousMonths,
    });
    if (pdfData) {
      const snapshot: StatusReportSnapshot = {
        period: pdfData.period,
        today: pdfData.today,
        budget: pdfData.budget,
        cda: pdfData.cda,
        timeline: pdfData.timeline,
        timelinePreviousMonths: parsed.data.timelinePreviousMonths,
        cdaReportHoursOnly: pdfData.cdaReportHoursOnly,
        showBudget: parsed.data.showBudget,
      };
      await prisma.statusReport.update({
        where: { id: report.id },
        data: { snapshot: snapshot as Prisma.InputJsonValue },
      });
    }
  }

  const updated = await prisma.statusReport.findUnique({
    where: { id: report.id },
  });
  return NextResponse.json(updated ?? report);
}
