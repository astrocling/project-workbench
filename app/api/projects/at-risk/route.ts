import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { computeBudgetRollups } from "@/lib/budgetCalculations";
import { getWeekStartDate, getCompletedWeeks, getAllWeeks } from "@/lib/weekUtils";

type AtRiskFindMany = typeof prisma.project.findMany<{
  where: { status: "Active" };
  include: {
    projectKeyRoles: { include: { person: true } };
    assignments: { include: { role: true; person: true } };
    plannedHours: true;
    actualHours: true;
    budgetLines: true;
    projectRoleRates: true;
  };
}>;
type ProjectWithRelations = Awaited<ReturnType<AtRiskFindMany>>[number];

function buildRateByRole(project: ProjectWithRelations): Map<string, number> {
  const singleRate =
    project.useSingleRate && project.singleBillRate != null
      ? Number(project.singleBillRate)
      : null;
  const rateByRole = new Map<string, number>();
  const rateByRoleId = new Map(
    project.projectRoleRates.map((prr) => [prr.roleId, Number(prr.billRate)])
  );
  for (const a of project.assignments) {
    const override = a.billRateOverride ? Number(a.billRateOverride) : null;
    if (override != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, override);
    } else if (singleRate != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, singleRate);
    } else {
      rateByRole.set(
        `${a.personId}-${a.roleId}`,
        rateByRoleId.get(a.roleId) ?? 0
      );
    }
  }
  return rateByRole;
}

function getBudgetRisks(project: ProjectWithRelations): string[] {
  const risks: string[] = [];
  const rateByRole = buildRateByRole(project);
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

  if (budgetLines.length === 0) return risks;

  const rollups = computeBudgetRollups(
    project.startDate,
    project.endDate,
    weeklyRows,
    budgetLines
  );

  if (rollups.missingActuals) risks.push("Actuals missing");

  const totalBudgetHighHours =
    rollups.remainingHoursHigh + rollups.actualHoursToDate;
  const remainingAfterProjectedBurn = rollups.remainingAfterProjectedBurnHoursHigh;
  const bufferPercentHours =
    totalBudgetHighHours > 0
      ? (remainingAfterProjectedBurn / totalBudgetHighHours) * 100
      : null;
  if (
    bufferPercentHours != null &&
    (bufferPercentHours < 5 || bufferPercentHours < 0)
  ) {
    risks.push("Low buffer");
  }

  return risks;
}

function getRecoveryRisks(project: ProjectWithRelations): string[] {
  const risks: string[] = [];
  const rateByRole = buildRateByRole(project);

  const weekRecoveryPercents: (number | null)[] = [];
  let weekStart = getWeekStartDate(new Date());
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  for (let i = 0; i < 4; i++) {
    const weekKey = weekStart.toISOString().slice(0, 10);
    let forecastDollars = 0;
    let actualDollars = 0;
    for (const a of project.assignments) {
      const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
      const planned = project.plannedHours.find(
        (ph) =>
          ph.personId === a.personId &&
          ph.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const actual = project.actualHours.find(
        (ah) =>
          ah.personId === a.personId &&
          ah.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const plannedHours = planned ? Number(planned.hours) : 0;
      const actualHours = actual?.hours != null ? Number(actual.hours) : 0;
      forecastDollars += plannedHours * rate;
      actualDollars += actualHours * rate;
    }
    const recoveryPercent =
      forecastDollars > 0 ? (actualDollars / forecastDollars) * 100 : null;
    weekRecoveryPercents.push(recoveryPercent);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  }

  const validWeekPercents = weekRecoveryPercents.filter(
    (p): p is number => p != null
  );
  if (validWeekPercents.length > 0) {
    const avg =
      validWeekPercents.reduce((s, p) => s + p, 0) / validWeekPercents.length;
    if (avg < 80) risks.push("Previous 4 weeks recovery < 80%");
  }

  const completedWeeks = getCompletedWeeks(
    project.startDate,
    project.endDate
  );
  let toDateForecastDollars = 0;
  let toDateActualDollars = 0;
  for (const weekDate of completedWeeks) {
    const weekKey = weekDate.toISOString().slice(0, 10);
    for (const a of project.assignments) {
      const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
      const planned = project.plannedHours.find(
        (ph) =>
          ph.personId === a.personId &&
          ph.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const actual = project.actualHours.find(
        (ah) =>
          ah.personId === a.personId &&
          ah.weekStartDate.toISOString().slice(0, 10) === weekKey
      );
      const plannedHours = planned ? Number(planned.hours) : 0;
      const actualHours = actual?.hours != null ? Number(actual.hours) : 0;
      toDateForecastDollars += plannedHours * rate;
      toDateActualDollars += actualHours * rate;
    }
  }
  const toDateRecoveryPercent =
    toDateForecastDollars > 0
      ? (toDateActualDollars / toDateForecastDollars) * 100
      : null;
  if (
    toDateRecoveryPercent != null &&
    toDateRecoveryPercent < 80
  ) {
    risks.push("Overall recovery < 80%");
  }

  return risks;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { status: "Active" },
    include: {
      projectKeyRoles: { include: { person: true } },
      assignments: { include: { role: true, person: true } },
      plannedHours: true,
      actualHours: true,
      budgetLines: true,
      projectRoleRates: true,
    },
  });

  const results: Array<{
    id: string;
    slug: string;
    name: string;
    clientName: string;
    status: string;
    keyRoles: { pms: string[]; pgm: string | null; cad: string | null };
    risks: string[];
  }> = [];

  for (const project of projects) {
    const budgetRisks = getBudgetRisks(project);
    const recoveryRisks = getRecoveryRisks(project);
    const risks = [...new Set([...budgetRisks, ...recoveryRisks])];
    if (risks.length === 0) continue;

    const pms = project.projectKeyRoles
      .filter((kr) => kr.type === "PM")
      .map((kr) => kr.person.name);
    const pgm = project.projectKeyRoles.find((kr) => kr.type === "PGM")
      ?.person.name ?? null;
    const cad = project.projectKeyRoles.find((kr) => kr.type === "CAD")
      ?.person.name ?? null;

    results.push({
      id: project.id,
      slug: project.slug,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      keyRoles: { pms, pgm, cad },
      risks,
    });
  }

  return NextResponse.json(results);
}
