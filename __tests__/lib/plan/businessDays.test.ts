import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  addCalendarDays,
  countBusinessDays,
  expandYmdRange,
  isWeekendYmd,
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
