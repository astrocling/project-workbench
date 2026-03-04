import { prisma } from "@/lib/prisma";
import { computeBudgetRollups } from "@/lib/budgetCalculations";
import type { WeeklyHoursRow } from "@/lib/budgetCalculations";

/**
 * Returns true if the project has missing actuals (completed weeks with planned hours but no actuals).
 * Used to block creating new status reports when actuals are stale.
 */
export async function projectHasMissingActuals(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      budgetLines: true,
      assignments: { include: { role: true, person: true } },
      plannedHours: true,
      actualHours: true,
    },
  });
  if (!project) return false;

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
          projectId_roleId: { projectId, roleId: a.roleId },
        },
      });
      rateByRole.set(`${a.personId}-${a.roleId}`, prr ? Number(prr.billRate) : 0);
    }
  }

  const { getAllWeeks } = await import("@/lib/weekUtils");
  const end = project.endDate ?? new Date();
  const allWeeks = getAllWeeks(project.startDate, end);
  const weeklyRows: WeeklyHoursRow[] = [];

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

  return rollups.missingActuals;
}
