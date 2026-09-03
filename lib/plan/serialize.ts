import type {
  PlanItemType,
  PlanMeetingStatus,
} from "@/lib/plan/types";

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
};

export type PlanPhaseJson = {
  id: string;
  planId: string;
  name: string;
  color: string;
  order: number;
  items: PlanItemJson[];
};

export type PlanMeetingJson = {
  id: string;
  planId: string;
  label: string;
  status: PlanMeetingStatus;
  windowStart: string;
  windowEnd: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  relatedPhaseId: string | null;
  relatedItemId: string | null;
  notes: string | null;
  order: number;
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
  meetings: PlanMeetingJson[];
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
};

type PlanPhaseRecord = {
  id: string;
  planId: string;
  name: string;
  color: string;
  order: number;
  items?: PlanItemRecord[];
};

type PlanMeetingRecord = {
  id: string;
  planId: string;
  label: string;
  status: PlanMeetingStatus;
  windowStart: Date;
  windowEnd: Date;
  scheduledDate: Date | null;
  scheduledTime: string | null;
  relatedPhaseId: string | null;
  relatedItemId: string | null;
  notes: string | null;
  order: number;
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
  meetings?: PlanMeetingRecord[];
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
    items,
  };
}

export function serializePlanMeeting(meeting: PlanMeetingRecord): PlanMeetingJson {
  return {
    id: meeting.id,
    planId: meeting.planId,
    label: meeting.label,
    status: meeting.status,
    windowStart: toIsoDate(meeting.windowStart),
    windowEnd: toIsoDate(meeting.windowEnd),
    scheduledDate: meeting.scheduledDate ? toIsoDate(meeting.scheduledDate) : null,
    scheduledTime: meeting.scheduledTime,
    relatedPhaseId: meeting.relatedPhaseId,
    relatedItemId: meeting.relatedItemId,
    notes: meeting.notes,
    order: meeting.order,
  };
}

export function serializePlan(plan: ProjectPlanRecord): PlanJson {
  const phases = (plan.phases ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(serializePlanPhase);

  const meetings = (plan.meetings ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(serializePlanMeeting);

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
    meetings,
  };
}
