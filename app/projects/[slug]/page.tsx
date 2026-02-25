import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getSessionPermissionLevel, canAccessAdmin, canEditProject } from "@/lib/auth";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAsOfDate } from "@/lib/weekUtils";
import { ProjectDetailTabs } from "./ProjectDetailTabs";
import { ThemeToggle } from "@/components/ThemeProvider";

const CUID_REGEX = /^c[a-z0-9]{24}$/i;

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

  // Backward compatibility: if URL looks like old cuid, resolve by id and redirect to slug
  if (CUID_REGEX.test(slugParam)) {
    const byId = await prisma.project.findUnique({
      where: { id: slugParam },
      select: { slug: true },
    });
    if (byId?.slug) {
      redirect(`/projects/${byId.slug}`);
    }
  }

  const project = await prisma.project.findUnique({
    where: { slug: slugParam },
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

  const permissionLevel = getSessionPermissionLevel(session.user);
  const canEdit = canEditProject(permissionLevel);

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
        />
      </main>
    </div>
  );
}
