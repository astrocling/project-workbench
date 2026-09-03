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

export async function requirePlanSessionForProject(
  projectId: string,
  session?: Session
): Promise<{ session: Session } | { error: NextResponse }> {
  const auth = session ? { session } : await requireSession();
  if ("error" in auth) return auth;
  if (!(await isProjectPlanEnabled(projectId))) {
    return { error: planNotFound() };
  }
  return auth;
}

export async function requirePlanEditSessionForProject(
  projectId: string,
  session?: Session
): Promise<{ session: Session } | { error: NextResponse }> {
  const auth = session ? { session } : await requireSession();
  if ("error" in auth) return auth;
  const planAuth = await requirePlanSessionForProject(projectId, auth.session);
  if ("error" in planAuth) return planAuth;
  if (!canEdit(auth.session)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return planAuth;
}
