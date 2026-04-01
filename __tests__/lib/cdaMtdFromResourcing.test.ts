import { describe, it, expect } from "vitest";
import {
  computeMtdByMonthKey,
  buildCdaRowsForProject,
  roundToQuarter,
} from "@/lib/cdaMtdFromResourcing";

describe("roundToQuarter", () => {
  it("rounds to nearest quarter hour", () => {
    expect(roundToQuarter(1.13)).toBe(1.25);
    expect(roundToQuarter(10)).toBe(10);
  });
});

describe("computeMtdByMonthKey", () => {
  it("sums split rows by month and single-month actual hours", () => {
    const mondayFeb = new Date("2025-02-17T00:00:00.000Z");
    const map = computeMtdByMonthKey(
      [
        {
          personId: "a",
          weekStartDate: new Date("2024-12-30T00:00:00.000Z"),
          monthKey: "2024-12",
          hours: 11.5,
        },
        {
          personId: "a",
          weekStartDate: new Date("2024-12-30T00:00:00.000Z"),
          monthKey: "2025-01",
          hours: 28.5,
        },
      ],
      [
        {
          personId: "b",
          weekStartDate: mondayFeb,
          hours: 40,
        },
      ]
    );
    expect(map.get("2024-12")).toBe(11.5);
    expect(map.get("2025-01")).toBe(28.5);
    expect(map.get("2025-02")).toBe(40);
  });

  it("skips ActualHours when splits exist for same person-week", () => {
    const week = new Date("2024-12-30T00:00:00.000Z");
    const map = computeMtdByMonthKey(
      [
        {
          personId: "a",
          weekStartDate: week,
          monthKey: "2024-12",
          hours: 10,
        },
        {
          personId: "a",
          weekStartDate: week,
          monthKey: "2025-01",
          hours: 30,
        },
      ],
      [
        {
          personId: "a",
          weekStartDate: week,
          hours: 999,
        },
      ]
    );
    expect(map.get("2024-12")).toBe(10);
    expect(map.get("2025-01")).toBe(30);
  });
});

describe("buildCdaRowsForProject", () => {
  it("uses planned from cdaMonths and mtd from resourcing only", () => {
    const rows = buildCdaRowsForProject({
      startDate: new Date("2025-02-01T00:00:00.000Z"),
      endDate: new Date("2025-02-28T00:00:00.000Z"),
      cdaMonths: [
        { monthKey: "2025-02", planned: 100 },
      ],
      actualHours: [
        {
          personId: "p",
          weekStartDate: new Date("2025-02-17T00:00:00.000Z"),
          hours: 12.3,
        },
      ],
      actualHoursMonthSplits: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].planned).toBe(100);
    expect(rows[0].mtdActuals).toBe(roundToQuarter(12.3));
  });
});
