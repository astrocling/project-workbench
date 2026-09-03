import { describe, expect, it } from "vitest";
import {
  isCommittablePlanDate,
  resolvePlanDateCellEdit,
  type PlanDateEditEvent,
} from "@/lib/plan/dateInput";

describe("isCommittablePlanDate", () => {
  it("accepts a complete YYYY-MM-DD date in a plausible year", () => {
    expect(isCommittablePlanDate("2026-09-03")).toBe(true);
  });

  it("rejects the empty and partial values a date input reports mid-entry", () => {
    expect(isCommittablePlanDate("")).toBe(false);
    expect(isCommittablePlanDate("2026-09")).toBe(false);
    expect(isCommittablePlanDate("2026-9-3")).toBe(false);
  });

  it("rejects the placeholder years a date input reports while the year is typed digit by digit", () => {
    // Typing "2026" in the year segment passes through 0002-09-03, 0020-…, 0202-… first.
    expect(isCommittablePlanDate("0002-09-03")).toBe(false);
    expect(isCommittablePlanDate("0020-09-03")).toBe(false);
    expect(isCommittablePlanDate("0202-09-03")).toBe(false);
    expect(isCommittablePlanDate("9999-09-03")).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(isCommittablePlanDate("2026-13-01")).toBe(false);
    expect(isCommittablePlanDate("2026-02-30")).toBe(false);
  });
});

/**
 * A date cell mounted on `externalValue`, driven through a sequence of change/blur events the way
 * `DateCell` in `components/plan/PlanGridGantt.tsx` drives it: the cell's own `lastSubmitted` is
 * threaded from one event to the next, and `externalValue` stays put until the server round-trip
 * lands (which is exactly the window where a stale prop used to cause a second PATCH).
 */
function mountCell(externalValue: string) {
  let lastSubmitted: string | null = null;
  const saves: string[] = [];
  const restores: string[] = [];
  let external = externalValue;

  return {
    saves,
    restores,
    /** Server round-trip landed (or another editor changed the row) while the cell was not focused. */
    syncExternal(nextValue: string) {
      external = nextValue;
      lastSubmitted = null;
    },
    send(event: PlanDateEditEvent, inputValue: string) {
      const decision = resolvePlanDateCellEdit({
        event,
        inputValue,
        externalValue: external,
        lastSubmitted,
      });
      lastSubmitted = decision.nextLastSubmitted;
      if (decision.save != null) saves.push(decision.save);
      if (decision.restore != null) restores.push(decision.restore);
      return decision;
    },
  };
}

describe("resolvePlanDateCellEdit", () => {
  it("saves nothing while a date is being typed", () => {
    const cell = mountCell("2026-09-03");
    cell.send("change", "");
    cell.send("change", "0002-09-04");
    cell.send("change", "0020-09-04");
    expect(cell.saves).toEqual([]);
    expect(cell.restores).toEqual([]);
  });

  it("saves a complete date once", () => {
    const cell = mountCell("2026-09-03");
    cell.send("change", "2026-09-04");
    expect(cell.saves).toEqual(["2026-09-04"]);
  });

  it("does not save twice when the completed change is followed immediately by blur", () => {
    // The bug: on blur the stored prop is still the pre-save date, so comparing against it
    // made the same value look like a fresh edit and fired a second PATCH.
    const cell = mountCell("2026-09-03");
    cell.send("change", "2026-09-04");
    cell.send("blur", "2026-09-04");
    expect(cell.saves).toEqual(["2026-09-04"]);
    expect(cell.restores).toEqual([]);
  });

  it("saves once when the change never fired and the new date is seen on blur", () => {
    const cell = mountCell("2026-09-03");
    cell.send("blur", "2026-09-10");
    cell.send("blur", "2026-09-10");
    expect(cell.saves).toEqual(["2026-09-10"]);
  });

  it("saves nothing when the value never changed", () => {
    const cell = mountCell("2026-09-03");
    cell.send("change", "2026-09-03");
    cell.send("blur", "2026-09-03");
    expect(cell.saves).toEqual([]);
    expect(cell.restores).toEqual([]);
  });

  it("restores the committed date when an incomplete edit is abandoned on blur", () => {
    const cell = mountCell("2026-09-03");
    cell.send("change", "");
    const decision = cell.send("blur", "");
    expect(cell.saves).toEqual([]);
    expect(decision.restore).toBe("2026-09-03");
  });

  it("restores the value it last saved, not the stale prop, when a later edit is abandoned", () => {
    const cell = mountCell("2026-09-03");
    cell.send("change", "2026-09-04");
    const decision = cell.send("blur", "");
    expect(cell.saves).toEqual(["2026-09-04"]);
    expect(decision.restore).toBe("2026-09-04");
  });

  it("still saves a further distinct edit made while the first save is in flight", () => {
    const cell = mountCell("2026-09-03");
    cell.send("change", "2026-09-04");
    cell.send("change", "2026-09-05");
    cell.send("blur", "2026-09-05");
    expect(cell.saves).toEqual(["2026-09-04", "2026-09-05"]);
  });

  it("saves a revert to the stored date while a save is in flight", () => {
    const cell = mountCell("2026-09-03");
    cell.send("change", "2026-09-04");
    cell.send("blur", "2026-09-03");
    expect(cell.saves).toEqual(["2026-09-04", "2026-09-03"]);
  });

  it("takes the refetched value as the new baseline once it lands", () => {
    const cell = mountCell("2026-09-03");
    cell.send("change", "2026-09-04");
    cell.syncExternal("2026-09-04");
    cell.send("change", "2026-09-04");
    cell.send("blur", "2026-09-04");
    expect(cell.saves).toEqual(["2026-09-04"]);
  });
});
