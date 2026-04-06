// Scheduled Float API → DB sync (Trigger.dev).
//
// Required environment variables (Trigger.dev project / dashboard):
// - DATABASE_URL — PostgreSQL URL (same as the Next.js app)
// - FLOAT_API_TOKEN — Float API v3 bearer token
// - FLOAT_API_USER_AGENT_EMAIL — optional; included in Float User-Agent string
//
// Schedules: `schedules.task` only supports one declarative `cron` per task. Two crons are
// registered as two scheduled tasks that share the same run implementation. Declarative crons
// sync when you run `npx trigger.dev@latest dev` or `deploy` (see Trigger.dev scheduled tasks docs).
// - Weekdays hourly Mon–Fri UTC: 0 * * * 1-5 → task id float-sync-weekday
// - Weekends every 6h Sat–Sun UTC: 0 */6 * * 0,6 → task id float-sync-weekend
//
// The previous single task id was `float-sync`; use either scheduled task above for manual tests.
//
// Cache: POST /api/admin/float-sync calls revalidateTag for project-resourcing tags; this task does not (no Next.js request context).

import type { ScheduledTaskPayload } from "@trigger.dev/core/v3";
import { logger, schedules } from "@trigger.dev/sdk/v3";

import { prisma } from "@/lib/prisma";
import { floatClientFromEnv } from "@/lib/float";
import { executeFloatApiSync } from "@/lib/float/syncFloatImport";
import { FloatApiError } from "@/lib/float/types";

async function runFloatSync(payload: ScheduledTaskPayload) {
  const startedAt = Date.now();
  logger.info("Float sync started", { triggeredAt: payload.timestamp });

  try {
    const client = floatClientFromEnv();
    const { run, unknownRoles } = await executeFloatApiSync(prisma, client, {
      uploadedByUserId: null,
    });

    const durationMs = Date.now() - startedAt;
    logger.info("Float sync completed", {
      durationMs,
      runId: run.id,
      unknownRolesCount: unknownRoles.length,
    });
  } catch (err) {
    if (err instanceof FloatApiError) {
      logger.error("Float sync failed (Float API error)", {
        status: err.status,
        message: err.message,
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Float sync failed", { error: message });
    }
    throw err;
  }
}

/** Hourly Mon–Fri UTC (`0 * * * 1-5`). Declarative schedule syncs on dev/deploy. */
export const floatSyncWeekdayTask = schedules.task({
  id: "float-sync-weekday",
  cron: "0 * * * 1-5",
  run: runFloatSync,
});

/** Every 6 hours Sat–Sun UTC (cron pattern uses step-6 in the hour field). Declarative schedule syncs on dev/deploy. */
export const floatSyncWeekendTask = schedules.task({
  id: "float-sync-weekend",
  cron: "0 */6 * * 0,6",
  run: runFloatSync,
});
