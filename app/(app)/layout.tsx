import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getSessionPermissionLevel, canAccessAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAsOfDate } from "@/lib/weekUtils";
import { getDashboardContext } from "@/lib/dashboardContext";
import { AppSidebar } from "@/components/AppSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Avoid blocking the shell if dashboard context (DB) is slow or fails
  const DASHBOARD_CONTEXT_TIMEOUT_MS = 8000;
  const dashboardContextPromise = getDashboardContext(session);
  const timeoutPromise = new Promise<{ personId: string | null; pmSlugs: string[] }>((resolve) => {
    setTimeout(() => resolve({ personId: null, pmSlugs: [] }), DASHBOARD_CONTEXT_TIMEOUT_MS);
  });
  const { pmSlugs } = await Promise.race([
    dashboardContextPromise.catch(() => ({ personId: null as string | null, pmSlugs: [] as string[] })),
    timeoutPromise,
  ]);
  const permissionLevel = getSessionPermissionLevel(session.user);
  const isAdmin = !!canAccessAdmin(permissionLevel);
  const userDisplayName =
    (session.user as { name?: string }).name ??
    session.user?.email ??
    null;

  return (
    <div className="flex min-h-screen bg-surface-50 dark:bg-dark-bg">
      <AppSidebar
        userDisplayName={userDisplayName}
        isAdmin={isAdmin}
        pmSlugs={pmSlugs}
      />
      <div className="ml-[240px] flex min-h-screen flex-1 flex-col min-w-0">
        <header className="sticky top-[var(--env-banner-height,0px)] z-30 flex h-14 shrink-0 items-center justify-between border-b border-surface-200 bg-white/80 px-6 backdrop-blur-md dark:border-dark-border dark:bg-dark-bg/90">
          <h1 className="text-display-md font-bold text-surface-900 dark:text-white">
            Project Workbench
          </h1>
          <span className="text-label-md text-surface-500 dark:text-surface-400">
            As-of: {getAsOfDate().toISOString().slice(0, 10)}
          </span>
        </header>
        <main className="flex-1 px-8 py-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
