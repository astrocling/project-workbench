import { describe, it, expect } from "vitest";
import {
  getWeekStartDate,
  getAsOfDate,
  getCompletedWeeks,
  getFutureWeeks,
  isCompletedWeek,
  isFutureWeek,
  isCurrentWeek,
  parseWeekHeader,
  parseFloatWeekHeader,
  formatWeekKey,
} from "@/lib/weekUtils";

describe("getWeekStartDate", () => {
  it("returns Monday for a Monday", () => {
    const monday = new Date("2025-02-17T12:00:00Z");
    const result = getWeekStartDate(monday);
    expect(result.toISOString().slice(0, 10)).toBe("2025-02-17");
  });

  it("returns previous Monday for a Wednesday", () => {
    const wed = new Date("2025-02-19T12:00:00Z");
    const result = getWeekStartDate(wed);
    expect(result.toISOString().slice(0, 10)).toBe("2025-02-17");
  });

  it("returns previous Monday for Sunday", () => {
    const sun = new Date("2025-02-23T12:00:00Z");
    const result = getWeekStartDate(sun);
    expect(result.toISOString().slice(0, 10)).toBe("2025-02-17");
  });
});

describe("getAsOfDate", () => {
  it("returns previous Sunday 23:59 when given a Monday", () => {
    const monday = new Date("2025-02-17T10:00:00Z");
    const result = getAsOfDate(monday);
    expect(result.toISOString().slice(0, 10)).toBe("2025-02-16");
    expect(result.getUTCHours()).toBe(23);
    expect(result.getUTCMinutes()).toBe(59);
  });
});

describe("getCompletedWeeks", () => {
  it("returns weeks where weekStartDate <= asOfDate", () => {
    const projectStart = new Date("2025-02-03");
    const asOf = new Date("2025-02-16T23:59:59Z"); // Sunday
    const weeks = getCompletedWeeks(projectStart, null, asOf);
    // Completed: 2025-02-03, 2025-02-10 (current week 2025-02-17 is NOT included)
    expect(weeks.length).toBe(2);
    expect(weeks[0].toISOString().slice(0, 10)).toBe("2025-02-03");
    expect(weeks[1].toISOString().slice(0, 10)).toBe("2025-02-10");
  });

  it("respects project end date", () => {
    const projectStart = new Date("2025-02-03");
    const projectEnd = new Date("2025-02-14");
    const asOf = new Date("2025-02-23T23:59:59Z");
    const weeks = getCompletedWeeks(projectStart, projectEnd, asOf);
    expect(weeks.length).toBe(2); // 02-03, 02-10
  });
});

describe("getFutureWeeks", () => {
  it("returns weeks where weekStartDate > asOfDate", () => {
    const projectStart = new Date("2025-02-03");
    const asOf = new Date("2025-02-16T23:59:59Z");
    const weeks = getFutureWeeks(projectStart, null, asOf);
    expect(weeks.some((w) => w.toISOString().slice(0, 10) === "2025-02-17")).toBe(true);
  });
});

describe("isCompletedWeek", () => {
  it("returns true for week before as-of", () => {
    const weekStart = new Date("2025-02-10");
    const asOf = new Date("2025-02-16T23:59:59Z");
    expect(isCompletedWeek(weekStart, asOf)).toBe(true);
  });

  it("returns false for week after as-of", () => {
    const weekStart = new Date("2025-02-17");
    const asOf = new Date("2025-02-16T23:59:59Z");
    expect(isFutureWeek(weekStart, asOf)).toBe(true);
  });
});

describe("parseWeekHeader", () => {
  it("parses YYYY-MM-DD format", () => {
    const result = parseWeekHeader("2025-02-17");
    expect(result).not.toBeNull();
    expect(result!.toISOString().slice(0, 10)).toBe("2025-02-17");
  });

  it("parses YYYY/MM/DD format", () => {
    const result = parseWeekHeader("2025/02/17");
    expect(result).not.toBeNull();
  });

  it("returns null for non-date string", () => {
    expect(parseWeekHeader("Person")).toBeNull();
    expect(parseWeekHeader("Role")).toBeNull();
  });
});

describe("parseFloatWeekHeader", () => {
  it("parses Float Sunday header 15 Feb 2026 as Monday 2026-02-16", () => {
    const result = parseFloatWeekHeader("15 Feb 2026");
    expect(result).not.toBeNull();
    expect(formatWeekKey(result!)).toBe("2026-02-16");
  });

  it("parses Float Sunday header 22 Feb 2026 as Monday 2026-02-23", () => {
    const result = parseFloatWeekHeader("22 Feb 2026");
    expect(result).not.toBeNull();
    expect(formatWeekKey(result!)).toBe("2026-02-23");
  });

  it("returns null for non-date string", () => {
    expect(parseFloatWeekHeader("Person")).toBeNull();
    expect(parseFloatWeekHeader("Project")).toBeNull();
  });
});

describe("formatWeekKey", () => {
  it("formats date as YYYY-MM-DD", () => {
    const d = new Date("2025-02-17");
    expect(formatWeekKey(d)).toBe("2025-02-17");
  });
});
