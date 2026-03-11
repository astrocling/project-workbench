import type { Session } from "next-auth";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type DashboardContext = {
  personId: string | null;
  pmSlugs: string[];
};

/**
 * Resolves the current user's Person id and PM project slugs for dashboard/sidebar.
 * Cached per user so layout and dashboard pages share one resolution.
 */
export async function getDashboardContext(
  session: Session | null
): Promise<DashboardContext> {
  if (!session?.user?.id) {
    return { personId: null, pmSlugs: [] };
  }
  return unstable_cache(
    async () => {
      const userEmail = session.user?.email ?? undefined;
      let person = userEmail
        ? await prisma.person.findFirst({
            where: { email: { equals: userEmail, mode: "insensitive" } },
            select: { id: true },
          })
        : null;

      if (!person && session.user?.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { firstName: true, lastName: true },
        });
        const fullName = [user?.firstName, user?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (fullName) {
          person = await prisma.person.findFirst({
            where: { name: { equals: fullName, mode: "insensitive" } },
            select: { id: true },
          });
        }
      }

      if (!person) {
        return { personId: null, pmSlugs: [] };
      }

      const projects = await prisma.project.findMany({
        where: {
          projectKeyRoles: {
            some: { personId: person!.id, type: "PM" },
          },
        },
        orderBy: { name: "asc" },
        select: { slug: true },
      });

      return {
        personId: person.id,
        pmSlugs: projects.map((p) => p.slug),
      };
    },
    ["dashboard-context", session.user.id],
    { revalidate: 60 }
  )();
}
