import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getSessionPermissionLevel, canAccessAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAsOfDate } from "@/lib/weekUtils";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

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
      asOfDateLabel={getAsOfDate().toISOString().slice(0, 10)}
    >
      {children}
    </AppShell>
  );
}
