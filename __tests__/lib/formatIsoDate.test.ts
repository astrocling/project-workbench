import { describe, expect, it } from "vitest";
import {
  formatMonthDay,
  getDeployDayName,
  isThursdayOrFriday,
} from "@/lib/formatIsoDate";

describe("formatIsoDate", () => {
  it("formatMonthDay parses YYYY-MM-DD without timezone shift", () => {
    expect(formatMonthDay("2026-06-03")).toBe("06/03");
    expect(formatMonthDay("2026-05-07")).toBe("05/07");
  });

  it("isThursdayOrFriday uses calendar weekday", () => {
    expect(isThursdayOrFriday("2026-06-04")).toBe(true); // Thu
    expect(isThursdayOrFriday("2026-06-08")).toBe(false); // Mon
  });

  it("getDeployDayName returns weekday label", () => {
    expect(getDeployDayName("2026-06-04")).toBe("Thu");
  });
});
