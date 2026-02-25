import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });
  const assignments =
    (lastImport?.projectAssignments as Record<
      string,
      Array<{ personName: string; roleName: string }>
    >) ?? {};

  const projectKey = Object.keys(assignments).find(
    (k) => k.toLowerCase() === project.name.toLowerCase()
  );
  const list = projectKey ? assignments[projectKey] : [];
  if (list.length === 0) {
    return NextResponse.json({});
  }

  const people = await prisma.person.findMany({ select: { id: true, name: true } });
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const personByName = new Map(people.map((p) => [p.name.toLowerCase(), p.id]));
  const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r.id]));

  const map: Record<string, string> = {};
  for (const { personName, roleName } of list) {
    const personId = personByName.get(personName.toLowerCase());
    const roleId = roleByName.get(roleName.toLowerCase());
    if (personId && roleId) map[personId] = roleId;
  }
  return NextResponse.json(map);
}
