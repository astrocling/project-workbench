import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

const ELIGIBLE_ROLES = ["director", "project manager"];

/**
 * Returns people eligible for PM, PGM, or CAD assignment.
 * Eligible = anyone from the Float import who carries the role Director or Project Manager,
 * regardless of whether they are currently assigned to a project.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });

  const personNames = new Set<string>();
  if (lastImport) {
    const assignments =
      (lastImport.projectAssignments as Record<
        string,
        Array<{ personName: string; roleName: string }>
      >) ?? {};
    for (const list of Object.values(assignments)) {
      for (const { personName, roleName } of list) {
        if (personName?.trim() && ELIGIBLE_ROLES.includes((roleName ?? "").toLowerCase().trim())) {
          personNames.add(personName.trim());
        }
      }
    }
    const floatHours =
      (lastImport.projectFloatHours as Record<
        string,
        Array<{ personName: string; roleName?: string; weeks?: unknown[] }>
      >) ?? {};
    for (const list of Object.values(floatHours)) {
      for (const { personName, roleName } of list) {
        if (personName?.trim() && ELIGIBLE_ROLES.includes((roleName ?? "").toLowerCase().trim())) {
          personNames.add(personName.trim());
        }
      }
    }
  }

  if (personNames.size === 0) {
    return NextResponse.json([]);
  }

  const people = await prisma.person.findMany({
    where: {
      name: { in: Array.from(personNames) },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json(people);
}
