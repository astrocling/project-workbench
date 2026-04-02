import { describe, it, expect } from "vitest";
import { floatAccessLabelFromAccount } from "@/lib/float/syncFloatImport";

describe("floatAccessLabelFromAccount", () => {
  it("returns null for null or non-object", () => {
    expect(floatAccessLabelFromAccount(null)).toBeNull();
    expect(floatAccessLabelFromAccount(undefined)).toBeNull();
    expect(floatAccessLabelFromAccount("x")).toBeNull();
  });

  it("returns No login for empty object", () => {
    expect(floatAccessLabelFromAccount({})).toBe("No login");
  });

  it("prefers access_level and similar fields", () => {
    expect(floatAccessLabelFromAccount({ access_level: "Admin" })).toBe("Admin");
    expect(floatAccessLabelFromAccount({ permission: " View " })).toBe("View");
  });

  it("falls back to email or Linked", () => {
    expect(floatAccessLabelFromAccount({ email: "a@b.co" })).toBe("a@b.co");
    expect(floatAccessLabelFromAccount({ account_id: 1 })).toBe("Linked");
  });
});
