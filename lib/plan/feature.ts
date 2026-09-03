import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { canEdit, requireSession } from "@/lib/plan/api";
import { prisma } from "@/lib/prisma";

export function isPlanTabEnabled(planEnabled: boolean | null | undefined): boolean {
  return planEnabled === true;
}

function planNotFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function isProjectPlanEnabled(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { planEnabled: true },
  });
  return isPlanTabEnabled(project?.planEnabled);
}

export async function requirePlanSessionForProject(projectId: string): Promise<
  | { session: Session }
  | { error: NextResponse }
> {
  const auth = await requireSession();
  if ("error" in auth) return auth;
  if (!(await isProjectPlanEnabled(projectId))) {
    return { error: planNotFound() };
  }
  return auth;
}

export async function requirePlanEditSessionForProject(projectId: string): Promise<
  | { session: Session }
  | { error: NextResponse }
> {
  const auth = await requirePlanSessionForProject(projectId);
  if ("error" in auth) return auth;
  if (!canEdit(auth.session)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}
