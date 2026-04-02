import { describe, expect, it } from "vitest";
import {
  buildExcludedUtcDatesByFloatPeopleId,
  expandInclusiveUtcRangeToYmds,
  filterHolidayRowsOverlappingYmdWindow,
  holidayRangeYmdFromRow,
} from "@/lib/float/excludedDays";

describe("buildExcludedUtcDatesByFloatPeopleId", () => {
  it("adds time off days per people_id only", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 10, region_id: 1 }],
      timeOffs: [
        { people_id: 10, start_date: "2024-06-03", end_date: "2024-06-04" },
      ],
      publicHolidays: [],
      teamHolidays: [],
    });
    expect(map.get(10)?.has("2024-06-03")).toBe(true);
    expect(map.get(10)?.has("2024-06-04")).toBe(true);
    expect(map.get(99)?.size ?? 0).toBe(0);
  });

  it("applies public/team holidays only when person region matches holiday region", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [
        { people_id: 1, region_id: 5 },
        { people_id: 2, region_id: 9 },
        { people_id: 3, region_id: null },
      ],
      timeOffs: [],
      publicHolidays: [
        { region_id: 5, start_date: "2024-01-02", end_date: "2024-01-02", name: "PH" },
      ],
      teamHolidays: [{ region_id: 9, start_date: "2024-01-03", end_date: "2024-01-03", name: "TH" }],
    });
    expect(map.get(1)?.has("2024-01-02")).toBe(true);
    expect(map.get(2)?.has("2024-01-02")).toBe(false);
    expect(map.get(2)?.has("2024-01-03")).toBe(true);
    expect(map.has(3)).toBe(false);
  });

  it("ignores holidays without region_id", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 1, region_id: 5 }],
      timeOffs: [],
      publicHolidays: [{ start_date: "2024-01-02", end_date: "2024-01-02" }],
      teamHolidays: [],
    });
    expect(map.get(1)?.size ?? 0).toBe(0);
  });
});

describe("expandInclusiveUtcRangeToYmds", () => {
  it("returns inclusive UTC days", () => {
    expect(expandInclusiveUtcRangeToYmds("2024-01-01", "2024-01-03")).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ]);
  });
});

describe("filterHolidayRowsOverlappingYmdWindow", () => {
  it("keeps rows that overlap the window", () => {
    const rows = [
      { date: "2025-06-01", name: "A" },
      { date: "2020-01-01", end_date: "2020-01-02", name: "Old" },
    ];
    expect(filterHolidayRowsOverlappingYmdWindow(rows, "2025-01-01", "2025-12-31")).toEqual([rows[0]]);
  });
});

describe("holidayRangeYmdFromRow", () => {
  it("reads start/end or single date", () => {
    expect(holidayRangeYmdFromRow({ start_date: "2024-01-01", end_date: "2024-01-02" })).toEqual({
      start: "2024-01-01",
      end: "2024-01-02",
    });
    expect(holidayRangeYmdFromRow({ date: "2024-07-04" })).toEqual({
      start: "2024-07-04",
      end: "2024-07-04",
    });
  });
});
