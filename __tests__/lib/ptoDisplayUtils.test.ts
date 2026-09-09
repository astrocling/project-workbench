import { describe, expect, it } from "vitest";
import {
  formatHolidayHoverLine,
  formatPtoHoverLine,
  formatWeekdayLetters,
} from "@/lib/ptoDisplayUtils";

describe("formatWeekdayLetters", () => {
  it("returns single-letter UTC weekdays in date order", () => {
    expect(formatWeekdayLetters(["2026-09-07", "2026-09-09", "2026-09-08"])).toBe(
      "M, T, W"
    );
  });

  it("uses R for Thursday", () => {
    expect(formatWeekdayLetters(["2026-09-10"])).toBe("R");
  });
});

describe("formatPtoHoverLine", () => {
  it("includes weekday letters next to full-day PTO", () => {
    expect(
      formatPtoHoverLine("Alexandru Cracea", [
        { date: "2026-09-07", hours: 8, isPartial: false },
        { date: "2026-09-08", hours: 8, isPartial: false },
        { date: "2026-09-09", hours: 8, isPartial: false },
      ])
    ).toBe("Alexandru Cracea: 3 day(s) PTO (M, T, W)");
  });

  it("includes weekday letters next to partial PTO", () => {
    expect(
      formatPtoHoverLine("Matthew Cannon", [
        { date: "2026-09-10", hours: 4, isPartial: true },
      ])
    ).toBe("Matthew Cannon: partial PTO (4h this week) (R)");
  });
});

describe("formatHolidayHoverLine", () => {
  it("puts the weekday letter next to the holiday name", () => {
    expect(formatHolidayHoverLine("Labor Day", ["2026-09-07"])).toBe("Labor Day (M)");
  });
});
