import { describe, expect, it } from "vitest";
import {
  buildWeeklyLookaheadBlocks,
  collectWeeklyPeople,
  dateKeyInWeek,
  formatDatedItemLine,
  formatPersonLine,
  formatWeekRangeLabel,
  getWeekBounds,
  itemsStartingOrEndingInWeek,
  utcDateKey,
} from "@/lib/slack/weeklyLookahead";

describe("weeklyLookahead week bounds", () => {
  it("uses Monday–Sunday UTC for a Wednesday", () => {
    const bounds = getWeekBounds(new Date("2026-09-09T15:00:00.000Z"));
    expect(bounds.weekStartKey).toBe("2026-09-07");
    expect(bounds.weekEndKey).toBe("2026-09-13");
  });

  it("treats Sunday as the end of the prior Monday week", () => {
    const bounds = getWeekBounds(new Date("2026-09-13T12:00:00.000Z"));
    expect(bounds.weekStartKey).toBe("2026-09-07");
    expect(bounds.weekEndKey).toBe("2026-09-13");
  });

  it("dateKeyInWeek includes start and end", () => {
    expect(dateKeyInWeek("2026-09-07", "2026-09-07", "2026-09-13")).toBe(true);
    expect(dateKeyInWeek("2026-09-13", "2026-09-07", "2026-09-13")).toBe(true);
    expect(dateKeyInWeek("2026-09-06", "2026-09-07", "2026-09-13")).toBe(false);
    expect(dateKeyInWeek("2026-09-14", "2026-09-07", "2026-09-13")).toBe(false);
  });

  it("utcDateKey uses ISO date prefix", () => {
    expect(utcDateKey(new Date("2026-09-09T00:00:00.000Z"))).toBe("2026-09-09");
    expect(utcDateKey("2026-09-09")).toBe("2026-09-09");
  });
});

describe("collectWeeklyPeople", () => {
  const people = {
    a: { name: "Ada", slackUserId: "UADA", roleName: "PM" },
    b: { name: "Ben", slackUserId: null, roleName: "Designer" },
    c: { name: "Cara", slackUserId: null, roleName: "Dev" },
  };

  it("unions planned and float hours and flags Not in Plan", () => {
    const result = collectWeeklyPeople({
      planned: [{ personId: "a", hours: 8 }],
      float: [
        { personId: "a", hours: 8 },
        { personId: "b", hours: 16 },
      ],
      people,
    });
    expect(result.map((p) => p.personId)).toEqual(["a", "b"]);
    expect(result.find((p) => p.personId === "a")?.notInPlan).toBe(false);
    expect(result.find((p) => p.personId === "b")?.notInPlan).toBe(true);
  });

  it("excludes people with only zero hours", () => {
    const result = collectWeeklyPeople({
      planned: [{ personId: "c", hours: 0 }],
      float: [],
      people,
    });
    expect(result).toEqual([]);
  });

  it("formats Slack mention and Not in Plan suffix", () => {
    const [ada, ben] = collectWeeklyPeople({
      planned: [{ personId: "a", hours: 4 }],
      float: [{ personId: "b", hours: 4 }],
      people,
    });
    expect(formatPersonLine(ada!)).toBe("• <@UADA> — PM");
    expect(formatPersonLine(ben!)).toBe("• Ben (Not in Plan) — Designer");
  });
});

describe("itemsStartingOrEndingInWeek", () => {
  const weekStart = "2026-09-07";
  const weekEnd = "2026-09-13";

  it("includes start-only and end-only, excludes spanning bars", () => {
    const hits = itemsStartingOrEndingInWeek(
      [
        {
          source: "plan",
          type: "meeting",
          label: "Kickoff",
          startDateKey: "2026-09-08",
          endDateKey: "2026-09-08",
          scheduledTime: "10:00",
        },
        {
          source: "plan",
          type: "hard_deadline",
          label: "UAT",
          startDateKey: "2026-08-01",
          endDateKey: "2026-09-11",
        },
        {
          source: "timeline",
          type: "bar",
          label: "Long phase",
          startDateKey: "2026-08-01",
          endDateKey: "2026-10-01",
        },
      ],
      weekStart,
      weekEnd
    );
    expect(hits.map((h) => h.label)).toEqual(["Kickoff", "UAT"]);
    expect(hits[0]?.sortKey).toBe("2026-09-08");
    expect(hits[1]?.sortKey).toBe("2026-09-11");
  });

  it("uses start as sort key when both start and end fall in the week", () => {
    const hits = itemsStartingOrEndingInWeek(
      [
        {
          source: "timeline",
          type: "bar",
          label: "Sprint",
          startDateKey: "2026-09-07",
          endDateKey: "2026-09-11",
        },
      ],
      weekStart,
      weekEnd
    );
    expect(hits[0]?.sortKey).toBe("2026-09-07");
  });
});

describe("formatDatedItemLine and blocks", () => {
  it("labels Plan types and Timeline source", () => {
    expect(
      formatDatedItemLine({
        source: "plan",
        type: "meeting",
        label: "Kickoff",
        startDateKey: "2026-09-08",
        endDateKey: "2026-09-08",
        scheduledTime: "10:00",
        sortKey: "2026-09-08",
      })
    ).toBe("• Tue Sep 8 — Meeting: Kickoff (10:00)");
    expect(
      formatDatedItemLine({
        source: "timeline",
        type: "marker",
        label: "Launch",
        startDateKey: "2026-09-11",
        endDateKey: "2026-09-11",
        sortKey: "2026-09-11",
      })
    ).toBe("• Fri Sep 11 — Timeline: Launch");
  });

  it("formats week range across months", () => {
    expect(formatWeekRangeLabel("2026-09-28", "2026-10-04")).toBe(
      "Sep 28–Oct 4, 2026"
    );
  });

  it("builds empty-state Slack blocks", () => {
    const { blocks, fallbackText } = buildWeeklyLookaheadBlocks({
      projectName: "Acme",
      projectSlug: "acme",
      weekStartKey: "2026-09-07",
      weekEndKey: "2026-09-13",
      people: [],
      items: [],
      poster: { slackUserId: "U1", firstName: "Pat", lastName: "Lee" },
    });
    expect(fallbackText).toBe("Weekly look-ahead — Acme");
    const texts = JSON.stringify(blocks);
    expect(texts).toContain("No one has hours this week");
    expect(texts).toContain("No meetings or deadlines this week");
    expect(texts).toContain("tab=overview");
    expect(texts).toContain("<@U1>");
  });
});
