import { describe, expect, it } from "vitest";
import { rejectNonAdminPlanEnabledPatch } from "@/lib/plan/projectSettingsPatch";

describe("rejectNonAdminPlanEnabledPatch", () => {
  it("allows Admin to set planEnabled", () => {
    expect(rejectNonAdminPlanEnabledPatch("Admin", { planEnabled: true })).toBeNull();
  });

  it("allows User when planEnabled is omitted", () => {
    expect(rejectNonAdminPlanEnabledPatch("User", { name: "X" })).toBeNull();
  });

  it("forbids User when planEnabled is present even if false", () => {
    const result = rejectNonAdminPlanEnabledPatch("User", { planEnabled: false, name: "X" });
    expect(result).toEqual({
      error: "Only admins can enable or disable the Plan tab",
      status: 403,
    });
  });
});
