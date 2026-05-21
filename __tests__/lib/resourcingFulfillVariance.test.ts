import { describe, expect, it } from "vitest";
import {
  computeResourcingFulfillVariance,
  formatWeekChangeSummary,
  parseRequestedPeoplePayload,
  snapshotMapFromHoursSnapshot,
  weekVarianceStats,
} from "@/lib/resourcingFulfillVariance";
import type { NormalizedSnapshotPerson } from "@/lib/resourcingFulfillVariance";

function person(
  overrides: Partial<NormalizedSnapshotPerson> & Pick<NormalizedSnapshotPerson, "personId" | "name" | "requested">
): NormalizedSnapshotPerson {
  return {
    hoursSnapshot: [],
    plannedSnapshot: [],
    ...overrides,
  };
}

function mapFor(personId: string, weeks: Record<string, number>): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>();
  m.set(personId, new Map(Object.entries(weeks)));
  return m;
}

describe("parseRequestedPeoplePayload", () => {
  it("parses wrapped payload with window keys", () => {
    const result = parseRequestedPeoplePayload({
      snapshotStartKey: "2026-05-12",
      snapshotEndKey: "2026-08-04",
      people: [
        {
          personId: "p1",
          name: "Alice",
          requested: true,
          hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 8 }],
        },
      ],
    });
    expect(result.snapshotStartKey).toBe("2026-05-12");
    expect(result.snapshotEndKey).toBe("2026-08-04");
    expect(result.people).toHaveLength(1);
  });

  it("parses legacy bare array", () => {
    const result = parseRequestedPeoplePayload([
      { personId: "p1", name: "Bob", requested: false, hoursSnapshot: [] },
    ]);
    expect(result.snapshotStartKey).toBeNull();
    expect(result.people[0]?.plannedSnapshot).toEqual([]);
  });
});

describe("formatWeekChangeSummary", () => {
  it("lists only differing weeks", () => {
    const snap = snapshotMapFromHoursSnapshot([
      { weekStartDate: "2026-05-12", hours: 8 },
      { weekStartDate: "2026-05-19", hours: 8 },
    ]);
    const cur = snapshotMapFromHoursSnapshot([
      { weekStartDate: "2026-05-12", hours: 16 },
      { weekStartDate: "2026-05-19", hours: 8 },
    ]);
    expect(formatWeekChangeSummary(snap, cur)).toBe("2026-05-12: 8h → 16h");
  });
});

