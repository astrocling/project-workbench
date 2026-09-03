import { describe, expect, it, vi } from "vitest";
import {
  PLAN_CREATE_ROLLBACK_FAILED_ERROR,
  rollbackCreatedStatusReport,
} from "@/lib/statusReportCreateRollback";

describe("rollbackCreatedStatusReport", () => {
  it("returns ok when delete succeeds", async () => {
    const deleteReport = vi.fn().mockResolvedValue(undefined);
    const result = await rollbackCreatedStatusReport(deleteReport, "report-1");
    expect(result).toEqual({ ok: true });
    expect(deleteReport).toHaveBeenCalledWith("report-1");
  });

  it("returns failure when delete throws", async () => {
    const error = new Error("db locked");
    const deleteReport = vi.fn().mockRejectedValue(error);
    const result = await rollbackCreatedStatusReport(deleteReport, "report-2");
    expect(result).toEqual({ ok: false, error });
  });

  it("exposes a stable rollback failure message for routes", () => {
    expect(PLAN_CREATE_ROLLBACK_FAILED_ERROR).toContain("Failed to clean up");
  });
});
