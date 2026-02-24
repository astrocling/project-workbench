import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { UserPositionRole } from "@prisma/client";

const KEY_ROLES = [
  UserPositionRole.ProjectManager,
  UserPositionRole.ProgramManager,
  UserPositionRole.ClientAccountDirector,
];

/**
 * Returns people eligible for PM, PGM, or CAD assignment.
 * Anyone with one of these roles (Project Manager, Program Manager, Client Account Director)
 * can be used in any of the three fields. Matched to Person by email, or by name (firstName + lastName).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { role: { in: KEY_ROLES } },
    select: { email: true, firstName: true, lastName: true },
  });

  if (users.length === 0) {
    return NextResponse.json([]);
  }

  const emails = [...new Set(users.map((u) => u.email).filter(Boolean))];
  const peopleByEmail = await prisma.person.findMany({
    where: { email: { in: emails } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const byEmail = new Map<string, { id: string; name: string }>();
  for (const p of peopleByEmail) {
    if (p.email) byEmail.set(p.email, { id: p.id, name: p.name });
  }

  const matchedIds = new Set<string>();
  const result: { id: string; name: string }[] = [];

  for (const u of users) {
    const byMail = u.email ? byEmail.get(u.email) : undefined;
    if (byMail && !matchedIds.has(byMail.id)) {
      matchedIds.add(byMail.id);
      result.push(byMail);
    }
  }

  // If we missed anyone (no Person.email match), try matching by name
  if (result.length < users.length) {
    const fullNames = users
      .map((u) => [u.firstName, u.lastName].filter(Boolean).join(" ").trim())
      .filter(Boolean);
    const allPeople = await prisma.person.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    for (const u of users) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      if (!name) continue;
      const byMail = u.email ? byEmail.get(u.email) : undefined;
      if (byMail) continue;
      const byName = allPeople.find((p) => p.name.trim() === name);
      if (byName && !matchedIds.has(byName.id)) {
        matchedIds.add(byName.id);
        result.push({ id: byName.id, name: byName.name });
      }
    }
  }

  return NextResponse.json(result.sort((a, b) => a.name.localeCompare(b.name)));
}
