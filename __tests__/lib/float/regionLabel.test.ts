import { describe, it, expect } from "vitest";
import {
  buildFloatRegionNameMap,
  enrichHolidayRowsWithWorkbenchRegionLabel,
  floatRegionLabelFromHolidayRow,
  floatRegionLabelFromPersonRow,
  floatRegionNamesFromHolidayRows,
  floatRegionNamesFromPeopleRows,
  mergeFloatRegionNameMaps,
} from "@/lib/float/regionLabel";

describe("floatRegionLabelFromPersonRow", () => {
  it("reads region_name", () => {
    expect(
      floatRegionLabelFromPersonRow({ people_id: 1, region_name: "  Australia  " })
    ).toBe("Australia");
  });

  it("reads string region", () => {
    expect(floatRegionLabelFromPersonRow({ region: "EU" })).toBe("EU");
  });

  it("reads nested region.name", () => {
    expect(
      floatRegionLabelFromPersonRow({
        region: { name: "West" },
      })
    ).toBe("West");
  });

  it("reads nested region id + name when top-level region_id is absent (Float nests region)", () => {
    const row = {
      people_id: 1,
      region: { id: 42, name: "Test Region" },
    };
    expect(floatRegionLabelFromPersonRow(row)).toBe("Test Region");
    const m = floatRegionNamesFromPeopleRows([row]);
    expect(m.get(42)).toBe("Test Region");
  });

  it("returns null when absent", () => {
    expect(floatRegionLabelFromPersonRow({ region_id: 5 })).toBeNull();
  });
});

describe("floatRegionNamesFromHolidayRows", () => {
  it("maps region_id from rows to region_name", () => {
    const m = floatRegionNamesFromHolidayRows(
      [{ region_id: 7, region_name: "NZ", name: "Waitangi Day" }],
      [{ region_id: 8, region_name: "UK" }]
    );
    expect(m.get(7)).toBe("NZ");
    expect(m.get(8)).toBe("UK");
  });

  it("does not use holiday name as region label", () => {
    const m = floatRegionNamesFromHolidayRows(
      [{ region_id: 1, name: "Christmas", region_name: "US" }],
      []
    );
    expect(m.get(1)).toBe("US");
  });
});

describe("floatRegionLabelFromHolidayRow", () => {
  it("reads region_name", () => {
    expect(floatRegionLabelFromHolidayRow({ region_id: 1, region_name: "AU", name: "Day" })).toBe("AU");
  });

  it("returns null when only region_id is set", () => {
    expect(floatRegionLabelFromHolidayRow({ region_id: 9, name: "Boxing Day" })).toBeNull();
  });
});

describe("floatRegionNamesFromPeopleRows", () => {
  it("maps region_id from people rows when label is present", () => {
    const m = floatRegionNamesFromPeopleRows([
      { people_id: 1, region_id: 10, region_name: "Shared" },
      { people_id: 2, region_id: 10 },
    ]);
    expect(m.get(10)).toBe("Shared");
  });

  it("first row with a label wins for duplicate region_id", () => {
    const m = floatRegionNamesFromPeopleRows([
      { people_id: 1, region_id: 3, region_name: "First" },
      { people_id: 2, region_id: 3, region_name: "Second" },
    ]);
    expect(m.get(3)).toBe("First");
  });
});

describe("mergeFloatRegionNameMaps", () => {
  it("keeps earlier map entries when later maps have the same id", () => {
    const a = new Map<number, string>([[1, "fromHoliday"]]);
    const b = new Map<number, string>([[1, "fromPeople"]]);
    expect(mergeFloatRegionNameMaps(a, b).get(1)).toBe("fromHoliday");
  });

  it("fills gaps from later maps", () => {
    const a = new Map<number, string>([[1, "A"]]);
    const b = new Map<number, string>([[2, "B"]]);
    const m = mergeFloatRegionNameMaps(a, b);
    expect(m.get(1)).toBe("A");
    expect(m.get(2)).toBe("B");
  });
});

describe("buildFloatRegionNameMap", () => {
  it("merges holiday and people sources", () => {
    const m = buildFloatRegionNameMap(
      [{ region_id: 7, region_name: "NZ", name: "Waitangi" }],
      [],
      [{ people_id: 1, region_id: 8, region_name: "UK" }]
    );
    expect(m.get(7)).toBe("NZ");
    expect(m.get(8)).toBe("UK");
  });
});

describe("enrichHolidayRowsWithWorkbenchRegionLabel", () => {
  it("adds workbench_region_label when only region_id is present and map has a name", () => {
    const regionNameById = new Map<number, string>([[5, "Australia"]]);
    const out = enrichHolidayRowsWithWorkbenchRegionLabel(
      [{ region_id: 5, name: "Holiday" }],
      regionNameById
    );
    expect(out[0]!.workbench_region_label).toBe("Australia");
  });

  it("does not override existing region_name from Float", () => {
    const regionNameById = new Map<number, string>([[5, "MapName"]]);
    const out = enrichHolidayRowsWithWorkbenchRegionLabel(
      [{ region_id: 5, region_name: "FloatName", name: "Holiday" }],
      regionNameById
    );
    expect(out[0]!.workbench_region_label).toBeUndefined();
  });
});
