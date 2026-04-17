import { describe, expect, it } from "vitest";
import {
  aggregateTasksToWeeklyHours,
  dedupeFloatTasksForAggregation,
  expandRepeatedTasks,
  weeklyHoursCompositeKey,
  weeklyHoursMapToRows,
} from "@/lib/float/taskAggregation";
import type { FloatTaskJson } from "@/lib/float/taskAggregation";
import { formatWeekKey, getWeekStartDate } from "@/lib/weekUtils";
import tasksExportSample from "./fixtures/tasks-export-sample.json";

describe("aggregateTasksToWeeklyHours", () => {
  it("treats hours as per-day over inclusive start_date..end_date (Float docs)", () => {
    const tasks = tasksExportSample as FloatTaskJson[];
    const map = aggregateTasksToWeeklyHours(tasks);

    const monday20220103 = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2022, 0, 1))));
    expect(monday20220103).toBe("2021-12-27");

    expect(map.get(weeklyHoursCompositeKey(101161, 54540, monday20220103))).toBe(2);

    const monday20210111 = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2021, 0, 12))));
    expect(monday20210111).toBe("2021-01-11");
    expect(map.get(weeklyHoursCompositeKey(101161, 46680, monday20210111))).toBe(12);
  });

  it("clips to aggregation window (UTC calendar days)", () => {
    const tasks: FloatTaskJson[] = [
      {
        project_id: 1,
        people_id: 10,
        start_date: "2022-01-01",
        end_date: "2022-01-31",
        hours: 1,
      },
    ];
    const map = aggregateTasksToWeeklyHours(tasks, {
      window: {
        start: new Date(Date.UTC(2022, 0, 10)),
        end: new Date(Date.UTC(2022, 0, 15)),
      },
    });
    let sum = 0;
    for (const v of map.values()) sum += v;
    expect(sum).toBe(6);
  });

  it("splits hours across Monday UTC weeks when the range spans two weeks", () => {
    const tasks: FloatTaskJson[] = [
      {
        project_id: 99,
        people_id: 7,
        start_date: "2023-06-28",
        end_date: "2023-07-04",
        hours: 2,
      },
    ];
    const map = aggregateTasksToWeeklyHours(tasks);
    const w1 = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2023, 5, 28))));
    const w2 = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2023, 6, 4))));
    expect(w1).toBe("2023-06-26");
    expect(w2).toBe("2023-07-03");
    expect(map.get(weeklyHoursCompositeKey(99, 7, w1))).toBe(2 * 5);
    expect(map.get(weeklyHoursCompositeKey(99, 7, w2))).toBe(2 * 2);
  });

  it("merges multiple tasks for same project, person, and week", () => {
    const tasks: FloatTaskJson[] = [
      {
        project_id: 5,
        people_id: 3,
        start_date: "2024-03-04",
        end_date: "2024-03-05",
        hours: 4,
      },
      {
        project_id: 5,
        people_id: 3,
        start_date: "2024-03-06",
        end_date: "2024-03-06",
        hours: 2,
      },
    ];
    const map = aggregateTasksToWeeklyHours(tasks);
    const wk = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2024, 2, 4))));
    expect(map.get(weeklyHoursCompositeKey(5, 3, wk))).toBe(4 * 2 + 2);
  });

  it("applies full per-day hours to each people_ids entry", () => {
    const tasks: FloatTaskJson[] = [
      {
        project_id: 8,
        people_ids: [100, 200],
        start_date: "2025-02-10",
        end_date: "2025-02-11",
        hours: 3,
      },
    ];
    const map = aggregateTasksToWeeklyHours(tasks);
    const wk = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2025, 1, 10))));
    expect(map.get(weeklyHoursCompositeKey(8, 100, wk))).toBe(6);
    expect(map.get(weeklyHoursCompositeKey(8, 200, wk))).toBe(6);
  });

  it("skips tasks without project or people", () => {
    expect(aggregateTasksToWeeklyHours([{ hours: 1, start_date: "2020-01-01", end_date: "2020-01-01" }])).toEqual(
      new Map()
    );
    expect(
      aggregateTasksToWeeklyHours([
        { project_id: 1, start_date: "2020-01-01", end_date: "2020-01-01", hours: 1 },
      ])
    ).toEqual(new Map());
  });

  it("dedupeFloatTasksForAggregation keeps last row per task_id", () => {
    const tasks: FloatTaskJson[] = [
      {
        task_id: 42,
        project_id: 5,
        people_id: 3,
        start_date: "2024-03-04",
        end_date: "2024-03-05",
        hours: 4,
      },
      {
        task_id: 42,
        project_id: 5,
        people_id: 3,
        start_date: "2024-03-04",
        end_date: "2024-03-05",
        hours: 4,
      },
    ];
    expect(dedupeFloatTasksForAggregation(tasks)).toHaveLength(1);
    const wk = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2024, 2, 4))));
    const expected = 4 * 2;
    expect(aggregateTasksToWeeklyHours(tasks).get(weeklyHoursCompositeKey(5, 3, wk))).toBe(expected);
    expect(
      aggregateTasksToWeeklyHours(dedupeFloatTasksForAggregation(tasks)).get(
        weeklyHoursCompositeKey(5, 3, wk)
      )
    ).toBe(expected);
  });

  it("uses max hours per UTC day when tasks overlap (same project, person, day)", () => {
    const tasks: FloatTaskJson[] = [
      {
        project_id: 5,
        people_id: 3,
        start_date: "2024-03-04",
        end_date: "2024-03-05",
        hours: 4,
      },
      {
        project_id: 5,
        people_id: 3,
        start_date: "2024-03-04",
        end_date: "2024-03-05",
        hours: 2,
      },
    ];
    const wk = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2024, 2, 4))));
    expect(aggregateTasksToWeeklyHours(tasks).get(weeklyHoursCompositeKey(5, 3, wk))).toBe(4 * 2);
  });

  it("weeklyHoursMapToRows returns sorted rows", () => {
    const map = new Map<string, number>();
    map.set(weeklyHoursCompositeKey(2, 1, "2024-01-01"), 5);
    map.set(weeklyHoursCompositeKey(1, 1, "2024-01-01"), 3);
    const rows = weeklyHoursMapToRows(map);
    expect(rows[0]?.floatProjectId).toBe(1);
    expect(rows[1]?.floatProjectId).toBe(2);
  });

  it("weekdaysOnly: 2h × 5 UTC weekdays = 10 vs 2h × 7 calendar days = 14 (regression)", () => {
    const tasks: FloatTaskJson[] = [
      {
        project_id: 1,
        people_id: 99,
        start_date: "2024-03-04",
        end_date: "2024-03-10",
        hours: 2,
      },
    ];
    const wk = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2024, 2, 4))));
    expect(wk).toBe("2024-03-04");

    const allDays = aggregateTasksToWeeklyHours(tasks);
    expect(allDays.get(weeklyHoursCompositeKey(1, 99, wk))).toBe(14);

    const weekdays = aggregateTasksToWeeklyHours(tasks, { weekdaysOnly: true });
    expect(weekdays.get(weeklyHoursCompositeKey(1, 99, wk))).toBe(10);
  });

  it("excludedUtcDatesByFloatPeopleId: skips only matching person-days (regional / time off)", () => {
    const tasks: FloatTaskJson[] = [
      {
        project_id: 1,
        people_id: 1,
        start_date: "2024-03-04",
        end_date: "2024-03-08",
        hours: 2,
      },
      {
        project_id: 1,
        people_id: 2,
        start_date: "2024-03-04",
        end_date: "2024-03-08",
        hours: 2,
      },
    ];
    const wk = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2024, 2, 4))));
    const excluded = new Map<number, Set<string>>();
    excluded.set(1, new Set(["2024-03-05"]));
    const map = aggregateTasksToWeeklyHours(tasks, {
      weekdaysOnly: true,
      excludedUtcDatesByFloatPeopleId: excluded,
    });
    expect(map.get(weeklyHoursCompositeKey(1, 1, wk))).toBe(2 * 4);
    expect(map.get(weeklyHoursCompositeKey(1, 2, wk))).toBe(2 * 5);
  });

  it("excludedUtcDatesByFloatPeopleId: absent map matches old behavior", () => {
    const tasks: FloatTaskJson[] = [
      {
        project_id: 1,
        people_id: 1,
        start_date: "2024-03-04",
        end_date: "2024-03-08",
        hours: 2,
      },
    ];
    const wk = formatWeekKey(getWeekStartDate(new Date(Date.UTC(2024, 2, 4))));
    expect(
      aggregateTasksToWeeklyHours(tasks, { weekdaysOnly: true }).get(weeklyHoursCompositeKey(1, 1, wk))
    ).toBe(10);
  });

  /**
   * Regression: Float `/v3/tasks` returns only the source occurrence for a repeating
   * allocation. Without expansion, a weekly 1h task (3/5 → 7/10) only logged 1 week of
   * hours in the Float Actuals grid. See debug session d9e2b6.
   */
  it("expands weekly repeating tasks up to repeat_end_date", () => {
    const source: FloatTaskJson = {
      task_id: 1,
      project_id: 10,
      people_id: 100,
      start_date: "2026-03-05",
      end_date: "2026-03-05",
      hours: 1,
      repeat_state: 1,
      repeat_end_date: "2026-07-10",
    };
    const expanded = expandRepeatedTasks([source]);
    expect(expanded).toHaveLength(19);
    expect(expanded[0].start_date).toBe("2026-03-05");
    expect(expanded[expanded.length - 1].start_date).toBe("2026-07-09");
    for (const occ of expanded) {
      expect(occ.repeat_state).toBe(0);
      expect(occ.repeat_end_date).toBeNull();
    }

    const map = aggregateTasksToWeeklyHours([source], { weekdaysOnly: true });
    expect(map.size).toBe(19);
    for (const v of map.values()) expect(v).toBe(1);
    expect(
      map.get(weeklyHoursCompositeKey(10, 100, "2026-04-13"))
    ).toBe(1);
    expect(
      map.get(weeklyHoursCompositeKey(10, 100, "2026-07-06"))
    ).toBe(1);
  });

  it("expands bi-weekly repeating tasks and preserves day-range duration", () => {
    const expanded = expandRepeatedTasks([
      {
        task_id: 2,
        project_id: 10,
        people_id: 100,
        start_date: "2026-03-02",
        end_date: "2026-03-04",
        hours: 2,
        repeat_state: 2,
        repeat_end_date: "2026-04-30",
      },
    ]);
    expect(expanded.map((t) => t.start_date)).toEqual([
      "2026-03-02",
      "2026-03-16",
      "2026-03-30",
      "2026-04-13",
      "2026-04-27",
    ]);
    expect(expanded.map((t) => t.end_date)).toEqual([
      "2026-03-04",
      "2026-03-18",
      "2026-04-01",
      "2026-04-15",
      "2026-04-29",
    ]);
  });

  it("expands monthly repeating tasks on same day-of-month", () => {
    const expanded = expandRepeatedTasks([
      {
        task_id: 3,
        project_id: 10,
        people_id: 100,
        start_date: "2026-03-15",
        end_date: "2026-03-15",
        hours: 4,
        repeat_state: 3,
        repeat_end_date: "2026-06-16",
      },
    ]);
    expect(expanded.map((t) => t.start_date)).toEqual([
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
      "2026-06-15",
    ]);
  });

  it("leaves non-repeating tasks untouched", () => {
    const source: FloatTaskJson = {
      task_id: 4,
      project_id: 10,
      people_id: 100,
      start_date: "2026-03-05",
      end_date: "2026-03-09",
      hours: 1,
      repeat_state: 0,
      repeat_end_date: null,
    };
    expect(expandRepeatedTasks([source])).toEqual([source]);
  });

  it("leaves repeating tasks without repeat_end_date untouched", () => {
    const source: FloatTaskJson = {
      task_id: 5,
      project_id: 10,
      people_id: 100,
      start_date: "2026-03-05",
      end_date: "2026-03-05",
      hours: 1,
      repeat_state: 1,
      repeat_end_date: null,
    };
    expect(expandRepeatedTasks([source])).toEqual([source]);
  });
});
