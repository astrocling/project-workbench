import { validateItemPayload } from "@/lib/plan/itemRules";
import { collectDescendantIds } from "@/lib/plan/tree";
import type { PlanItemJson } from "@/lib/plan/serialize";

export type ItemDropTarget =
  | { kind: "nest"; itemId: string }
  | { kind: "before"; itemId: string }
  | { kind: "phase"; phaseId: string };

export type ItemDropPlacement = {
  itemId: string;
  phaseId: string;
  parentItemId: string | null;
  insertBeforeItemId: string | null;
};

export type ItemDropResult =
  | { ok: true; placement: ItemDropPlacement }
  | { ok: false; error: string };

function asRuleItems(items: PlanItemJson[]) {
  return items.map((item) => ({
    id: item.id,
    phaseId: item.phaseId,
    parentItemId: item.parentItemId,
  }));
}

function validateMove(
  dragged: PlanItemJson,
  phaseId: string,
  parentItemId: string | null,
  items: PlanItemJson[]
): string | null {
  return validateItemPayload(
    {
      type: dragged.type,
      meetingStatus: dragged.meetingStatus,
      startDate: dragged.startDate,
      endDate: dragged.endDate,
      phaseId,
      parentItemId,
      itemId: dragged.id,
    },
    asRuleItems(items)
  );
}

function isAppendNoOp(
  items: PlanItemJson[],
  dragged: PlanItemJson,
  placement: ItemDropPlacement
): boolean {
  if (dragged.phaseId !== placement.phaseId) return false;
  if (dragged.parentItemId !== placement.parentItemId) return false;
  if (placement.insertBeforeItemId !== null) return false;
  const siblings = items
    .filter(
      (item) =>
        item.phaseId === placement.phaseId &&
        item.parentItemId === placement.parentItemId
    )
    .slice()
    .sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate));
  return siblings[siblings.length - 1]?.id === dragged.id;
}

export function resolveItemDrop(
  items: PlanItemJson[],
  draggedItemId: string,
  target: ItemDropTarget
): ItemDropResult | null {
  const dragged = items.find((item) => item.id === draggedItemId);
  if (!dragged) return null;

  if (target.kind === "nest") {
    if (target.itemId === draggedItemId) return null;
    const parent = items.find((item) => item.id === target.itemId);
    if (!parent) return null;
    const descendants = new Set(collectDescendantIds(items, draggedItemId));
    if (descendants.has(parent.id)) {
      return { ok: false, error: "Nesting would create a cycle" };
    }
    const error = validateMove(dragged, parent.phaseId, parent.id, items);
    if (error) return { ok: false, error };
    const placement: ItemDropPlacement = {
      itemId: dragged.id,
      phaseId: parent.phaseId,
      parentItemId: parent.id,
      insertBeforeItemId: null,
    };
    if (isAppendNoOp(items, dragged, placement)) return null;
    return { ok: true, placement };
  }

  if (target.kind === "before") {
    if (target.itemId === draggedItemId) return null;
    const below = items.find((item) => item.id === target.itemId);
    if (!below) return null;
    const descendants = new Set(collectDescendantIds(items, draggedItemId));
    if (descendants.has(below.id)) {
      return { ok: false, error: "Nesting would create a cycle" };
    }
    const error = validateMove(dragged, below.phaseId, below.parentItemId, items);
    if (error) return { ok: false, error };
    const placement: ItemDropPlacement = {
      itemId: dragged.id,
      phaseId: below.phaseId,
      parentItemId: below.parentItemId,
      insertBeforeItemId: below.id,
    };
    if (
      dragged.phaseId === placement.phaseId &&
      dragged.parentItemId === placement.parentItemId
    ) {
      const siblings = items
        .filter(
          (item) =>
            item.phaseId === placement.phaseId &&
            item.parentItemId === placement.parentItemId
        )
        .slice()
        .sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate));
      const draggedIndex = siblings.findIndex((item) => item.id === dragged.id);
      const beforeIndex = siblings.findIndex((item) => item.id === below.id);
      if (draggedIndex >= 0 && draggedIndex + 1 === beforeIndex) return null;
    }
    return { ok: true, placement };
  }

  const error = validateMove(dragged, target.phaseId, null, items);
  if (error) return { ok: false, error };
  const placement: ItemDropPlacement = {
    itemId: dragged.id,
    phaseId: target.phaseId,
    parentItemId: null,
    insertBeforeItemId: null,
  };
  if (isAppendNoOp(items, dragged, placement)) return null;
  return { ok: true, placement };
}

export function validateInsertBefore(
  items: Array<{
    id: string;
    phaseId: string;
    parentItemId: string | null;
  }>,
  movedId: string,
  nextPhaseId: string,
  nextParentId: string | null,
  insertBeforeItemId: string | null
): string | null {
  if (insertBeforeItemId === null) return null;
  if (insertBeforeItemId === movedId) return "Cannot insert an item before itself";
  const descendants = new Set(collectDescendantIds(items, movedId));
  if (descendants.has(insertBeforeItemId)) {
    return "Cannot insert before a descendant";
  }
  const before = items.find((item) => item.id === insertBeforeItemId);
  if (!before) return "Insert-before item not found";
  if (before.phaseId !== nextPhaseId || before.parentItemId !== nextParentId) {
    return "Insert-before item must be in the destination sibling group";
  }
  return null;
}

export function reindexSiblingOrders(
  items: Array<{
    id: string;
    phaseId: string;
    parentItemId: string | null;
    order: number;
  }>,
  movedId: string,
  nextPhaseId: string,
  nextParentId: string | null,
  insertBeforeItemId: string | null
): { id: string; order: number }[] {
  const descendantIds = new Set(collectDescendantIds(items, movedId));
  const siblings = items
    .filter(
      (item) =>
        item.id !== movedId &&
        !descendantIds.has(item.id) &&
        item.phaseId === nextPhaseId &&
        item.parentItemId === nextParentId
    )
    .slice()
    .sort((a, b) => a.order - b.order);

  const insertAt =
    insertBeforeItemId == null
      ? siblings.length
      : siblings.findIndex((item) => item.id === insertBeforeItemId);
  const at = insertAt < 0 ? siblings.length : insertAt;
  const ordered = [
    ...siblings.slice(0, at).map((item) => item.id),
    movedId,
    ...siblings.slice(at).map((item) => item.id),
  ];
  return ordered.map((id, order) => ({ id, order }));
}
