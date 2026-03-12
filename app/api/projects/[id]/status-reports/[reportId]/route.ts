import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { deleteCachedPdf } from "@/lib/statusReportPdfCache";
import { z } from "zod";

const variationEnum = z.enum(["Standard", "Milestones", "CDA"]);
const ragEnum = z.enum(["Red", "Amber", "Green"]);

// reportDate is intentionally omitted so reporting period stays locked when editing
const patchSchema = z.object({
  variation: variationEnum.optional(),
  completedActivities: z.string().optional(),
  upcomingActivities: z.string().optional(),
  risksIssuesDecisions: z.string().optional(),
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

  type UpdateData = {
    variation?: "Standard" | "Milestones" | "CDA";
    completedActivities?: string;
    upcomingActivities?: string;
    risksIssuesDecisions?: string;
    meetingNotes?: string | null;
    ragOverall?: "Red" | "Amber" | "Green" | null;
    ragScope?: "Red" | "Amber" | "Green" | null;
    ragSchedule?: "Red" | "Amber" | "Green" | null;
    ragBudget?: "Red" | "Amber" | "Green" | null;
    ragOverallExplanation?: string | null;
    ragScopeExplanation?: string | null;
    ragScheduleExplanation?: string | null;
    ragBudgetExplanation?: string | null;
  };
  const data: UpdateData = {};
  if (parsed.data.variation != null) data.variation = parsed.data.variation as "Standard" | "Milestones" | "CDA";
  if (parsed.data.completedActivities != null) data.completedActivities = parsed.data.completedActivities;
  if (parsed.data.upcomingActivities != null) data.upcomingActivities = parsed.data.upcomingActivities;
  if (parsed.data.risksIssuesDecisions != null) data.risksIssuesDecisions = parsed.data.risksIssuesDecisions;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "meetingNotes")) data.meetingNotes = parsed.data.meetingNotes ?? null;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "ragOverall")) data.ragOverall = parsed.data.ragOverall ?? null;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "ragScope")) data.ragScope = parsed.data.ragScope ?? null;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "ragSchedule")) data.ragSchedule = parsed.data.ragSchedule ?? null;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "ragBudget")) data.ragBudget = parsed.data.ragBudget ?? null;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "ragOverallExplanation")) data.ragOverallExplanation = parsed.data.ragOverallExplanation ?? null;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "ragScopeExplanation")) data.ragScopeExplanation = parsed.data.ragScopeExplanation ?? null;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "ragScheduleExplanation")) data.ragScheduleExplanation = parsed.data.ragScheduleExplanation ?? null;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "ragBudgetExplanation")) data.ragBudgetExplanation = parsed.data.ragBudgetExplanation ?? null;

  const report = await prisma.statusReport.update({
    where: { id: reportId },
    data,
  });
  await deleteCachedPdf(reportId);
  revalidateTag(`status-report-${reportId}`, "default");
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
  await deleteCachedPdf(reportId);
  revalidateTag(`status-report-${reportId}`, "default");
  return new NextResponse(null, { status: 204 });
}
