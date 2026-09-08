import { describe, expect, it } from "vitest";
import { reindexSiblingOrders, resolveItemDrop, validateInsertBefore } from "@/lib/plan/itemDrop";
import type { PlanItemJson } from "@/lib/plan/serialize";

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

const items: PlanItemJson[] = [
  item({ id: "a", phaseId: "p1", label: "A", order: 0 }),
  item({ id: "b", phaseId: "p1", label: "B", order: 1, parentItemId: "a" }),
  item({ id: "c", phaseId: "p1", label: "C", order: 0, parentItemId: "b" }),
  item({ id: "d", phaseId: "p1", label: "D", order: 2 }),
  item({ id: "e", phaseId: "p2", label: "E", order: 0 }),
  item({ id: "g", phaseId: "p1", label: "G", order: 0, parentItemId: "c" }),
];

describe("resolveItemDrop", () => {
  it("nests under the target item", () => {
    expect(resolveItemDrop(items, "d", { kind: "nest", itemId: "a" })).toEqual({
      ok: true,
      placement: {
        itemId: "d",
        phaseId: "p1",
        parentItemId: "a",
        insertBeforeItemId: null,
      },
    });
  });

  it("reorders as a sibling before the row below", () => {
    expect(resolveItemDrop(items, "d", { kind: "before", itemId: "a" })).toEqual({
      ok: true,
      placement: {
        itemId: "d",
        phaseId: "p1",
        parentItemId: null,
        insertBeforeItemId: "a",
      },
    });
  });

  it("drops onto a phase as a top-level append", () => {
    expect(resolveItemDrop(items, "d", { kind: "phase", phaseId: "p2" })).toEqual({
      ok: true,
      placement: {
        itemId: "d",
        phaseId: "p2",
        parentItemId: null,
        insertBeforeItemId: null,
      },
    });
  });

  it("nests across phases", () => {
    expect(resolveItemDrop(items, "d", { kind: "nest", itemId: "e" })).toEqual({
      ok: true,
      placement: {
        itemId: "d",
        phaseId: "p2",
        parentItemId: "e",
        insertBeforeItemId: null,
      },
    });
  });

  it("rejects nesting an ancestor under a descendant", () => {
    expect(resolveItemDrop(items, "a", { kind: "nest", itemId: "c" })).toEqual({
      ok: false,
      error: "Nesting would create a cycle",
    });
  });

  it("rejects nesting deeper than three levels", () => {
    expect(resolveItemDrop(items, "d", { kind: "nest", itemId: "g" })).toEqual({
      ok: false,
      error: "Items cannot be nested deeper than 3 levels",
    });
  });

  it("returns null when dropping an item onto itself", () => {
    expect(resolveItemDrop(items, "d", { kind: "nest", itemId: "d" })).toBeNull();
  });

  it("returns null when already last top-level in that phase", () => {
    expect(resolveItemDrop(items, "e", { kind: "phase", phaseId: "p2" })).toBeNull();
  });
});

describe("reindexSiblingOrders", () => {
  it("inserts the moved item before the named sibling", () => {
    expect(
      reindexSiblingOrders(items, "d", "p1", null, "a").map((row) => row.id)
    ).toEqual(["d", "a"]);
  });

  it("appends when insertBefore is null", () => {
    expect(
      reindexSiblingOrders(items, "d", "p2", null, null).map((row) => row.id)
    ).toEqual(["e", "d"]);
  });

  it("omits descendants of the moved item from the sibling list", () => {
    expect(
      reindexSiblingOrders(items, "a", "p2", null, null).map((row) => row.id)
    ).toEqual(["e", "a"]);
  });
});

describe("validateInsertBefore", () => {
  it("allows null (append)", () => {
    expect(validateInsertBefore(items, "d", "p2", null, null)).toBeNull();
  });

  it("rejects a target that is not in the destination sibling group", () => {
    expect(validateInsertBefore(items, "d", "p2", null, "a")).toBe(
      "Insert-before item must be in the destination sibling group"
    );
  });
});
