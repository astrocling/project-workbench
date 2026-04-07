import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getSessionPermissionLevel, canAccessAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAsOfDate } from "@/lib/weekUtils";
import { getDashboardContext } from "@/lib/dashboardContext";
import { AppShell } from "@/components/AppShell";

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
    <AppShell
      userDisplayName={userDisplayName}
      isAdmin={isAdmin}
      pmSlugs={pmSlugs}
      asOfDateLabel={getAsOfDate().toISOString().slice(0, 10)}
    >
      {children}
    </AppShell>
  );
}
