import { describe, expect, it } from "vitest";
import {
  formatPlanDurationLabel,
  formatPlanPrintDate,
  formatPlanPrintRange,
  phaseItemDateRange,
  printGanttColWidth,
} from "@/lib/plan/printLayout";

describe("formatPlanPrintDate", () => {
  it("formats a UTC date like the sample plan PDF", () => {
    expect(formatPlanPrintDate("2026-08-31")).toBe("Mon, Aug 31");
    expect(formatPlanPrintDate("2026-11-10")).toBe("Tue, Nov 10");
  });
});

describe("formatPlanPrintRange", () => {
  it("uses a single long date when start and end are the same", () => {
    expect(formatPlanPrintRange("2026-08-31", "2026-08-31")).toBe("Mon, Aug 31");
  });

  it("uses a short month-day span for ranges", () => {
    expect(formatPlanPrintRange("2026-08-31", "2026-09-04")).toBe("Aug 31 – Sep 4");
  });
});

describe("formatPlanDurationLabel", () => {
  it("uses weeks when the plan is longer than two weeks", () => {
    expect(formatPlanDurationLabel(72)).toBe("10.5 weeks");
  });

  it("uses days for short plans", () => {
    expect(formatPlanDurationLabel(5)).toBe("5 days");
    expect(formatPlanDurationLabel(1)).toBe("1 day");
  });
});

describe("printGanttColWidth", () => {
  it("always fills the print pane so the axis fits one page", () => {
    expect(printGanttColWidth(720, 80)).toBe(9);
    expect(printGanttColWidth(720, 10)).toBe(72);
  });
});

describe("phaseItemDateRange", () => {
  it("unions item dates", () => {
    expect(
      phaseItemDateRange([
        { startDate: "2026-09-02", endDate: "2026-09-04" },
        { startDate: "2026-08-31", endDate: "2026-09-01" },
      ])
    ).toEqual({ start: "2026-08-31", end: "2026-09-04" });
  });
});
