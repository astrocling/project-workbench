import { describe, expect, it } from "vitest";
import type { PlanPhaseJson } from "@/lib/plan/serialize";
import {
  buildLegacyTimeline,
  buildPlanTimelineCandidate,
  isValidPlanTimeline,
  resolveReportTimelineAxis,
  shouldBuildTimelineFromLegacy,
  shouldBuildTimelineFromPlan,
  shouldClipLockedTimelineToPreviousMonths,
  shouldUseLockedTimeline,
} from "@/lib/statusReportScheduleBuild";
import { timelineHasVisibleSchedule } from "@/lib/plan/reportSchedule";
import { resolveScheduleSource, type StatusReportSnapshot } from "@/lib/statusReportPdfData";

const baseSnapshot: StatusReportSnapshot = {
  period: "Jan 1 – Jan 5, 2026",
  today: "Jan 6, 2026",
};

const axis = { startDate: "2026-01-01", endDate: "2026-12-31" };

function phase(name: string, items: PlanPhaseJson["items"]): PlanPhaseJson {
  return {
    id: `phase-${name}`,
    planId: "plan-1",
    name,
    color: "#1941FA",
    order: 0,
    items,
  };
}

describe("statusReportScheduleBuild", () => {
  describe("source selection", () => {
    it("uses locked timeline when snapshot has timeline and rebuild is false", () => {
      expect(
        shouldUseLockedTimeline({ ...baseSnapshot, timeline: { ...axis, bars: [], markers: [] } })
      ).toBe(true);
      expect(shouldBuildTimelineFromPlan("plan", true)).toBe(false);
      expect(shouldBuildTimelineFromLegacy("timeline", true)).toBe(false);
    });

    it("chooses Plan mapping when source is plan and timeline is not locked", () => {
      expect(shouldBuildTimelineFromPlan("plan", false)).toBe(true);
      expect(shouldBuildTimelineFromLegacy("plan", false)).toBe(false);
    });

    it("chooses legacy bars/markers when source is timeline and timeline is not locked", () => {
      expect(shouldBuildTimelineFromLegacy("timeline", false)).toBe(true);
      expect(shouldBuildTimelineFromPlan("timeline", false)).toBe(false);
    });

    it("defaults resolveScheduleSource to timeline for fresh snapshots", () => {
      expect(resolveScheduleSource(null)).toBe("timeline");
      expect(resolveScheduleSource(baseSnapshot)).toBe("timeline");
    });
  });

  describe("Plan timeline assembly", () => {
    it("accepts point-only phases as marker-only timelines", () => {
      const timeline = buildPlanTimelineCandidate(
        [
          phase("Launch", [
            {
              id: "m1",
              phaseId: "phase-Launch",
              type: "milestone",
              label: "Go live",
              startDate: "2026-06-01",
              endDate: "2026-06-01",
              order: 0,
              parentItemId: null,
              meetingStatus: null,
              scheduledTime: null,
            },
          ]),
        ],
        "phases_and_key_dates",
        axis
      );
      expect(timeline).toBeDefined();
      expect(timeline?.bars).toEqual([]);
      expect(timeline?.markers).toHaveLength(1);
      expect(isValidPlanTimeline(timeline)).toBe(true);
    });

    it("rejects phases-only point-only phases", () => {
      const timeline = buildPlanTimelineCandidate(
        [
          phase("Launch", [
            {
              id: "m1",
              phaseId: "phase-Launch",
              type: "milestone",
              label: "Go live",
              startDate: "2026-06-01",
              endDate: "2026-06-01",
              order: 0,
              parentItemId: null,
              meetingStatus: null,
              scheduledTime: null,
            },
          ]),
        ],
        "phases",
        axis
      );
      expect(timeline).toBeUndefined();
      expect(isValidPlanTimeline(timeline)).toBe(false);
    });
  });

  describe("legacy timeline assembly", () => {
    it("builds legacy timeline without visible-schedule validation", () => {
      const timeline = buildLegacyTimeline([], [], axis);
      expect(timeline).toEqual({ ...axis, bars: [], markers: [] });
      expect(isValidPlanTimeline(timeline)).toBe(false);
    });

    it("supports marker-only legacy snapshots for render gates", () => {
      const timeline = buildLegacyTimeline(
        [],
        [{ label: "Cutover", date: "2026-04-01", shape: "Pin", rowIndex: 2 }],
        axis
      );
      // The renderers gate on the same helper, so a marker-only legacy snapshot still draws.
      expect(timelineHasVisibleSchedule(timeline)).toBe(true);
    });
  });

  describe("resolveReportTimelineAxis", () => {
    const projectStart = "2026-03-02";
    const projectEnd = "2026-08-31";
    const reportDate = new Date("2026-09-08T00:00:00.000Z");

    it("clips Timeline-source axis to previous months before the report date", () => {
      expect(
        resolveReportTimelineAxis({
          scheduleSource: "timeline",
          projectStartYmd: projectStart,
          projectEndYmd: projectEnd,
          reportDate,
          previousMonths: 1,
        })
      ).toEqual({ startDate: "2026-08-01", endDate: projectEnd });
    });

    it("keeps the full project range for Plan-source so earlier phases stay visible", () => {
      expect(
        resolveReportTimelineAxis({
          scheduleSource: "plan",
          projectStartYmd: projectStart,
          projectEndYmd: projectEnd,
          reportDate,
          previousMonths: 1,
        })
      ).toEqual({ startDate: projectStart, endDate: projectEnd });
    });

    it("makes a Plan with only early-phase work valid on a late report date", () => {
      const phases: PlanPhaseJson[] = [
        phase("Discovery", [
          {
            id: "t1",
            phaseId: "phase-Discovery",
            type: "task",
            label: "Workshop Prep",
            startDate: "2026-03-02",
            endDate: "2026-04-02",
            order: 0,
            parentItemId: null,
            meetingStatus: null,
            scheduledTime: null,
          },
        ]),
      ];
      const clipped = resolveReportTimelineAxis({
        scheduleSource: "timeline",
        projectStartYmd: projectStart,
        projectEndYmd: projectEnd,
        reportDate,
        previousMonths: 1,
      });
      const full = resolveReportTimelineAxis({
        scheduleSource: "plan",
        projectStartYmd: projectStart,
        projectEndYmd: projectEnd,
        reportDate,
        previousMonths: 1,
      });
      expect(isValidPlanTimeline(buildPlanTimelineCandidate(phases, "phases", clipped))).toBe(
        false
      );
      expect(isValidPlanTimeline(buildPlanTimelineCandidate(phases, "phases", full))).toBe(true);
    });
  });

  describe("shouldClipLockedTimelineToPreviousMonths", () => {
    it("clips locked Timeline snapshots and leaves Plan snapshots on their stored axis", () => {
      expect(shouldClipLockedTimelineToPreviousMonths("timeline")).toBe(true);
      expect(shouldClipLockedTimelineToPreviousMonths("plan")).toBe(false);
    });
  });
});