describe("computeResourcingFulfillVariance", () => {
  it("Ready: Float matches Planned → no variance", () => {
    const people = [
      person({
        personId: "p1",
        name: "Alice",
        requested: true,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 8 }],
      }),
    ];
    const floatCur = mapFor("p1", { "2026-05-12": 16 });
    const plannedCur = mapFor("p1", { "2026-05-12": 16 });
    const result = computeResourcingFulfillVariance(people, floatCur, plannedCur);
    expect(result.hasVariance).toBe(false);
  });

  it("Ready: Float != Planned, no Float movement → notFilled", () => {
    const people = [
      person({
        personId: "p1",
        name: "Alice",
        requested: true,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 8 }],
      }),
    ];
    const floatCur = mapFor("p1", { "2026-05-12": 8 });
    const plannedCur = mapFor("p1", { "2026-05-12": 16 });
    const result = computeResourcingFulfillVariance(people, floatCur, plannedCur);
    expect(result.hasVariance).toBe(true);
    expect(result.notFilled).toEqual(["Alice"]);
    expect(result.partiallyFilled).toEqual([]);
  });

  it("Ready: partial vs Planned → partiallyFilled", () => {
    const people = [
      person({
        personId: "p1",
        name: "Alice",
        requested: true,
        hoursSnapshot: [
          { weekStartDate: "2026-05-12", hours: 8 },
          { weekStartDate: "2026-05-19", hours: 8 },
        ],
      }),
    ];
    const floatCur = mapFor("p1", { "2026-05-12": 16, "2026-05-19": 8 });
    const plannedCur = mapFor("p1", { "2026-05-12": 16, "2026-05-19": 16 });
    const result = computeResourcingFulfillVariance(people, floatCur, plannedCur);
    expect(result.hasVariance).toBe(true);
    expect(result.partiallyFilled).toEqual(["Alice"]);
  });

  it("Non-Ready: Float != Planned but Float unchanged from snapshot → no variance", () => {
    const people = [
      person({
        personId: "p2",
        name: "Bob",
        requested: false,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 32 }],
      }),
    ];
    const floatCur = mapFor("p2", { "2026-05-12": 32 });
    const plannedCur = mapFor("p2", { "2026-05-12": 8 });
    const result = computeResourcingFulfillVariance(people, floatCur, plannedCur);
    expect(result.hasVariance).toBe(false);
  });

  it("Non-Ready: Float changed after sync → unexpectedFloatChanges", () => {
    const people = [
      person({
        personId: "p2",
        name: "Bob",
        requested: false,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 8 }],
      }),
    ];
    const floatCur = mapFor("p2", { "2026-05-12": 20 });
    const plannedCur = mapFor("p2", { "2026-05-12": 8 });
    const result = computeResourcingFulfillVariance(people, floatCur, plannedCur);
    expect(result.hasVariance).toBe(true);
    expect(result.unexpectedFloatChanges).toHaveLength(1);
    expect(result.unexpectedFloatChanges[0]?.name).toBe("Bob");
    expect(result.unexpectedFloatChanges[0]?.summary).toContain("8h → 20h");
  });

  it("Non-Ready: Planned changed but Float unchanged → no variance", () => {
    const people = [
      person({
        personId: "p2",
        name: "Bob",
        requested: false,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 8 }],
      }),
    ];
    const floatCur = mapFor("p2", { "2026-05-12": 8 });
    const plannedCur = mapFor("p2", { "2026-05-12": 20 });
    const result = computeResourcingFulfillVariance(people, floatCur, plannedCur);
    expect(result.hasVariance).toBe(false);
  });

  it("Combined: Ready OK + non-Ready Float drift from snapshot → variance", () => {
    const people = [
      person({
        personId: "p1",
        name: "Alice",
        requested: true,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 8 }],
      }),
      person({
        personId: "p2",
        name: "Bob",
        requested: false,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 8 }],
      }),
    ];
    const floatCur = new Map([
      ["p1", new Map([["2026-05-12", 16]])],
      ["p2", new Map([["2026-05-12", 40]])],
    ]);
    const plannedCur = new Map([
      ["p1", new Map([["2026-05-12", 16]])],
      ["p2", new Map([["2026-05-12", 8]])],
    ]);
    const result = computeResourcingFulfillVariance(people, floatCur, plannedCur);
    expect(result.hasVariance).toBe(true);
    expect(result.unexpectedFloatChanges).toHaveLength(1);
    expect(result.unexpectedFloatChanges[0]?.name).toBe("Bob");
  });

  it("Combined: Ready OK + non-Ready Float unchanged → no variance", () => {
    const people = [
      person({
        personId: "p1",
        name: "Alice",
        requested: true,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 8 }],
      }),
      person({
        personId: "p2",
        name: "Bob",
        requested: false,
        hoursSnapshot: [{ weekStartDate: "2026-05-12", hours: 40 }],
      }),
    ];
    const floatCur = new Map([
      ["p1", new Map([["2026-05-12", 16]])],
      ["p2", new Map([["2026-05-12", 40]])],
    ]);
    const plannedCur = new Map([
      ["p1", new Map([["2026-05-12", 16]])],
      ["p2", new Map([["2026-05-12", 8]])],
    ]);
    const result = computeResourcingFulfillVariance(people, floatCur, plannedCur);
    expect(result.hasVariance).toBe(false);
  });
});

describe("weekVarianceStats", () => {
  it("treats missing weeks as zero", () => {
    const a = snapshotMapFromHoursSnapshot([{ weekStartDate: "2026-05-12", hours: 8 }]);
    const b = new Map<string, number>();
    expect(weekVarianceStats(a, b).equal).toBe(false);
  });
});
