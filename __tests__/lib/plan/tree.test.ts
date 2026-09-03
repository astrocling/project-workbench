import { describe, expect, it } from "vitest";
import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";
import {
  buildItemTree,
  flattenVisibleRows,
  getItemDepth,
  indentItem,
  outdentItem,
  wouldCreateCycle,
} from "@/lib/plan/tree";

function item(
  partial: Partial<PlanItemJson> & Pick<PlanItemJson, "id" | "phaseId" | "label">
): PlanItemJson {
  return {
    type: "task",
    startDate: "2025-02-17",
    endDate: "2025-02-21",
    order: 0,
    parentItemId: null,
    meetingStatus: null,
    scheduledTime: null,
    ...partial,
  };
}

function phase(
  partial: Partial<PlanPhaseJson> & Pick<PlanPhaseJson, "id" | "name" | "items">
): PlanPhaseJson {
  return {
    planId: "plan-1",
    color: "#1941FA",
    order: 0,
    ...partial,
  };
}

const nestedItems: PlanItemJson[] = [
  item({ id: "a", phaseId: "p1", label: "A", order: 0 }),
  item({ id: "b", phaseId: "p1", label: "B", order: 1, parentItemId: "a" }),
  item({ id: "c", phaseId: "p1", label: "C", order: 0, parentItemId: "b" }),
  item({ id: "d", phaseId: "p1", label: "D", order: 2 }),
];

describe("buildItemTree", () => {
  it("nests children under their parent", () => {
    const tree = buildItemTree(nestedItems);
    expect(tree.map((n) => n.id)).toEqual(["a", "d"]);
    expect(tree[0]!.children.map((n) => n.id)).toEqual(["b"]);
    expect(tree[0]!.children[0]!.children.map((n) => n.id)).toEqual(["c"]);
    expect(tree[1]!.children).toEqual([]);
  });

  it("treats orphans as roots", () => {
    const tree = buildItemTree([
      item({ id: "child", phaseId: "p1", label: "Child", parentItemId: "missing" }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.id).toBe("child");
    expect(tree[0]!.children).toEqual([]);
  });
});

describe("flattenVisibleRows", () => {
  const phases = [
    phase({
      id: "p1",
      name: "Discovery",
      order: 0,
      items: nestedItems,
    }),
    phase({
      id: "p2",
      name: "Design",
      order: 1,
      items: [item({ id: "e", phaseId: "p2", label: "E" })],
    }),
  ];

  it("flattens phases and nested items in order", () => {
    const rows = flattenVisibleRows(phases, new Set());
    expect(
      rows.map((row) =>
        row.kind === "phase"
          ? { kind: row.kind, id: row.phase.id, depth: row.depth, parentId: row.parentId }
          : {
              kind: row.kind,
              id: row.item!.id,
              depth: row.depth,
              parentId: row.parentId,
            }
      )
    ).toEqual([
      { kind: "phase", id: "p1", depth: 0, parentId: null },
      { kind: "item", id: "a", depth: 0, parentId: null },
      { kind: "item", id: "b", depth: 1, parentId: "a" },
      { kind: "item", id: "c", depth: 2, parentId: "b" },
      { kind: "item", id: "d", depth: 0, parentId: null },
      { kind: "phase", id: "p2", depth: 0, parentId: null },
      { kind: "item", id: "e", depth: 0, parentId: null },
    ]);
  });

  it("hides items when a phase is collapsed", () => {
    const rows = flattenVisibleRows(phases, new Set(["p1"]));
    expect(rows.map((row) => (row.kind === "phase" ? row.phase.id : row.item!.id))).toEqual([
      "p1",
      "p2",
      "e",
    ]);
  });

  it("hides descendants when an item is collapsed", () => {
    const rows = flattenVisibleRows(phases, new Set(["a"]));
    expect(rows.map((row) => (row.kind === "phase" ? row.phase.id : row.item!.id))).toEqual([
      "p1",
      "a",
      "d",
      "p2",
      "e",
    ]);
  });
});

describe("getItemDepth", () => {
  it("returns 0 for roots and increments per ancestor", () => {
    expect(getItemDepth(nestedItems, "a")).toBe(0);
    expect(getItemDepth(nestedItems, "b")).toBe(1);
    expect(getItemDepth(nestedItems, "c")).toBe(2);
  });
});

describe("wouldCreateCycle", () => {
  it("detects moving an ancestor under its descendant", () => {
    expect(wouldCreateCycle(nestedItems, "a", "c")).toBe(true);
    expect(wouldCreateCycle(nestedItems, "a", "d")).toBe(false);
    expect(wouldCreateCycle(nestedItems, "d", "a")).toBe(false);
    expect(wouldCreateCycle(nestedItems, "a", "a")).toBe(true);
    expect(wouldCreateCycle(nestedItems, "a", null)).toBe(false);
  });
});

describe("indentItem / outdentItem", () => {
  it("indents under the previous sibling", () => {
    expect(indentItem(nestedItems, "d")).toEqual({ parentItemId: "a" });
  });

  it("does not indent the first sibling", () => {
    expect(indentItem(nestedItems, "a")).toBeNull();
  });

  it("outdents to the parent's parent", () => {
    expect(outdentItem(nestedItems, "c")).toEqual({ parentItemId: "a" });
    expect(outdentItem(nestedItems, "b")).toEqual({ parentItemId: null });
    expect(outdentItem(nestedItems, "a")).toBeNull();
  });
});
