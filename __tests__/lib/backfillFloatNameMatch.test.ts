import { describe, it, expect } from "vitest";
import {
  extractYearTokensFromProjectName,
  projectNamesHaveDistinctYearRanges,
  scoreCloseFloatProjectNames,
  suggestCloseFloatProjectNames,
} from "@/lib/backfillFloatFromImports";
import { resolveProjectIdForMergedFloatEntry } from "@/lib/floatImportApply";

describe("Float backfill name matching", () => {
  const available = [
    "Northeast Bank CDA 2025-2026",
    "Leidos CDA 2025-26",
    "MDxHealth CDA 2025-2026",
    "UFC - CDA 2025 - 2026",
  ];

  it("treats Northeast Bank 2025-2026 and 2026-2027 as distinct projects", () => {
    const workbenchName = "Northeast Bank CDA 2026-2027";
    expect(projectNamesHaveDistinctYearRanges(workbenchName, "Northeast Bank CDA 2025-2026")).toBe(
      true
    );
    expect(extractYearTokensFromProjectName(workbenchName)).toEqual(new Set(["2026", "2027"]));
    expect(suggestCloseFloatProjectNames(workbenchName, available)).toEqual([]);
  });

  it("still matches formatting variants of the same project", () => {
    const availableSame = ["Northeast Bank CDA 2026 - 2027", "Other Project"];
    expect(suggestCloseFloatProjectNames("Northeast Bank CDA 2026-2027", availableSame)[0]).toBe(
      "Northeast Bank CDA 2026 - 2027"
    );
  });

  it("does not cross-suggest sibling year ranges", () => {
    expect(scoreCloseFloatProjectNames("Northeast Bank CDA 2026-2027", available)).toEqual([]);
  });

  it("resolves sibling Float projects independently by name", () => {
    const projectsForResolution = [
      { id: "wb-2526", name: "Northeast Bank CDA 2025-2026", floatExternalId: "100" },
      { id: "wb-2627", name: "Northeast Bank CDA 2026-2027", floatExternalId: null },
    ];
    const entry2526 = {
      projectName: "Northeast Bank CDA 2025-2026",
      personName: "Alex",
      roleName: "Dev",
      weekMap: new Map([["2026-06-01", 8]]),
      floatProjectId: 100,
    };
    const entry2627 = {
      projectName: "Northeast Bank CDA 2026-2027",
      personName: "Alex",
      roleName: "Dev",
      weekMap: new Map([["2026-06-01", 4]]),
      floatProjectId: 200,
    };
    const byName = new Map([
      ["northeast bank cda 2025-2026", "wb-2526"],
      ["northeast bank cda 2026-2027", "wb-2627"],
    ]);
    expect(
      resolveProjectIdForMergedFloatEntry(entry2526, byName, projectsForResolution)
    ).toBe("wb-2526");
    expect(
      resolveProjectIdForMergedFloatEntry(entry2627, byName, projectsForResolution)
    ).toBe("wb-2627");
  });
});
