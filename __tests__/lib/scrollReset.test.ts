import { describe, expect, it } from "vitest";
import { navigationKey, shouldResetWindowScroll } from "@/lib/scrollReset";

describe("navigationKey", () => {
  it("joins pathname and query", () => {
    expect(navigationKey("/pgm-dashboard", "")).toBe("/pgm-dashboard");
    expect(navigationKey("/projects/acme", "tab=budget")).toBe("/projects/acme?tab=budget");
    expect(navigationKey("/projects/acme", "?tab=budget")).toBe("/projects/acme?tab=budget");
  });
});

describe("shouldResetWindowScroll", () => {
  it("does not reset on first layout mount (full page load)", () => {
    expect(
      shouldResetWindowScroll({
        previousKey: null,
        nextKey: "/projects/acme?tab=budget",
        isPopNavigation: false,
      })
    ).toBe(false);
  });

  it("resets when navigating to a different page (shared layout keeps window scroll)", () => {
    expect(
      shouldResetWindowScroll({
        previousKey: "/projects/acme?tab=budget",
        nextKey: "/pgm-dashboard",
        isPopNavigation: false,
      })
    ).toBe(true);
  });

  it("resets when project tab query changes", () => {
    expect(
      shouldResetWindowScroll({
        previousKey: "/projects/acme?tab=budget",
        nextKey: "/projects/acme?tab=overview",
        isPopNavigation: false,
      })
    ).toBe(true);
  });

  it("does not reset when the location key is unchanged", () => {
    expect(
      shouldResetWindowScroll({
        previousKey: "/pgm-dashboard",
        nextKey: "/pgm-dashboard",
        isPopNavigation: false,
      })
    ).toBe(false);
  });

  it("does not reset on back/forward so history scroll can restore", () => {
    expect(
      shouldResetWindowScroll({
        previousKey: "/pgm-dashboard",
        nextKey: "/projects/acme?tab=budget",
        isPopNavigation: true,
      })
    ).toBe(false);
  });
});
