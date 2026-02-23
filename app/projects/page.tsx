import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getSessionPermissionLevel, canAccessAdmin, requirePermission } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAsOfDate } from "@/lib/weekUtils";
import { ThemeToggle } from "@/components/ThemeProvider";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      projectKeyRoles: { include: { person: true } },
    },
  });

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 bg-white/80 dark:bg-dark-bg/90 backdrop-blur-md border-b border-surface-200 dark:border-dark-border">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">
          Project Workbench
        </h1>
        <div className="flex gap-4 items-center">
          <span className="text-label-md text-surface-500 dark:text-surface-400">
            As-of: {getAsOfDate().toISOString().slice(0, 10)}
          </span>
          <ThemeToggle />
          {canAccessAdmin(getSessionPermissionLevel(session.user)) && (
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-display-lg font-bold text-surface-900 dark:text-white">
            Projects
          </h2>
          {requirePermission(getSessionPermissionLevel(session.user), ["User", "Admin"]) && (
            <Link
              href="/projects/new"
              className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              New Project
            </Link>
          )}
        </div>

        {lastImport && (
          <p className="text-body-sm text-surface-700 dark:text-surface-200 mb-4">
            Float last updated: {new Date(lastImport.completedAt).toLocaleString()}
          </p>
        )}

        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
          <table className="w-full text-body-sm border-collapse">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  PMs
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  PGM
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  CAD
                </th>
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
                        href={`/projects/${p.id}`}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
          {projects.length === 0 && (
            <p className="p-8 text-center text-surface-700 dark:text-surface-300">
              No projects yet.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
