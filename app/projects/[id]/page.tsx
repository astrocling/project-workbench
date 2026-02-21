import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAsOfDate } from "@/lib/weekUtils";
import { ProjectDetailTabs } from "./ProjectDetailTabs";
import { ThemeToggle } from "@/components/ThemeProvider";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assignments: { include: { person: true, role: true } },
      projectRoleRates: { include: { role: true } },
      projectKeyRoles: { include: { person: true } },
    },
  });

  if (!project) notFound();

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });

  const canEdit = (session.user as { role?: string })?.role === "Admin" || (session.user as { role?: string })?.role === "Editor";

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
          {canEdit && (
            <Link
              href={`/projects/${id}/edit`}
              className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
            >
              Edit
            </Link>
          )}
        </div>
      </header>

      <main className="px-8 py-6 max-w-[1440px] mx-auto">
        <ProjectDetailTabs
          projectId={id}
          tab={tab}
          canEdit={!!canEdit}
          floatLastUpdated={lastImport?.completedAt ?? null}
        />
      </main>
    </div>
  );
}
