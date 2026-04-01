import { unstable_cache } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getDashboardContext } from "@/lib/dashboardContext";
import { getSessionPermissionLevel, requirePermission, canEditProject, canDeleteProject } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { ProjectRowActions } from "@/components/ProjectRowActions";

const FILTER_VALUES = ["my", "active", "closed", "all"] as const;
type FilterValue = (typeof FILTER_VALUES)[number];

const SORT_KEYS = ["name", "clientName", "status", "pms", "pgm", "cad"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

const projectListSelect = {
  id: true,
  slug: true,
  name: true,
  clientName: true,
  status: true,
  projectKeyRoles: {
    select: {
      type: true,
      person: { select: { name: true } },
    },
  },
} satisfies Prisma.ProjectSelect;

type ProjectListRow = Prisma.ProjectGetPayload<{ select: typeof projectListSelect }>;

function normalizeFilter(raw: string | undefined): FilterValue {
  if (raw === "atRisk") return "all";
  if (raw && FILTER_VALUES.includes(raw as FilterValue)) return raw as FilterValue;
  return "my";
}

function normalizeSort(raw: string | undefined): SortKey {
  if (raw && SORT_KEYS.includes(raw as SortKey)) return raw as SortKey;
  return "clientName";
}

function normalizeDir(raw: string | undefined): "asc" | "desc" {
  if (raw === "asc" || raw === "desc") return raw;
  return "asc";
}

function normalizePage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function normalizePageSize(raw: string | undefined): number {
  const n = parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

function projectsListQueryString(args: {
  filter: FilterValue;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  params.set("filter", args.filter);
  params.set("sort", args.sort);
  params.set("dir", args.dir);
  if (args.page > 1) params.set("page", String(args.page));
  if (args.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(args.pageSize));
  const q = params.toString();
  return q ? `?${q}` : "";
}

async function getCachedLastImport() {
  return unstable_cache(
    async () => {
      return prisma.floatImportRun.findFirst({
        orderBy: { completedAt: "desc" },
      });
    },
    ["float-last-import"],
    { revalidate: 60 }
  )();
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string; dir?: string; page?: string; pageSize?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const raw = await searchParams;
  const filter = normalizeFilter(raw.filter);
  const sortKey = normalizeSort(raw.sort);
  const sortDir = normalizeDir(raw.dir);
  const page = normalizePage(raw.page);
  const pageSize = normalizePageSize(raw.pageSize);

  const { personId: currentPersonId } = await getDashboardContext(session);

  const where =
    filter === "my"
      ? currentPersonId
        ? { projectKeyRoles: { some: { personId: currentPersonId } } }
        : { id: "no-match-my-projects" }
      : filter === "active"
        ? { status: "Active" as const }
        : filter === "closed"
          ? { status: "Closed" as const }
          : {};

  const dbOrderBy =
    sortKey === "name"
      ? { name: sortDir }
      : sortKey === "clientName"
        ? { clientName: sortDir }
        : sortKey === "status"
          ? { status: sortDir }
          : { clientName: "asc" as const };

  const needsKeyRoleSort = sortKey === "pms" || sortKey === "pgm" || sortKey === "cad";

  const totalCount = await prisma.project.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const [projectsFetched, lastImport] = await Promise.all([
    needsKeyRoleSort
      ? prisma.project.findMany({
          where,
          orderBy: dbOrderBy,
          select: projectListSelect,
        })
      : prisma.project.findMany({
          where,
          orderBy: dbOrderBy,
          select: projectListSelect,
          skip: (pageSafe - 1) * pageSize,
          take: pageSize,
        }),
    getCachedLastImport(),
  ]);

  let projects: ProjectListRow[];
  if (needsKeyRoleSort) {
    const mult = sortDir === "asc" ? 1 : -1;
    const sorted = [...projectsFetched].sort((a, b) => {
      const pmsA = a.projectKeyRoles.filter((kr) => kr.type === "PM").map((kr) => kr.person.name).join(", ") || "—";
      const pmsB = b.projectKeyRoles.filter((kr) => kr.type === "PM").map((kr) => kr.person.name).join(", ") || "—";
      const pgmA = a.projectKeyRoles.find((kr) => kr.type === "PGM")?.person.name ?? "—";
      const pgmB = b.projectKeyRoles.find((kr) => kr.type === "PGM")?.person.name ?? "—";
      const cadA = a.projectKeyRoles.find((kr) => kr.type === "CAD")?.person.name ?? "—";
      const cadB = b.projectKeyRoles.find((kr) => kr.type === "CAD")?.person.name ?? "—";
      const valA = sortKey === "pms" ? pmsA : sortKey === "pgm" ? pgmA : cadA;
      const valB = sortKey === "pms" ? pmsB : sortKey === "pgm" ? pgmB : cadB;
      return mult * valA.localeCompare(valB, undefined, { sensitivity: "base" });
    });
    const start = (pageSafe - 1) * pageSize;
    projects = sorted.slice(start, start + pageSize);
  } else {
    projects = projectsFetched;
  }

  const showPagination = totalCount > 0 && (totalCount > pageSize || page > 1);

  const permissionLevel = getSessionPermissionLevel(session.user);
  const canEdit = canEditProject(permissionLevel);
  const canDelete = canDeleteProject(permissionLevel);
  const showActions = canEdit || canDelete;

  const listQs = (overrides: Partial<{ filter: FilterValue; sort: SortKey; dir: "asc" | "desc"; page: number; pageSize: number }>) =>
    projectsListQueryString({
      filter: overrides.filter ?? filter,
      sort: overrides.sort ?? sortKey,
      dir: overrides.dir ?? sortDir,
      page: overrides.page ?? pageSafe,
      pageSize: overrides.pageSize ?? pageSize,
    });

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-display-lg font-bold text-surface-900 dark:text-white">
          Projects
        </h2>
        {requirePermission(permissionLevel, ["User", "Admin"]) && (
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
          >
            New Project
          </Link>
        )}
      </div>

      <nav className="flex gap-1 mb-4" aria-label="Project filter">
        {(
          [
            ["my", "My Projects"],
            ["active", "Active Projects"],
            ["closed", "Closed Projects"],
            ["all", "All Projects"],
          ] as const
        ).map(([value, label]) => {
          const isActive = filter === value;
          return (
            <Link
              key={value}
              href={`/projects${listQs({ filter: value, page: 1 })}`}
              className={`px-4 py-2 rounded-md text-body-sm font-medium transition-colors ${
                isActive
                  ? "bg-jblue-500 text-white dark:bg-jblue-600 dark:text-white"
                  : "text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-raised"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {lastImport && (
        <p className="text-body-sm text-surface-700 dark:text-surface-200 mb-4">
          Float last updated: <LocalTime isoDate={lastImport.completedAt} />
        </p>
      )}

      {showPagination && (
        <p className="text-body-sm text-surface-600 dark:text-surface-400 mb-3">
          Showing {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, totalCount)} of {totalCount}
          {totalPages > 1 && (
            <span className="ml-2 inline-flex gap-2">
              {pageSafe > 1 ? (
                <Link
                  href={`/projects${listQs({ page: pageSafe - 1 })}`}
                  className="text-jblue-500 dark:text-jblue-400 hover:underline font-medium"
                >
                  Previous
                </Link>
              ) : (
                <span className="text-surface-400 dark:text-surface-500">Previous</span>
              )}
              {pageSafe < totalPages ? (
                <Link
                  href={`/projects${listQs({ page: pageSafe + 1 })}`}
                  className="text-jblue-500 dark:text-jblue-400 hover:underline font-medium"
                >
                  Next
                </Link>
              ) : (
                <span className="text-surface-400 dark:text-surface-500">Next</span>
              )}
            </span>
          )}
        </p>
      )}

      <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
        <table className="w-full text-body-sm border-collapse">
          <thead>
            <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
              {(
                [
                  ["name", "Name"],
                  ["clientName", "Client"],
                  ["status", "Status"],
                  ["pms", "PMs"],
                  ["pgm", "PGM"],
                  ["cad", "CAD"],
                ] as const
              ).map(([key, label]) => {
                const isActive = sortKey === key;
                const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";
                return (
                  <th key={key} className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                    <Link
                      href={`/projects${listQs({ sort: key, dir: nextDir, page: 1 })}`}
                      className={`inline-flex items-center gap-1 hover:text-surface-700 dark:hover:text-surface-200 ${isActive ? "text-surface-900 dark:text-white" : ""}`}
                    >
                      {label}
                      {isActive && (
                        <span className="text-xs" aria-hidden>
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </Link>
                  </th>
                );
              })}
              {showActions && (
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold w-28">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const pms = p.projectKeyRoles.filter((kr) => kr.type === "PM");
              const pgm = p.projectKeyRoles.find((kr) => kr.type === "PGM");
              const cad = p.projectKeyRoles.find((kr) => kr.type === "CAD");
              return (
                <tr
                  key={p.id}
                  className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100"
                >
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                    <Link
                      href={`/projects/${p.slug}`}
                      className="font-medium text-surface-800 dark:text-white text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                    {p.clientName}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                    {p.status}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                    {pms.map((kr) => kr.person.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                    {pgm?.person.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                    {cad?.person.name ?? "—"}
                  </td>
                  {showActions && (
                    <td className="px-4 py-3">
                      <ProjectRowActions
                        projectId={p.id}
                        slug={p.slug}
                        projectName={p.name}
                        canEdit={canEdit}
                        canDelete={canDelete}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {projects.length === 0 && (
          <div className="p-8 text-center text-surface-700 dark:text-surface-300 space-y-2">
            {filter === "all" ? (
              <p>No projects yet.</p>
            ) : filter === "my" ? (
              <>
                <p>
                  No projects here yet. <strong>My Projects</strong> only lists projects where you have a{" "}
                  <strong>PM</strong>, <strong>PGM</strong>, or <strong>CAD</strong> key role (set on each
                  project&apos;s settings). Float sync updates assignments and hours, not those roles.
                </p>
                <p>
                  <Link
                    href="/projects?filter=active"
                    className="text-jblue-500 dark:text-jblue-400 font-medium hover:underline"
                  >
                    View active projects
                  </Link>{" "}
                  or{" "}
                  <Link
                    href="/projects?filter=all"
                    className="text-jblue-500 dark:text-jblue-400 font-medium hover:underline"
                  >
                    all projects
                  </Link>
                  .
                </p>
              </>
            ) : (
              <p>No projects match this filter.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
