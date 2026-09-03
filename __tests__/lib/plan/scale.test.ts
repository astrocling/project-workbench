import { describe, expect, it } from "vitest";
import { getPlanAxisRange, getScaleColumns } from "@/lib/plan/scale";

describe("getPlanAxisRange", () => {
  it("uses the plan dates when there are no phases or items", () => {
    expect(
      getPlanAxisRange({
        kickoffDate: "2026-03-01",
        endDate: "2026-03-31",
        phases: [],
      })
    ).toEqual({ startYmd: "2026-03-01", endYmd: "2026-03-31" });
  });

  it("expands across every phase and item", () => {
    expect(
      getPlanAxisRange({
        kickoffDate: "2026-03-01",
        endDate: "2026-03-31",
        phases: [
          {
            items: [
              { startDate: "2026-02-20", endDate: "2026-03-05" },
              { startDate: "2026-03-25", endDate: "2026-04-10" },
            ],
          },
          {
            items: [
              { startDate: "2026-02-25", endDate: "2026-04-05" },
            ],
          },
        ],
      })
    ).toEqual({ startYmd: "2026-02-20", endYmd: "2026-04-10" });
  });

  it("preserves a single-day plan", () => {
    expect(
      getPlanAxisRange({
        kickoffDate: "2026-03-12",
        endDate: "2026-03-12",
        phases: [{ items: [] }],
      })
    ).toEqual({ startYmd: "2026-03-12", endYmd: "2026-03-12" });
  });

  it("normalizes reversed plan dates", () => {
    expect(
      getPlanAxisRange({
        kickoffDate: "2026-03-31",
        endDate: "2026-03-01",
        phases: [],
      })
    ).toEqual({ startYmd: "2026-03-01", endYmd: "2026-03-31" });
  });

  it("guards against reversed item dates", () => {
    expect(
      getPlanAxisRange({
        kickoffDate: "2026-03-10",
        endDate: "2026-03-20",
        phases: [
          {
            items: [
              { startDate: "2026-04-05", endDate: "2026-02-25" },
            ],
          },
        ],
      })
    ).toEqual({ startYmd: "2026-02-25", endYmd: "2026-04-05" });
  });
});

describe("getScaleColumns", () => {
  it("supports an explicitly forced scale", () => {
    const columns = getScaleColumns("2026-01-01", "2026-01-31", "month");
    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({
      startYmd: "2026-01-01",
      endYmd: "2026-01-31",
    });
  });
});
