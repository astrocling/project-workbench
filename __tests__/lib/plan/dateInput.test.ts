import { describe, expect, it } from "vitest";
import { isCommittablePlanDate, resolvePlanDateCommit } from "@/lib/plan/dateInput";

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

describe("resolvePlanDateCommit", () => {
  it("commits a valid new date", () => {
    expect(resolvePlanDateCommit("2026-09-04", "2026-09-03")).toBe("2026-09-04");
  });

  it("skips a value equal to the stored date, so a blur alone does not PATCH", () => {
    expect(resolvePlanDateCommit("2026-09-03", "2026-09-03")).toBeNull();
  });

  it("skips every partial keystroke value", () => {
    expect(resolvePlanDateCommit("", "2026-09-03")).toBeNull();
    expect(resolvePlanDateCommit("0002-09-04", "2026-09-03")).toBeNull();
  });
});
