import { describe, expect, it } from "vitest";
import {
  ganttBarLabelTextColor,
  ganttMarkFillColor,
} from "@/lib/plan/ganttBarLabel";

describe("ganttBarLabelTextColor", () => {
  it("uses white on dark phase blues", () => {
    expect(ganttBarLabelTextColor("#1941fa")).toBe("#ffffff");
    expect(ganttBarLabelTextColor("#040966")).toBe("#ffffff");
  });

  it("uses dark text on light fills", () => {
    expect(ganttBarLabelTextColor("#fde68a")).toBe("#0f172a");
    expect(ganttBarLabelTextColor("#ffffff")).toBe("#0f172a");
  });
});

describe("ganttMarkFillColor", () => {
  it("uses meeting violet for meetings", () => {
    expect(ganttMarkFillColor("#1941fa", true)).toBe("#6d28d9");
  });

  it("uses the phase color otherwise", () => {
    expect(ganttMarkFillColor("#15803d", false)).toBe("#15803d");
  });
});
