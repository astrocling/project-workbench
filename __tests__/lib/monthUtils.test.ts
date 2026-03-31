import { describe, it, expect } from "vitest";
import { getMonthKeysForWeek, isPastLastUtcDayOfMonthInWeek } from "@/lib/monthUtils";

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

describe("isPastLastUtcDayOfMonthInWeek", () => {
  const decJanWeek = new Date("2024-12-30T00:00:00Z"); // Mon Dec 30 – Sun Jan 5

  it("is false on last UTC day of first month in week", () => {
    expect(
      isPastLastUtcDayOfMonthInWeek(decJanWeek, "2024-12", new Date("2024-12-31T12:00:00Z"))
    ).toBe(false);
  });

  it("is true on first UTC day after first month in week (year boundary)", () => {
    expect(
      isPastLastUtcDayOfMonthInWeek(decJanWeek, "2024-12", new Date("2025-01-01T00:00:00Z"))
    ).toBe(true);
  });

  it("is false before January ends for Jan/Feb split week", () => {
    const janFebWeek = new Date("2025-01-27T00:00:00Z"); // Mon Jan 27 – Sun Feb 2
    expect(
      isPastLastUtcDayOfMonthInWeek(janFebWeek, "2025-01", new Date("2025-01-31T23:59:59Z"))
    ).toBe(false);
  });

  it("is true after January ends for Jan/Feb split week", () => {
    const janFebWeek = new Date("2025-01-27T00:00:00Z");
    expect(
      isPastLastUtcDayOfMonthInWeek(janFebWeek, "2025-01", new Date("2025-02-01T00:00:00Z"))
    ).toBe(true);
  });

  it("returns false for monthKey that does not appear in week", () => {
    const monday = new Date("2025-02-17T00:00:00Z");
    expect(isPastLastUtcDayOfMonthInWeek(monday, "2025-03", new Date("2025-03-01T00:00:00Z"))).toBe(
      false
    );
  });
});
