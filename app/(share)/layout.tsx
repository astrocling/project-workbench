import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { redirect } from "next/navigation";

/**
 * Minimal layout for shareable views (e.g. status report permalinks).
 * No sidebar, no app header — clean presentation for client sharing.
 */
export default async function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      {children}
    </div>
  );
}
