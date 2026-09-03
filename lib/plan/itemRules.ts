import { getItemDepth, wouldCreateCycle } from "@/lib/plan/tree";
import {
  isPointType,
  isRangeType,
  MAX_ITEM_DEPTH,
  type PlanItemType,
  type PlanMeetingStatus,
} from "@/lib/plan/types";

export type ItemDatesInput = {
  type: PlanItemType;
  meetingStatus?: PlanMeetingStatus | null;
  startDate: string;
  endDate: string;
};

export type ItemRuleContextItem = {
  id: string;
  phaseId: string;
  parentItemId: string | null;
};

export type ItemPayloadInput = ItemDatesInput & {
  phaseId: string;
  parentItemId?: string | null;
  itemId?: string | null;
};

export function normalizeItemDates({
  type,
  meetingStatus,
  startDate,
  endDate,
}: ItemDatesInput): { startDate: string; endDate: string } {
  if (isPointType(type, meetingStatus)) {
    return { startDate, endDate: startDate };
  }
  return { startDate, endDate };
}

export function validateItemPayload(
  payload: ItemPayloadInput,
  items: ItemRuleContextItem[]
): string | null {
  const { type, meetingStatus, startDate, endDate, phaseId, parentItemId, itemId } = payload;

  if (type === "meeting" && meetingStatus !== "assumed" && meetingStatus !== "scheduled") {
    return "Meeting items require a meetingStatus";
  }

  if (isPointType(type, meetingStatus) && startDate !== endDate) {
    return "Point items must use a single date";
  }

  if (isRangeType(type, meetingStatus) && startDate > endDate) {
    return "Start date must be on or before end date";
  }

  if (startDate > endDate) {
    return "Start date must be on or before end date";
  }

  if (!parentItemId) return null;

  if (itemId && parentItemId === itemId) {
    return "Cannot nest an item under itself";
  }

  const parent = items.find((item) => item.id === parentItemId);
  if (!parent) return "Parent item not found";
  if (parent.phaseId !== phaseId) return "Parent must be in the same phase";

  if (itemId && wouldCreateCycle(items, itemId, parentItemId)) {
    return "Nesting would create a cycle";
  }

  const parentDepth = getItemDepth(items, parentItemId);
  const newDepth = parentDepth + 1;
  const extra = itemId ? maxDescendantDepth(items, itemId) : 0;
  if (newDepth + extra > MAX_ITEM_DEPTH) {
    return `Items cannot be nested deeper than ${MAX_ITEM_DEPTH} levels`;
  }

  return null;
}

function maxDescendantDepth(items: ItemRuleContextItem[], itemId: string): number {
  const children = items.filter((item) => item.parentItemId === itemId);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((child) => maxDescendantDepth(items, child.id)));
}
