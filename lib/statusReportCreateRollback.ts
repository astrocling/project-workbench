export const PLAN_CREATE_ROLLBACK_FAILED_ERROR =
  "Failed to clean up the status report after a Plan schedule error. Contact support.";

export const PLAN_CREATE_BUILD_FAILED_ERROR =
  "Failed to build the status report snapshot. The report was not saved.";

export type RollbackCreatedReportResult =
  | { ok: true }
  | { ok: false; error: unknown };

/** Attempt to delete a report row created before a Plan schedule validation failure. */
export async function rollbackCreatedStatusReport(
  deleteReport: (reportId: string) => Promise<void>,
  reportId: string
): Promise<RollbackCreatedReportResult> {
  try {
    await deleteReport(reportId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
