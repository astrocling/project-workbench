import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getSessionPermissionLevel, canAccessAdmin, canEditProject } from "@/lib/auth";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAsOfDate, getAllWeeks } from "@/lib/weekUtils";
import { getBudgetStatusForDisplay } from "@/lib/budgetCalculations";
import { getCachedProjectBySlugOrId } from "@/lib/projectCache";
import { ProjectDetailTabs } from "./ProjectDetailTabs";
import { ThemeToggle } from "@/components/ThemeProvider";
import type { Metadata } from "next";

const CUID_REGEX = /^c[a-z0-9]{24}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: slugParam } = await params;
  const project = await getCachedProjectBySlugOrId(slugParam);
  if (!project) return { title: "Project" };
  return { title: project.name };
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { slug: slugParam } = await params;
  const { tab = "overview" } = await searchParams;

  const project = await getCachedProjectBySlugOrId(slugParam);
  if (!project) notFound();

  // Backward compatibility: if URL looks like old cuid, redirect to canonical slug
  if (CUID_REGEX.test(slugParam) && project.slug !== slugParam) {
    redirect(`/projects/${project.slug}`);
  }

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });

  const permissionLevel = getSessionPermissionLevel(session.user);
  const canEdit = canEditProject(permissionLevel);

  // Serialize for client: overview + rates-alert can use this and skip refetch on load
  const initialProject = {
    notes: project.notes ?? null,
    sowLink: project.sowLink ?? null,
    estimateLink: project.estimateLink ?? null,
    floatLink: project.floatLink ?? null,
    metricLink: project.metricLink ?? null,
    useSingleRate: project.useSingleRate ?? false,
    singleBillRate: project.singleBillRate != null ? Number(project.singleBillRate) : null,
    projectKeyRoles: project.projectKeyRoles.map((kr) => ({
      type: kr.type,
      person: { name: kr.person.name },
    })),
  };
  const initialAssignments = project.assignments.map((a) => ({
    personId: a.personId,
    person: { name: a.person.name },
    role: { name: a.role.name, id: a.role.id },
  }));
  const hasSingleRate = project.useSingleRate && project.singleBillRate != null;
  const initialMissingRateRoleNames: string[] = hasSingleRate
    ? []
    : (() => {
        const resourcedRoleIds = new Set(project.assignments.map((a) => a.roleId));
        const rateRoleIds = new Set(project.projectRoleRates.map((prr) => prr.roleId));
        const missingRoleIds = [...resourcedRoleIds].filter((id) => !rateRoleIds.has(id));
        const roleIdToName = new Map(project.assignments.map((a) => [a.role.id, a.role.name]));
        return missingRoleIds.map((id) => roleIdToName.get(id)).filter(Boolean) as string[];
      })();

  const singleRate =
    project.useSingleRate && project.singleBillRate != null
      ? Number(project.singleBillRate)
      : null;
  const rateByRoleId = new Map(project.projectRoleRates.map((prr) => [prr.roleId, Number(prr.billRate)]));
  const rateByRole = new Map<string, number>();
  for (const a of project.assignments) {
    const override = a.billRateOverride ? Number(a.billRateOverride) : null;
    if (override != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, override);
    } else if (singleRate != null) {
      rateByRole.set(`${a.personId}-${a.roleId}`, singleRate);
    } else {
      rateByRole.set(`${a.personId}-${a.roleId}`, rateByRoleId.get(a.roleId) ?? 0);
    }
  }
  // Cached/serialized project may have date fields as strings; normalize to YYYY-MM-DD for comparison
  const toDateKey = (d: Date | string): string =>
    typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);

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
          toDateKey(ph.weekStartDate) === wk
      );
      const actual = project.actualHours.find(
        (ah) =>
          ah.personId === a.personId &&
          toDateKey(ah.weekStartDate) === wk
      );
      weeklyRows.push({
        weekStartDate: new Date(weekDate),
        plannedHours: planned ? Number(planned.hours) : 0,
        actualHours: actual?.hours != null ? Number(actual.hours) : null,
        rate,
      });
    }
  }
  const budgetLinesForStatus = project.budgetLines.map((bl) => ({
    lowHours: Number(bl.lowHours),
    highHours: Number(bl.highHours),
    lowDollars: Number(bl.lowDollars),
    highDollars: Number(bl.highDollars),
  }));
  const initialBudgetStatus = getBudgetStatusForDisplay(
    project.startDate,
    project.endDate,
    weeklyRows,
    budgetLinesForStatus
  );

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-surface-50 dark:bg-dark-bg border-b border-surface-200 dark:border-dark-border">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">
          {project.name}
        </h1>
        <div className="flex gap-4 items-center">
          <span className="text-label-md text-surface-500 dark:text-surface-400">
            As-of: {getAsOfDate().toISOString().slice(0, 10)}
          </span>
          <ThemeToggle />
          {canAccessAdmin(permissionLevel) && (
            <Link
              href="/admin/float-import"
              className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
            >
              Admin
            </Link>
          )}
          <Link
            href="/api/auth/signout"
            className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
          >
            Sign out
          </Link>
        </div>
      </header>

      <main className="px-8 py-6 max-w-[1440px] mx-auto">
        <ProjectDetailTabs
          projectId={project.id}
          projectSlug={project.slug}
          tab={tab}
          canEdit={!!canEdit}
          floatLastUpdated={lastImport?.completedAt ?? null}
          cdaEnabled={project.cdaEnabled ?? false}
          initialProject={initialProject}
          initialAssignments={initialAssignments}
          initialMissingRateRoleNames={initialMissingRateRoleNames}
          initialBudgetStatus={initialBudgetStatus}
        />
      </main>
    </div>
  );
}
