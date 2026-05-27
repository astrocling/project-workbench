import { describe, expect, it } from "vitest";
import { resolveShowBudget, type StatusReportSnapshot } from "@/lib/statusReportPdfData";

const baseSnapshot: StatusReportSnapshot = {
  period: "Jan 1 – Jan 5, 2026",
  today: "Jan 6, 2026",
};

describe("resolveShowBudget", () => {
  it("defaults to true when snapshot is null", () => {
    expect(resolveShowBudget(null)).toBe(true);
  });

  it("defaults to true when showBudget is absent from snapshot", () => {
    expect(resolveShowBudget(baseSnapshot)).toBe(true);
  });

  it("returns false when snapshot.showBudget is false", () => {
    expect(resolveShowBudget({ ...baseSnapshot, showBudget: false })).toBe(false);
  });

  it("returns true when snapshot.showBudget is true", () => {
    expect(resolveShowBudget({ ...baseSnapshot, showBudget: true })).toBe(true);
  });
});
