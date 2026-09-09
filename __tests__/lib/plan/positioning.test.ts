import { describe, expect, it } from "vitest";
import {
  applyGanttDrag,
  positionPercent,
  todayMarkerPercent,
  widthPercent,
  ymdAtClientX,
  ymdAtPercent,
} from "@/lib/plan/positioning";

const start = "2026-03-01";
const end = "2026-03-10";

describe("ymdAtPercent", () => {
  it("maps 0 to the axis start and 100 to the axis end", () => {
    expect(ymdAtPercent(0, start, end)).toBe(start);
    expect(ymdAtPercent(100, start, end)).toBe(end);
  });

  it("inverts positionPercent for dates on the axis", () => {
    for (const ymd of ["2026-03-01", "2026-03-05", "2026-03-10"]) {
      const pct = positionPercent(ymd, start, end);
      expect(ymdAtPercent(pct, start, end)).toBe(ymd);
    }
  });

  it("clamps outside 0–100", () => {
    expect(ymdAtPercent(-20, start, end)).toBe(start);
    expect(ymdAtPercent(140, start, end)).toBe(end);
  });
});

describe("ymdAtClientX", () => {
  it("maps the left edge of the axis to the start date", () => {
    expect(ymdAtClientX(100, 100, 400, start, end)).toBe(start);
  });

  it("maps the right edge of the axis to the end date", () => {
    expect(ymdAtClientX(500, 100, 400, start, end)).toBe(end);
  });
});

describe("todayMarkerPercent", () => {
  it("returns the axis percent when today falls on the plan", () => {
    expect(todayMarkerPercent("2026-03-05", start, end)).toBe(
      positionPercent("2026-03-05", start, end)
    );
  });

  it("clamps to the axis edges when today is outside the plan", () => {
    expect(todayMarkerPercent("2026-02-28", start, end)).toBe(0);
    expect(todayMarkerPercent("2026-03-11", start, end)).toBe(100);
  });
});

describe("widthPercent", () => {
  it("is positive for a single-day range", () => {
    expect(widthPercent(start, start, start, end)).toBeGreaterThan(0);
  });
});

describe("applyGanttDrag", () => {
  it("moves a range by the pointer day delta", () => {
    expect(
      applyGanttDrag({
        kind: "move",
        originStart: "2026-03-02",
        originEnd: "2026-03-04",
        originYmd: "2026-03-03",
        currentYmd: "2026-03-06",
        point: false,
      })
    ).toEqual({ startDate: "2026-03-05", endDate: "2026-03-07" });
  });

  it("moves a point item as a single day", () => {
    expect(
      applyGanttDrag({
        kind: "move",
        originStart: "2026-03-02",
        originEnd: "2026-03-02",
        originYmd: "2026-03-02",
        currentYmd: "2026-03-08",
        point: true,
      })
    ).toEqual({ startDate: "2026-03-08", endDate: "2026-03-08" });
  });

  it("resizes start and end with a one-day minimum", () => {
    expect(
      applyGanttDrag({
        kind: "resize-start",
        originStart: "2026-03-02",
        originEnd: "2026-03-06",
        originYmd: "2026-03-02",
        currentYmd: "2026-03-04",
        point: false,
      })
    ).toEqual({ startDate: "2026-03-04", endDate: "2026-03-06" });
    expect(
      applyGanttDrag({
        kind: "resize-end",
        originStart: "2026-03-02",
        originEnd: "2026-03-06",
        originYmd: "2026-03-06",
        currentYmd: "2026-03-01",
        point: false,
      })
    ).toEqual({ startDate: "2026-03-02", endDate: "2026-03-02" });
  });
});
