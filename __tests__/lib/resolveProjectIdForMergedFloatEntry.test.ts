/**
 * Unit tests: Workbench project resolution for merged Float rows (duplicate Float project names).
 * Run: npm run test -- __tests__/lib/resolveProjectIdForMergedFloatEntry.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  resolveProjectIdForMergedFloatEntry,
  type MergedFloatEntry,
} from "@/lib/floatImportApply";

describe("resolveProjectIdForMergedFloatEntry", () => {
  const projectsByName = new Map([["sny.tv 2026 cda", "wb-1"]]);
  const projectsForResolution = [
    { id: "wb-1", name: "SNY.TV 2026 CDA", floatExternalId: "100" as string | null },
    { id: "wb-2", name: "Other", floatExternalId: null },
  ];

  const baseEntry = (): MergedFloatEntry => ({
    projectName: "SNY.TV 2026 CDA",
    personName: "Igor",
    roleName: "Dev",
    weekMap: new Map([["2026-04-06", 7.5]]),
  });

  it("matches by floatExternalId when floatProjectId is set", () => {
    const id = resolveProjectIdForMergedFloatEntry(
      { ...baseEntry(), floatProjectId: 100 },
      projectsByName,
      projectsForResolution
    );
    expect(id).toBe("wb-1");
  });

  it("does not match Workbench project linked to a different Float id (duplicate name in Float)", () => {
    const id = resolveProjectIdForMergedFloatEntry(
      { ...baseEntry(), floatProjectId: 200 },
      projectsByName,
      projectsForResolution
    );
    expect(id).toBeUndefined();
  });

  it("falls back to projectsByName when projectsForResolution is omitted", () => {
    const id = resolveProjectIdForMergedFloatEntry(
      { ...baseEntry(), floatProjectId: 100 },
      projectsByName,
      undefined
    );
    expect(id).toBe("wb-1");
  });
});
