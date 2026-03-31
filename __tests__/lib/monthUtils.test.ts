import { describe, it, expect } from "vitest";
import { getMonthKeysForWeek } from "@/lib/monthUtils";

describe("getMonthKeysForWeek", () => {
  it("returns single month when week is entirely in one month", () => {
    const monday = new Date("2025-02-17T00:00:00Z");
    const result = getMonthKeysForWeek(monday);
    expect(result).toEqual(["2025-02"]);
  });

  it("returns two months when week spans two months", () => {
    const monday = new Date("2024-12-30T00:00:00Z");
    const result = getMonthKeysForWeek(monday);
    expect(result).toEqual(["2024-12", "2025-01"]);
  });

  it("returns two months at year boundary (Jan 1 week)", () => {
    const monday = new Date("2024-12-30T00:00:00Z");
    const result = getMonthKeysForWeek(monday);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("2024-12");
    expect(result[1]).toBe("2025-01");
  });

  it("returns single month for mid-month week", () => {
    const monday = new Date("2025-01-06T00:00:00Z");
    const result = getMonthKeysForWeek(monday);
    expect(result).toEqual(["2025-01"]);
  });
});
