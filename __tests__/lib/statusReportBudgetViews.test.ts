import { describe, expect, it } from "vitest";
import {
  budgetDollarsBurnPercent,
  budgetHoursBurnPercent,
} from "@/lib/statusReportBudgetViews";

const sampleBudget = {
  estBudgetHigh: 100000,
  estBudgetLow: 80000,
  spentDollars: 25000,
  remainingDollarsHigh: 75000,
  remainingDollarsLow: 55000,
  budgetedHoursHigh: 1200,
  budgetedHoursLow: 900,
  actualHours: 410,
  remainingHoursHigh: 790,
  remainingHoursLow: 490,
  burnPercentHigh: 25,
};

describe("budgetHoursBurnPercent", () => {
  it("is actualHours / budgetedHoursHigh (410/1200 → ~34)", () => {
    expect(budgetHoursBurnPercent(sampleBudget)).toBeCloseTo(34.1667, 2);
  });

  it("returns null when budgeted hours are zero", () => {
    expect(
      budgetHoursBurnPercent({ ...sampleBudget, budgetedHoursHigh: 0, actualHours: 10 })
    ).toBeNull();
  });

  it("clamps over-budget hours to 100", () => {
    expect(
      budgetHoursBurnPercent({
        ...sampleBudget,
        budgetedHoursHigh: 100,
        actualHours: 150,
      })
    ).toBe(100);
  });

  it("clamps negative hours to 0", () => {
    expect(
      budgetHoursBurnPercent({
        ...sampleBudget,
        budgetedHoursHigh: 100,
        actualHours: -10,
      })
    ).toBe(0);
  });
});

describe("budgetDollarsBurnPercent", () => {
  it("passes through burnPercentHigh", () => {
    expect(budgetDollarsBurnPercent(sampleBudget)).toBe(25);
  });

  it("passes through null burnPercentHigh", () => {
    expect(budgetDollarsBurnPercent({ ...sampleBudget, burnPercentHigh: null })).toBeNull();
  });
});
