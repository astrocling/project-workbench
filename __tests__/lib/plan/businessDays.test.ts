import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  addCalendarDays,
  calendarDayDelta,
  clampYmdRange,
  countBusinessDays,
  expandYmdRange,
  isWeekendYmd,
  shiftYmdRange,
} from "@/lib/plan/businessDays";

describe("addBusinessDays", () => {
  const noHolidays = new Set<string>();

  it("skips weekends when adding forward", () => {
    // 2025-02-21 is Friday
    expect(addBusinessDays("2025-02-21", 1, noHolidays)).toBe("2025-02-24");
  });

  it("skips weekends when adding backward", () => {
    // 2025-02-24 is Monday
    expect(addBusinessDays("2025-02-24", -1, noHolidays)).toBe("2025-02-21");
  });

  it("skips custom non-working days", () => {
    const nonWorking = new Set(["2025-02-18"]);
    // Tue 2025-02-18 is a holiday; +1 business day from Mon 2025-02-17 → Wed 2025-02-19
    expect(addBusinessDays("2025-02-17", 1, nonWorking)).toBe("2025-02-19");
  });

  it("returns same date when adding zero days", () => {
    expect(addBusinessDays("2025-02-17", 0, noHolidays)).toBe("2025-02-17");
  });
});

describe("countBusinessDays", () => {
  it("counts weekdays only in an inclusive range", () => {
    // Mon 2025-02-17 through Fri 2025-02-21 = 5 business days
    expect(countBusinessDays("2025-02-17", "2025-02-21", new Set())).toBe(5);
  });

  it("excludes weekends and holidays", () => {
    const nonWorking = new Set(["2025-02-18"]);
    expect(countBusinessDays("2025-02-17", "2025-02-21", nonWorking)).toBe(4);
  });
});

describe("isWeekendYmd", () => {
  it("identifies Saturday and Sunday", () => {
    expect(isWeekendYmd("2025-02-22")).toBe(true);
    expect(isWeekendYmd("2025-02-23")).toBe(true);
    expect(isWeekendYmd("2025-02-24")).toBe(false);
  });
});

describe("expandYmdRange", () => {
  it("returns inclusive UTC dates", () => {
    expect(expandYmdRange("2025-02-17", "2025-02-19")).toEqual([
      "2025-02-17",
      "2025-02-18",
      "2025-02-19",
    ]);
  });

  it("returns empty array when start is after end", () => {
    expect(expandYmdRange("2025-02-20", "2025-02-17")).toEqual([]);
  });
});

describe("addCalendarDays", () => {
  it("adds calendar days across month boundaries", () => {
    expect(addCalendarDays("2025-01-30", 3)).toBe("2025-02-02");
  });
});

describe("calendarDayDelta", () => {
  it("counts signed inclusive-exclusive calendar days between two dates", () => {
    expect(calendarDayDelta("2026-03-01", "2026-03-01")).toBe(0);
    expect(calendarDayDelta("2026-03-01", "2026-03-04")).toBe(3);
    expect(calendarDayDelta("2026-03-04", "2026-03-01")).toBe(-3);
  });
});

describe("shiftYmdRange", () => {
  it("moves start and end by the same calendar delta", () => {
    expect(shiftYmdRange("2026-03-01", "2026-03-05", 2)).toEqual({
      startDate: "2026-03-03",
      endDate: "2026-03-07",
    });
    expect(shiftYmdRange("2026-03-03", "2026-03-03", -1)).toEqual({
      startDate: "2026-03-02",
      endDate: "2026-03-02",
    });
  });
});

describe("clampYmdRange", () => {
  it("pins start to end when resizing the start past the end", () => {
    expect(clampYmdRange("2026-03-08", "2026-03-05", "start")).toEqual({
      startDate: "2026-03-05",
      endDate: "2026-03-05",
    });
  });

  it("pins end to start when resizing the end before the start", () => {
    expect(clampYmdRange("2026-03-05", "2026-03-01", "end")).toEqual({
      startDate: "2026-03-05",
      endDate: "2026-03-05",
    });
  });

  it("leaves a valid range unchanged", () => {
    expect(clampYmdRange("2026-03-01", "2026-03-05", "start")).toEqual({
      startDate: "2026-03-01",
      endDate: "2026-03-05",
    });
  });
});
