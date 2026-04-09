import { describe, expect, it } from "vitest";
import {
  allUtcYmdsFromHolidayRow,
  buildExcludedUtcDatesByFloatPeopleId,
  expandInclusiveUtcRangeToYmds,
  filterHolidayRowsOverlappingYmdWindow,
  holidayRangeYmdFromRow,
  regionIdFromHolidayRow,
  regionIdFromPersonRow,
} from "@/lib/float/excludedDays";

describe("buildExcludedUtcDatesByFloatPeopleId", () => {
  it("adds time off days per people_id", () => {
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

  it("adds time off days from people_ids when people_id is absent (Float API)", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 10, region_id: 1 }],
      timeOffs: [
        { people_ids: [10], start_date: "2024-06-03", end_date: "2024-06-03" },
      ],
      publicHolidays: [],
      teamHolidays: [],
    });
    expect(map.get(10)?.has("2024-06-03")).toBe(true);
  });

  it("adds time off for a single day when only start_date is present", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 10, region_id: 1 }],
      timeOffs: [{ people_id: 10, start_date: "2024-06-03" }],
      publicHolidays: [],
      teamHolidays: [],
    });
    expect(map.get(10)?.has("2024-06-03")).toBe(true);
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

  it("applies public holiday when only start_date is set (no end_date)", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 1, region_id: 5 }],
      timeOffs: [],
      publicHolidays: [{ region_id: 5, start_date: "2024-01-02", name: "PH" }],
      teamHolidays: [],
    });
    expect(map.get(1)?.has("2024-01-02")).toBe(true);
  });

  it("applies public holiday when Float uses top-level dates array (v3 public-holidays shape)", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 1, region_id: 5 }],
      timeOffs: [],
      publicHolidays: [
        {
          region_id: 5,
          name: "PH",
          dates: ["2024-01-02", "2024-01-03"],
        },
      ],
      teamHolidays: [],
    });
    expect(map.get(1)?.has("2024-01-02")).toBe(true);
    expect(map.get(1)?.has("2024-01-03")).toBe(true);
  });

  it("matches holiday region when person only has nested region.id (no top-level region_id)", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 1, region: { id: 5, name: "AU" } }],
      timeOffs: [],
      publicHolidays: [
        { region_id: 5, start_date: "2024-01-02", end_date: "2024-01-02", name: "PH" },
      ],
      teamHolidays: [],
    });
    expect(map.get(1)?.has("2024-01-02")).toBe(true);
  });

  it("matches public holiday when holiday uses nested region.id (no top-level region_id)", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 1, region: { id: 5, name: "AU" } }],
      timeOffs: [],
      publicHolidays: [
        {
          region: { id: 5, name: "AU" },
          start_date: "2024-01-02",
          end_date: "2024-01-02",
          name: "PH",
        },
      ],
      teamHolidays: [],
    });
    expect(map.get(1)?.has("2024-01-02")).toBe(true);
  });

  it("matches team holiday when holiday uses nested region.id", () => {
    const map = buildExcludedUtcDatesByFloatPeopleId({
      floatPeople: [{ people_id: 1, region_id: 5 }],
      timeOffs: [],
      publicHolidays: [],
      teamHolidays: [
        {
          region: { id: 5, name: "AU" },
          start_date: "2024-01-03",
          end_date: "2024-01-03",
          name: "TH",
        },
      ],
    });
    expect(map.get(1)?.has("2024-01-03")).toBe(true);
  });
});

describe("regionIdFromPersonRow", () => {
  it("reads top-level region_id", () => {
    expect(regionIdFromPersonRow({ region_id: 7 })).toBe(7);
  });

  it("reads nested region.id when top-level is absent", () => {
    expect(regionIdFromPersonRow({ region: { id: 9, name: "NZ" } })).toBe(9);
  });
});

describe("regionIdFromHolidayRow", () => {
  it("reads top-level region_id", () => {
    expect(regionIdFromHolidayRow({ region_id: 7 })).toBe(7);
  });

  it("reads nested region.id when top-level is absent", () => {
    expect(regionIdFromHolidayRow({ region: { id: 9, name: "NZ" } })).toBe(9);
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

  it("treats start_date without end_date as a single day (Float public-holidays shape)", () => {
    expect(holidayRangeYmdFromRow({ start_date: "2024-07-04", region_id: 1 })).toEqual({
      start: "2024-07-04",
      end: "2024-07-04",
    });
  });

  it("parses ISO datetime start_date to UTC YYYY-MM-DD", () => {
    expect(
      holidayRangeYmdFromRow({ start_date: "2024-07-04T14:00:00.000Z", region_id: 1 })
    ).toEqual({
      start: "2024-07-04",
      end: "2024-07-04",
    });
  });
});

describe("allUtcYmdsFromHolidayRow", () => {
  it("expands inclusive range from start/end", () => {
    expect(allUtcYmdsFromHolidayRow({ start_date: "2024-01-01", end_date: "2024-01-03" })).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ]);
  });

  it("uses dates array when present (deduped, sorted)", () => {
    expect(
      allUtcYmdsFromHolidayRow({
        dates: ["2024-01-03", "2024-01-02", "2024-01-02"],
      })
    ).toEqual(["2024-01-02", "2024-01-03"]);
  });
});
