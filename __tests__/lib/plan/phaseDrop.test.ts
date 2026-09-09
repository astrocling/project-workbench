import { describe, expect, it } from "vitest";
import {
  reindexPhaseOrders,
  resolvePhaseDrop,
  validateInsertBeforePhase,
} from "@/lib/plan/phaseDrop";

const phases = [
  { id: "p1", order: 0 },
  { id: "p2", order: 1 },
  { id: "p3", order: 2 },
];

describe("resolvePhaseDrop", () => {
  it("inserts before another phase", () => {
    expect(resolvePhaseDrop(phases, "p3", { kind: "before", phaseId: "p1" })).toEqual({
      phaseId: "p3",
      insertBeforePhaseId: "p1",
    });
  });

  it("returns null when already immediately before the target", () => {
    expect(resolvePhaseDrop(phases, "p1", { kind: "before", phaseId: "p2" })).toBeNull();
  });

  it("returns null when dropping a phase onto itself", () => {
    expect(resolvePhaseDrop(phases, "p2", { kind: "before", phaseId: "p2" })).toBeNull();
  });

  it("appends when the target is the end of the list", () => {
    expect(resolvePhaseDrop(phases, "p1", { kind: "append" })).toEqual({
      phaseId: "p1",
      insertBeforePhaseId: null,
    });
  });

  it("returns null when already last and appending", () => {
    expect(resolvePhaseDrop(phases, "p3", { kind: "append" })).toBeNull();
  });
});

describe("validateInsertBeforePhase", () => {
  it("allows a null insert-before (append)", () => {
    expect(validateInsertBeforePhase(phases, "p1", null)).toBeNull();
  });

  it("rejects inserting a phase before itself", () => {
    expect(validateInsertBeforePhase(phases, "p1", "p1")).toBe(
      "Cannot insert a phase before itself"
    );
  });

  it("rejects a missing insert-before phase", () => {
    expect(validateInsertBeforePhase(phases, "p1", "missing")).toBe(
      "Insert-before phase not found"
    );
  });
});

describe("reindexPhaseOrders", () => {
  it("inserts the moved phase before the named sibling", () => {
    expect(reindexPhaseOrders(phases, "p3", "p1").map((row) => row.id)).toEqual([
      "p3",
      "p1",
      "p2",
    ]);
  });

  it("appends when insertBefore is null", () => {
    expect(reindexPhaseOrders(phases, "p1", null).map((row) => row.id)).toEqual([
      "p2",
      "p3",
      "p1",
    ]);
  });
});
