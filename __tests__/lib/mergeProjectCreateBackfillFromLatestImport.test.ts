import { describe, it, expect, vi } from "vitest";
import { mergeProjectCreateBackfillFromLatestImport } from "@/lib/backfillFloatFromImports";

describe("mergeProjectCreateBackfillFromLatestImport", () => {
  const latestRun = {
    completedAt: new Date("2026-08-13T15:14:22.923Z"),
    projectNames: ["Yakima Chief Hops - GCRM Implementation"],
    projectAssignments: {
      "Yakima Chief Hops - GCRM Implementation": [
        { personName: "Yukari Dinnall", roleName: "Project Manager" },
      ],
    },
    projectFloatHours: {
      "Yakima Chief Hops - GCRM Implementation": [
        {
          personName: "Yukari Dinnall",
          roleName: "Project Manager",
          weeks: [
            { weekStart: "2026-08-10", hours: 16 },
            { weekStart: "2026-08-17", hours: 20 },
          ],
        },
      ],
    },
  };

  it("reads only the newest FloatImportRun and returns its hours", async () => {
    const findFirst = vi.fn().mockResolvedValue(latestRun);
    const findMany = vi.fn();
    const prisma = {
      floatImportRun: { findFirst, findMany },
    };

    const result = await mergeProjectCreateBackfillFromLatestImport(
      prisma as never,
      "Yakima Chief Hops - GCRM Implementation"
    );

    expect(findMany).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0]![0]).toMatchObject({
      orderBy: { completedAt: "desc" },
    });
    expect(result.matchedKey).toBe("Yakima Chief Hops - GCRM Implementation");
    expect(result.assignmentsList).toEqual([
      { personName: "Yukari Dinnall", roleName: "Project Manager" },
    ]);
    expect(result.floatList).toEqual([
      {
        personName: "Yukari Dinnall",
        roleName: "",
        weeks: [
          { weekStart: "2026-08-10", hours: 16 },
          { weekStart: "2026-08-17", hours: 20 },
        ],
      },
    ]);
  });

  it("returns empty lists when no import run exists", async () => {
    const prisma = {
      floatImportRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(),
      },
    };

    const result = await mergeProjectCreateBackfillFromLatestImport(
      prisma as never,
      "Yakima Chief Hops - GCRM Implementation"
    );

    expect(result.assignmentsList).toEqual([]);
    expect(result.floatList).toEqual([]);
    expect(result.matchedKey).toBeNull();
    expect(prisma.floatImportRun.findMany).not.toHaveBeenCalled();
  });
});
