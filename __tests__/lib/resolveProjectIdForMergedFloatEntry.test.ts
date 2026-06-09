/**
 * Unit tests: Workbench project resolution for merged Float rows (duplicate Float project names).
 * Run: npm run test -- __tests__/lib/resolveProjectIdForMergedFloatEntry.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  resolveFloatImportTargetProjectIds,
  resolveProjectIdForMergedFloatEntry,
  type MergedFloatEntry,
} from "@/lib/floatImportApply";
import { normalizeProjectNameForLookup } from "@/lib/floatImportUtils";

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

  it("matches by floatExternalId when floatProjectId is set and names agree", () => {
    const id = resolveProjectIdForMergedFloatEntry(
      { ...baseEntry(), floatProjectId: 100 },
      projectsByName,
      projectsForResolution
    );
    expect(id).toBe("wb-1");
  });

  it("does not route hours via floatExternalId when Workbench name disagrees with Float row", () => {
    const resolution = [
      { id: "wb-wrong", name: "Other Client Project", floatExternalId: "200" },
      { id: "wb-1", name: "SNY.TV 2026 CDA", floatExternalId: "100" as string | null },
    ];
    const id = resolveProjectIdForMergedFloatEntry(
      { ...baseEntry(), floatProjectId: 200 },
      projectsByName,
      resolution
    );
    expect(id).toBeUndefined();
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

  it("prefers floatExternalId link when Workbench was renamed but Float name matches", () => {
    const resolution = [
      {
        id: "wb-linked",
        name: "Stanford OHS SPCS 2025 2026",
        floatExternalId: "10381784",
      },
      {
        id: "wb-duplicate",
        name: "Stanford OHS/SPCS 2025/2026",
        floatExternalId: null,
      },
    ];
    const id = resolveProjectIdForMergedFloatEntry(
      {
        ...baseEntry(),
        projectName: "Stanford OHS/SPCS 2025/2026",
        floatProjectId: 10381784,
      },
      new Map(),
      resolution
    );
    expect(id).toBe("wb-linked");
  });

  it("prefers linked project over duplicate when both names match Float", () => {
    const resolution = [
      { id: "wb-duplicate", name: "Stanford OHS/SPCS 2025/2026", floatExternalId: null },
      { id: "wb-linked", name: "Stanford OHS/SPCS 2025/2026", floatExternalId: "10381784" },
    ];
    const id = resolveProjectIdForMergedFloatEntry(
      {
        ...baseEntry(),
        projectName: "Stanford OHS/SPCS 2025/2026",
        floatProjectId: 10381784,
      },
      new Map(),
      resolution
    );
    expect(id).toBe("wb-linked");
  });
});

describe("normalizeProjectNameForLookup", () => {
  it("treats slashes like other punctuation separators", () => {
    expect(normalizeProjectNameForLookup("Stanford OHS/SPCS 2025/2026")).toBe(
      normalizeProjectNameForLookup("Stanford OHS-SPCS 2025-2026")
    );
  });
});

describe("resolveFloatImportTargetProjectIds", () => {
  const entry: MergedFloatEntry = {
    projectName: "Stanford OHS/SPCS 2025/2026",
    personName: "Alex",
    roleName: "Dev",
    weekMap: new Map([["2026-06-15", 8]]),
    floatProjectId: 10381784,
  };

  it("mirrors to unlinked duplicate-name sibling projects", () => {
    const projectsByName = new Map([
      ["stanford ohs/spcs 2025/2026", "wb-duplicate"],
    ]);
    const projectsForResolution = [
      { id: "wb-linked", name: "Stanford OHS/SPCS 2025/2026", floatExternalId: "10381784" },
      { id: "wb-duplicate", name: "Stanford OHS/SPCS 2025/2026", floatExternalId: null },
    ];
    expect(
      resolveFloatImportTargetProjectIds(entry, projectsByName, projectsForResolution)
    ).toEqual(["wb-linked", "wb-duplicate"]);
  });

  it("does not mirror to siblings with a different floatExternalId", () => {
    const projectsForResolution = [
      { id: "wb-linked", name: "Stanford OHS/SPCS 2025/2026", floatExternalId: "10381784" },
      { id: "wb-other", name: "Stanford OHS/SPCS 2025/2026", floatExternalId: "99999" },
    ];
    expect(
      resolveFloatImportTargetProjectIds(
        entry,
        new Map([["stanford ohs/spcs 2025/2026", "wb-linked"]]),
        projectsForResolution
      )
    ).toEqual(["wb-linked"]);
  });
});
