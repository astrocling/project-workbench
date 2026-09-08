import type { PlanItemStatus, PlanItemType, PlanMeetingStatus } from "@/lib/plan/types";

export function toIsoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export type PlanItemJson = {
  id: string;
  phaseId: string;
  type: PlanItemType;
  label: string;
  startDate: string;
  endDate: string;
  order: number;
  parentItemId: string | null;
  meetingStatus: PlanMeetingStatus | null;
  scheduledTime: string | null;
  showOnReports?: boolean;
  reportLabel?: string | null;
  status?: PlanItemStatus;
  completedAt?: string | null;
};

export type PlanPhaseJson = {
  id: string;
  planId: string;
  name: string;
  color: string;
  order: number;
  showOnReports?: boolean;
  reportLabel?: string | null;
  items: PlanItemJson[];
};

type UpdatedByUser = {
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type PlanJson = {
  id: string;
  projectId: string;
  kickoffDate: string;
  endDate: string;
  assumptions: string[];
  updatedByUserId: string | null;
  updatedByName: string | null;
  updatedAt: string;
  phases: PlanPhaseJson[];
};

export function formatUpdatedByName(user: UpdatedByUser | null | undefined): string | null {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email;
}

export function computeDateMismatch(
  project: { startDate: Date; endDate: Date | null },
  plan: { kickoffDate: Date; endDate: Date } | null
): boolean {
  if (!plan) return false;
  const projectStart = toIsoDate(project.startDate);
  const projectEnd = project.endDate ? toIsoDate(project.endDate) : null;
  const planKickoff = toIsoDate(plan.kickoffDate);
  const planEnd = toIsoDate(plan.endDate);
  if (projectStart !== planKickoff) return true;
  if (projectEnd !== null && projectEnd !== planEnd) return true;
  return false;
}

type PlanItemRecord = {
  id: string;
  phaseId: string;
  type: PlanItemType;
  label: string;
  startDate: Date;
  endDate: Date;
  order: number;
  parentItemId?: string | null;
  meetingStatus?: PlanMeetingStatus | null;
  scheduledTime?: string | null;
  showOnReports?: boolean;
  reportLabel?: string | null;
  status?: PlanItemStatus;
  completedAt?: Date | null;
};

type PlanPhaseRecord = {
  id: string;
  planId: string;
  name: string;
  color: string;
  order: number;
  showOnReports?: boolean;
  reportLabel?: string | null;
  items?: PlanItemRecord[];
};

type ProjectPlanRecord = {
  id: string;
  projectId: string;
  kickoffDate: Date;
  endDate: Date;
  assumptions: string[];
  updatedByUserId: string | null;
  updatedAt: Date;
  phases?: PlanPhaseRecord[];
  updatedBy?: UpdatedByUser | null;
};

export function serializePlanItem(item: PlanItemRecord): PlanItemJson {
  return {
    id: item.id,
    phaseId: item.phaseId,
    type: item.type,
    label: item.label,
    startDate: toIsoDate(item.startDate),
    endDate: toIsoDate(item.endDate),
    order: item.order,
    parentItemId: item.parentItemId ?? null,
    meetingStatus: item.meetingStatus ?? null,
    scheduledTime: item.scheduledTime ?? null,
    showOnReports: item.showOnReports ?? false,
    reportLabel: item.reportLabel ?? null,
    status: item.status ?? "not_started",
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
  };
}

export function serializePlanPhase(phase: PlanPhaseRecord): PlanPhaseJson {
  const items = (phase.items ?? [])
    .slice()
    .sort((a, b) => a.order - b.order || a.startDate.getTime() - b.startDate.getTime())
    .map(serializePlanItem);

  return {
    id: phase.id,
    planId: phase.planId,
    name: phase.name,
    color: phase.color,
    order: phase.order,
    showOnReports: phase.showOnReports ?? true,
    reportLabel: phase.reportLabel ?? null,
    items,
  };
}

export function serializePlan(plan: ProjectPlanRecord): PlanJson {
  const phases = (plan.phases ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(serializePlanPhase);

  return {
    id: plan.id,
    projectId: plan.projectId,
    kickoffDate: toIsoDate(plan.kickoffDate),
    endDate: toIsoDate(plan.endDate),
    assumptions: plan.assumptions,
    updatedByUserId: plan.updatedByUserId,
    updatedByName: formatUpdatedByName(plan.updatedBy),
    updatedAt: plan.updatedAt.toISOString(),
    phases,
  };
}
