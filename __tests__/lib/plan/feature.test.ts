import { describe, expect, it } from "vitest";
import { isPlanTabEnabled } from "@/lib/plan/feature";

describe("isPlanTabEnabled", () => {
  it("is off when false, null, or undefined", () => {
    expect(isPlanTabEnabled(false)).toBe(false);
    expect(isPlanTabEnabled(null)).toBe(false);
    expect(isPlanTabEnabled(undefined)).toBe(false);
  });

  it("is on only when true", () => {
    expect(isPlanTabEnabled(true)).toBe(true);
  });
});
