import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";
import { MAX_ITEM_DEPTH } from "@/lib/plan/types";

export type PlanItemNode = PlanItemJson & { children: PlanItemNode[] };

export type PlanVisibleRow = {
  kind: "phase" | "item";
  phase: PlanPhaseJson;
  item?: PlanItemJson;
  depth: number;
  parentId: string | null;
};

type ItemLink = {
  id: string;
  parentItemId: string | null;
};

function sortItems<T extends { order: number; startDate: string }>(items: T[]): T[] {
  return items
    .slice()
    .sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate));
}

export function buildItemTree(items: PlanItemJson[]): PlanItemNode[] {
  const ids = new Set(items.map((item) => item.id));
  const byParent = new Map<string | null, PlanItemJson[]>();

  for (const item of items) {
    const parentId =
      item.parentItemId && ids.has(item.parentItemId) ? item.parentItemId : null;
    const list = byParent.get(parentId) ?? [];
    list.push(item);
    byParent.set(parentId, list);
  }

  function toNode(item: PlanItemJson): PlanItemNode {
    const children = sortItems(byParent.get(item.id) ?? []).map(toNode);
    return { ...item, children };
  }

  return sortItems(byParent.get(null) ?? []).map(toNode);
}

export function flattenVisibleRows(
  phases: PlanPhaseJson[],
  collapsedIds: Set<string>
): PlanVisibleRow[] {
  const rows: PlanVisibleRow[] = [];

  for (const phase of phases.slice().sort((a, b) => a.order - b.order)) {
    rows.push({ kind: "phase", phase, depth: 0, parentId: null });
    if (collapsedIds.has(phase.id)) continue;

    function walk(nodes: PlanItemNode[], parentId: string | null, depth: number) {
      for (const node of nodes) {
        const { children, ...item } = node;
        rows.push({ kind: "item", phase, item, depth, parentId });
        if (!collapsedIds.has(node.id)) {
          walk(children, node.id, depth + 1);
        }
      }
    }

    walk(buildItemTree(phase.items), null, 0);
  }

  return rows;
}

export function getItemDepth(items: ItemLink[], itemId: string): number {
  const byId = new Map(items.map((item) => [item.id, item]));
  let depth = 0;
  let current = byId.get(itemId);
  const seen = new Set<string>();

  while (current?.parentItemId) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    const parent = byId.get(current.parentItemId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }

  return depth;
}

export function wouldCreateCycle(
  items: ItemLink[],
  itemId: string,
  newParentId: string | null | undefined
): boolean {
  if (!newParentId) return false;
  if (newParentId === itemId) return true;

  const byId = new Map(items.map((item) => [item.id, item]));
  let current = byId.get(newParentId);
  const seen = new Set<string>();

  while (current) {
    if (current.id === itemId) return true;
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    if (!current.parentItemId) break;
    current = byId.get(current.parentItemId);
  }

  return false;
}

export function collectDescendantIds(items: ItemLink[], itemId: string): string[] {
  const children = items.filter((item) => item.parentItemId === itemId);
  return children.flatMap((child) => [child.id, ...collectDescendantIds(items, child.id)]);
}

/** Become a child of the previous sibling (same parent), if allowed. */
export function indentItem(
  items: PlanItemJson[],
  itemId: string
): { parentItemId: string } | null {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return null;

  const siblings = sortItems(
    items.filter(
      (candidate) =>
        candidate.phaseId === item.phaseId && candidate.parentItemId === item.parentItemId
    )
  );
  const index = siblings.findIndex((candidate) => candidate.id === itemId);
  if (index <= 0) return null;

  const prev = siblings[index - 1]!;
  if (wouldCreateCycle(items, itemId, prev.id)) return null;

  const newDepth = getItemDepth(items, prev.id) + 1;
  const subtreeExtra = maxDescendantDepth(items, itemId);
  if (newDepth + subtreeExtra > MAX_ITEM_DEPTH) return null;

  return { parentItemId: prev.id };
}

/** Become a sibling of the current parent. */
export function outdentItem(
  items: PlanItemJson[],
  itemId: string
): { parentItemId: string | null } | null {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item?.parentItemId) return null;

  const parent = items.find((candidate) => candidate.id === item.parentItemId);
  return { parentItemId: parent?.parentItemId ?? null };
}

function maxDescendantDepth(items: ItemLink[], itemId: string): number {
  const children = items.filter((item) => item.parentItemId === itemId);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((child) => maxDescendantDepth(items, child.id)));
}
