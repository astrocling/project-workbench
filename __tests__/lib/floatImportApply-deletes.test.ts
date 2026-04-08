/**
 * Unit coverage for tuple-based FloatScheduledHours deletes (used by applyFloatImportDatabaseEffects).
 * Run: npm run test -- __tests__/lib/floatImportApply-deletes.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteFutureFloatScheduledHoursForPairs } from "@/lib/floatImportApply";
import type { PrismaClient } from "@prisma/client";

describe("deleteFutureFloatScheduledHoursForPairs", () => {
  const asOf = new Date("2025-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("no-ops when pairs is empty", async () => {
    const executeRaw = vi.fn();
    const prisma = { $executeRaw: executeRaw } as unknown as PrismaClient;
    await deleteFutureFloatScheduledHoursForPairs(prisma, asOf, []);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("dedupes identical project/person keys into one DELETE", async () => {
    const executeRaw = vi.fn().mockResolvedValue(undefined);
    const prisma = { $executeRaw: executeRaw } as unknown as PrismaClient;
    await deleteFutureFloatScheduledHoursForPairs(prisma, asOf, [
      { projectId: "p1", personId: "a" },
      { projectId: "p1", personId: "a" },
      { projectId: "p1", personId: "b" },
    ]);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
