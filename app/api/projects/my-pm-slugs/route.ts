import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/projects/my-pm-slugs
 * Returns project slugs for projects where the current user is listed as PM.
 * Used by the sidebar "Open my projects" button to open each overview in a new tab.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    if (fullName) {
      person = await prisma.person.findFirst({
        where: { name: { equals: fullName, mode: "insensitive" } },
        select: { id: true },
      });
    }
  }

  if (!person) {
    return NextResponse.json({ slugs: [] });
  }

  const projects = await prisma.project.findMany({
    where: {
      projectKeyRoles: {
        some: { personId: person.id, type: "PM" },
      },
    },
    orderBy: { name: "asc" },
    select: { slug: true },
  });

  return NextResponse.json({
    slugs: projects.map((p) => p.slug),
  });
}
