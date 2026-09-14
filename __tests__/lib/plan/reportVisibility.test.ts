import { describe, expect, it } from "vitest";
import { defaultShowOnReports } from "@/lib/plan/reportVisibility";

describe("defaultShowOnReports", () => {
  it("includes key dates and scheduled meetings", () => {
    expect(defaultShowOnReports("milestone", null)).toBe(true);
    expect(defaultShowOnReports("sign_off", null)).toBe(true);
    expect(defaultShowOnReports("hard_deadline", null)).toBe(true);
    expect(defaultShowOnReports("meeting", "scheduled")).toBe(true);
  });

  it("excludes tasks, waiting, and unscheduled meetings", () => {
    expect(defaultShowOnReports("task", null)).toBe(false);
    expect(defaultShowOnReports("waiting_on_client", null)).toBe(false);
    expect(defaultShowOnReports("meeting", "unscheduled")).toBe(false);
    expect(defaultShowOnReports("meeting", null)).toBe(false);
  });
});
