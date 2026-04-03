import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getSessionPermissionLevel, canEditProject } from "@/lib/auth";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAsOfDate, getAllWeeks, getWeekStartDate } from "@/lib/weekUtils";
import { getBudgetStatusForDisplay } from "@/lib/budgetCalculations";
import { getCachedProjectBySlugOrId } from "@/lib/projectCache";
import { getEligibleKeyRoles } from "@/lib/eligibleKeyRoles";
import { ProjectDetailTabs } from "./ProjectDetailTabs";
import type { Metadata } from "next";
import type { EditProjectInitial } from "@/app/(app)/projects/[slug]/edit/EditProjectDataContext";

const CUID_REGEX = /^c[a-z0-9]{24}$/i;

function dateToIso(d: Date | string): string {
  return typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
}

function dateToIsoNullable(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  return typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
}

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
  const sp = await searchParams;
  const rawTab = sp.tab ?? "overview";
  const VALID_TABS = [
    "overview",
    "resourcing",
    "pto",
    "cda",
    "budget",
    "timeline",
    "status-reports",
    "settings",
  ] as const;
  let tab = VALID_TABS.includes(rawTab as (typeof VALID_TABS)[number]) ? rawTab : "overview";
  if (rawTab === "edit") tab = "settings";

  const project = await getCachedProjectBySlugOrId(slugParam);
  if (!project) notFound();

  // Backward compatibility: if URL looks like old cuid, redirect to canonical slug
  if (CUID_REGEX.test(slugParam) && project.slug !== slugParam) {
    redirect(`/projects/${project.slug}`);
  }

  const [lastImport, floatScheduledHours] = await Promise.all([
    prisma.floatImportRun.findFirst({ orderBy: { completedAt: "desc" } }),
    prisma.floatScheduledHours.findMany({ where: { projectId: project.id } }),
  ]);

  const permissionLevel = getSessionPermissionLevel(session.user);
  const canEdit = canEditProject(permissionLevel);
  if (tab === "settings" && !canEdit) {
    redirect(`/projects/${project.slug}`);
  }

  const asOf = getAsOfDate();
  const hasUpcomingHours = (personId: string): boolean => {
    const isFuture = (d: Date) => new Date(d) > asOf;
    const planned = project.plannedHours.some(
      (r) => r.personId === personId && isFuture(r.weekStartDate) && Number(r.hours) > 0
    );
    const float = floatScheduledHours.some(
      (r) => r.personId === personId && isFuture(r.weekStartDate) && Number(r.hours) > 0
    );
    return planned || float;
  };

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
    hiddenFromGrid: a.hiddenFromGrid ?? false,
    hasUpcomingHours: hasUpcomingHours(a.personId),
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

  const peopleSummary = project.assignments.map((a) => {
    let projectedHours = 0;
    let actualHoursSum = 0;
    for (const weekDate of allWeeks) {
      const wk = weekDate.toISOString().slice(0, 10);
      const ph = project.plannedHours.find(
        (p) => p.personId === a.personId && toDateKey(p.weekStartDate) === wk
      );
      const ah = project.actualHours.find(
        (h) => h.personId === a.personId && toDateKey(h.weekStartDate) === wk
      );
      projectedHours += ph ? Number(ph.hours) : 0;
      if (ah?.hours != null) actualHoursSum += Number(ah.hours);
    }
    const rate = rateByRole.get(`${a.personId}-${a.roleId}`) ?? 0;
    return {
      personName: a.person.name,
      roleName: a.role.name,
      rate,
      projectedHours,
      projectedRevenue: projectedHours * rate,
      actualHours: actualHoursSum,
      actualRevenue: actualHoursSum * rate,
    };
  });

  const initialBudgetData = {
    budgetLines: project.budgetLines.map((bl) => ({
      id: bl.id,
      type: bl.type,
      label: bl.label,
      lowHours: Number(bl.lowHours),
      highHours: Number(bl.highHours),
      lowDollars: Number(bl.lowDollars),
      highDollars: Number(bl.highDollars),
    })),
    rollups: initialBudgetStatus.rollups,
    lastWeekWithActuals: initialBudgetStatus.lastWeekWithActuals,
    peopleSummary,
  };

  const initialSettingsProject: EditProjectInitial = {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    startDate: dateToIso(project.startDate),
    endDate: dateToIsoNullable(project.endDate),
    status: project.status,
    cdaEnabled: project.cdaEnabled ?? false,
    actualsLowThresholdPercent: project.actualsLowThresholdPercent ?? null,
    actualsHighThresholdPercent: project.actualsHighThresholdPercent ?? null,
    clientSponsor: project.clientSponsor ?? null,
    clientSponsor2: project.clientSponsor2 ?? null,
    otherContact: project.otherContact ?? null,
    keyStaffName: project.keyStaffName ?? null,
    sowLink: project.sowLink ?? null,
    estimateLink: project.estimateLink ?? null,
    floatLink: project.floatLink ?? null,
    metricLink: project.metricLink ?? null,
    projectKeyRoles: project.projectKeyRoles.map((kr) => ({
      type: kr.type,
      personId: kr.personId,
      person: { id: kr.person.id, name: kr.person.name },
    })),
  };
  const initialSettingsEligiblePeople = await getEligibleKeyRoles();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/projects"
          className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
        >
          ← Projects
        </Link>
        <div className="flex items-center justify-between gap-4 mt-1">
          <h1 className="text-display-md font-bold text-surface-900 dark:text-white">
            {project.name}
          </h1>
          <span className="text-label-md text-surface-500 dark:text-surface-400">
            As-of: {getAsOfDate().toISOString().slice(0, 10)}
          </span>
        </div>
      </div>

      <ProjectDetailTabs
        projectId={project.id}
        projectSlug={project.slug}
        tab={tab}
        canEdit={!!canEdit}
        floatLastUpdated={lastImport?.completedAt ?? null}
        cdaEnabled={project.cdaEnabled ?? false}
        cdaReportHoursOnly={project.cdaReportHoursOnly ?? false}
        initialProject={initialProject}
        initialAssignments={initialAssignments}
        initialMissingRateRoleNames={initialMissingRateRoleNames}
        initialBudgetStatus={initialBudgetStatus}
        initialBudgetData={initialBudgetData}
        initialSettingsProject={initialSettingsProject}
        initialSettingsEligiblePeople={initialSettingsEligiblePeople}
        projectStartDateIso={dateToIso(project.startDate)}
        projectEndDateIso={
          project.endDate != null
            ? dateToIso(project.endDate)
            : getWeekStartDate(new Date()).toISOString()
        }
      />
    </div>
  );
}
