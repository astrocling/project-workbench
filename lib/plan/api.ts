import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";
import { PLAN_ITEM_TYPES, PLAN_MEETING_STATUSES } from "@/lib/plan/types";
import { normalizeItemDates, validateItemPayload } from "@/lib/plan/itemRules";

export { normalizeItemDates, validateItemPayload };

export const dateString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "Invalid date",
});

export const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a 6-digit hex (e.g. #1941FA)");

export const optionalHexColor = hexColor.optional();

export const planItemTypeEnum = z.enum(PLAN_ITEM_TYPES);
export const planMeetingStatusEnum = z.enum(PLAN_MEETING_STATUSES);

export function getSessionUserId(session: Session): string | undefined {
  return (session.user as { id?: string }).id;
}

export function canEdit(session: Session): boolean {
  const permissions = (session.user as { permissions?: string }).permissions;
  return permissions === "Admin" || permissions === "User";
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export async function requireEditSession() {
  const result = await requireSession();
  if ("error" in result) return result;
  if (!canEdit(result.session)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}

export async function resolveProjectId(idOrSlug: string) {
  const id = await getProjectId(idOrSlug);
  if (!id) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { id };
}

export async function getProjectDates(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { startDate: true, endDate: true },
  });
  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { project };
}

export const planInclude = {
  phases: {
    orderBy: { order: "asc" as const },
    include: {
      items: {
        orderBy: { order: "asc" as const },
      },
    },
  },
  updatedBy: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  },
};

export async function getPlanItemsForValidation(planId: string) {
  return prisma.planItem.findMany({
    where: { phase: { planId } },
    select: { id: true, phaseId: true, parentItemId: true },
  });
}

export async function getPlanForProject(projectId: string) {
  return prisma.projectPlan.findUnique({
    where: { projectId },
    include: planInclude,
  });
}

export function parseDate(value: string): Date {
  return new Date(value);
}

export function validateDateRange(start: Date, end: Date): string | null {
  if (start > end) return "Start date must be on or before end date";
  return null;
}
