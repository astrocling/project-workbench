import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { computeBudgetRollups } from "@/lib/budgetCalculations";

const budgetLineSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["SOW", "CO", "Other"]),
  label: z.string(),
  lowHours: z.number().min(0),
  highHours: z.number().min(0),
  lowDollars: z.number().min(0),
  highDollars: z.number().min(0),
}).refine((d) => d.lowHours <= d.highHours && d.lowDollars <= d.highDollars, {
  message: "low must be <= high",
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      budgetLines: true,
      assignments: { include: { role: true, person: true } },
      plannedHours: true,
      actualHours: true,
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build weekly rows for each assignment
  const singleRate =
    project.useSingleRate && project.singleBillRate != null
      ? Number(project.singleBillRate)
      : null;
  const rateByRole = new Map<string, number>();
  for (const a of project.assignments) {
    const override = a.billRateOverride ? Number(a.billRateOverride) : null;
    if (override != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, override);
    } else if (singleRate != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, singleRate);
    } else {
      const prr = await prisma.projectRoleRate.findUnique({
        where: {
          projectId_roleId: { projectId: id, roleId: a.roleId },
        },
      });
      rateByRole.set(`${a.personId}-${a.roleId}`, prr ? Number(prr.billRate) : 0);
    }
  }

  const { getAllWeeks } = await import("@/lib/weekUtils");
  const allWeeks = getAllWeeks(project.startDate, project.endDate);
  const weeklyRows: Array<{
    weekStartDate: Date;
    plannedHours: number;
    actualHours: number | null;
    rate: number;
  }> = [];

  for (const a of project.assignments) {
    const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
    for (const weekDate of allWeeks) {
      const wk = weekDate.toISOString().slice(0, 10);
      const planned = project.plannedHours.find(
        (ph) =>
          ph.personId === a.personId &&
          ph.weekStartDate.toISOString().slice(0, 10) === wk
      );
      const actual = project.actualHours.find(
        (ah) =>
          ah.personId === a.personId &&
          ah.weekStartDate.toISOString().slice(0, 10) === wk
      );
      weeklyRows.push({
        weekStartDate: new Date(weekDate),
        plannedHours: planned ? Number(planned.hours) : 0,
        actualHours: actual?.hours != null ? Number(actual.hours) : null,
        rate,
      });
    }
  }

  const budgetLines = project.budgetLines.map((bl) => ({
    lowHours: Number(bl.lowHours),
    highHours: Number(bl.highHours),
    lowDollars: Number(bl.lowDollars),
    highDollars: Number(bl.highDollars),
  }));

  const rollups = computeBudgetRollups(
    project.startDate,
    project.endDate,
    weeklyRows,
    budgetLines
  );

  // Last week (by weekStartDate) that has at least one actual hour
  const weeksWithActuals = weeklyRows
    .filter((r) => r.actualHours != null)
    .map((r) => r.weekStartDate.getTime());
  const lastWeekWithActuals =
    weeksWithActuals.length > 0
      ? new Date(Math.max(...weeksWithActuals)).toISOString().slice(0, 10)
      : null;

  const peopleSummary: Array<{
    personName: string;
    roleName: string;
    rate: number;
    projectedHours: number;
    projectedRevenue: number;
    actualHours: number;
    actualRevenue: number;
  }> = [];
  for (const a of project.assignments) {
    let projectedHours = 0;
    let actualHoursSum = 0;
    for (const weekDate of allWeeks) {
      const wk = weekDate.toISOString().slice(0, 10);
      const ph = project.plannedHours.find(
        (p) => p.personId === a.personId && p.weekStartDate.toISOString().slice(0, 10) === wk
      );
      const ah = project.actualHours.find(
        (h) => h.personId === a.personId && h.weekStartDate.toISOString().slice(0, 10) === wk
      );
      projectedHours += ph ? Number(ph.hours) : 0;
      if (ah?.hours != null) actualHoursSum += Number(ah.hours);
    }
    const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
    peopleSummary.push({
      personName: a.person.name,
      roleName: a.role.name,
      rate,
      projectedHours,
      projectedRevenue: projectedHours * rate,
      actualHours: actualHoursSum,
      actualRevenue: actualHoursSum * rate,
    });
  }

  return NextResponse.json({
    budgetLines: project.budgetLines,
    rollups,
    lastWeekWithActuals,
    peopleSummary,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "Admin" && role !== "Editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = budgetLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const line = await prisma.budgetLine.create({
    data: {
      projectId: id,
      type: parsed.data.type as "SOW" | "CO" | "Other",
      label: parsed.data.label,
      lowHours: parsed.data.lowHours,
      highHours: parsed.data.highHours,
      lowDollars: parsed.data.lowDollars,
      highDollars: parsed.data.highDollars,
    },
  });
  return NextResponse.json(line);
}
