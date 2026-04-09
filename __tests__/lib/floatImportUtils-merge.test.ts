/**
 * mergeFloatHoursForProjectsFromRuns must match per-project getProjectDataFromAllImports float merge.
 */

import { describe, it, expect } from "vitest";
import {
  getProjectDataFromAllImports,
  mergeFloatHoursForProjectsFromRuns,
  type FloatImportRunWithDate,
} from "@/lib/floatImportUtils";

function floatListOnly(
  r: ReturnType<typeof getProjectDataFromAllImports>
): typeof r.floatList {
  return r.floatList;
}

describe("mergeFloatHoursForProjectsFromRuns", () => {
  const alpha: FloatImportRunWithDate = {
    completedAt: new Date("2024-01-01T12:00:00.000Z"),
    projectNames: ["Project X"],
    projectAssignments: {},
    projectFloatHours: {
      "Project X": [
        {
          personName: "Alice",
          roleName: "Dev",
          weeks: [{ weekStart: "2024-01-08", hours: 10 }],
        },
      ],
    },
  };

  const beta: FloatImportRunWithDate = {
    completedAt: new Date("2024-02-01T12:00:00.000Z"),
    projectNames: ["Project X"],
    projectAssignments: {},
    projectFloatHours: {
      "Project X": [
        {
          personName: "Alice",
          roleName: "Dev",
          weeks: [
            { weekStart: "2024-01-08", hours: 20 },
            { weekStart: "2024-01-15", hours: 5 },
          ],
        },
      ],
    },
  };

  it("matches getProjectDataFromAllImports per project (later run wins per week)", () => {
    const runs = [alpha, beta];
    const projects = [
      { id: "p1", name: "Project X" },
      { id: "p2", name: "Orphan" },
    ];
    const merged = mergeFloatHoursForProjectsFromRuns(runs, projects);

    expect(floatListOnly(getProjectDataFromAllImports(runs, "Project X"))).toEqual(
      merged.get("p1")
    );
    expect(floatListOnly(getProjectDataFromAllImports(runs, "Orphan"))).toEqual(
      merged.get("p2")
    );
  });

  it("matches when two DB projects share the same normalized name", () => {
    const runs = [alpha];
    const projects = [
      { id: "a", name: "Project X" },
      { id: "b", name: "project  x" },
    ];
    const merged = mergeFloatHoursForProjectsFromRuns(runs, projects);
    const expected = floatListOnly(getProjectDataFromAllImports(runs, "Project X"));
    expect(merged.get("a")).toEqual(expected);
    expect(merged.get("b")).toEqual(expected);
  });
});
