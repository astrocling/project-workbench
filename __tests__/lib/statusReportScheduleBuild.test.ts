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
import { TIMELINE_FILL_ROW_MAX, timelineHasVisibleSchedule } from "@/lib/plan/reportSchedule";
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

    it("places Modular compact phases on their own rows", () => {
      const phases: PlanPhaseJson[] = [
        {
          id: "phase-deploy",
          planId: "plan-1",
          name: "Deployment",
          color: "#1941FA",
          order: 4,
          items: [
            {
              id: "t1",
              phaseId: "phase-deploy",
              type: "task",
              label: "Ship",
              startDate: "2026-03-01",
              endDate: "2026-03-10",
              order: 0,
              parentItemId: null,
              meetingStatus: null,
              scheduledTime: null,
            },
          ],
        },
      ];
      const wrapped = buildPlanTimelineCandidate(phases, "phases", axis);
      expect(wrapped?.bars[0]?.rowIndex).toBe(1);
      expect(wrapped?.bars[0]?.label).toBe("Deployment");

      const stacked = buildPlanTimelineCandidate(phases, "phases", axis, {
        lanePolicy: "onePhasePerRow",
      });
      expect(stacked?.bars[0]?.rowIndex).toBe(5);
      expect(stacked?.bars[0]?.label).toBe("Deployment");
      expect(isValidPlanTimeline(stacked, TIMELINE_FILL_ROW_MAX)).toBe(true);
      expect(isValidPlanTimeline(stacked)).toBe(false);
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

    it("clips a locked full-year Plan snapshot to kickoff and the report window", () => {
      const stored = { startDate: "2026-01-01", endDate: "2026-12-31" };
      const axis = resolveReportTimelineAxis({
        scheduleSource: "plan",
        projectStartYmd: "2026-01-01",
        projectEndYmd: "2026-12-31",
        reportDate: new Date("2026-09-15T00:00:00.000Z"),
        previousMonths: 1,
        lookaheadMonths: 2,
        planKickoffYmd: "2026-08-01",
        planEndYmd: "2026-12-31",
      });
      expect({ ...stored, ...axis }).toEqual({ startDate: "2026-08-01", endDate: "2026-11-30" });
    });

    it("windows Plan-source to kickoff and a short lookback/lookahead, not project start", () => {
      expect(
        resolveReportTimelineAxis({
          scheduleSource: "plan",
          projectStartYmd: "2026-01-01",
          projectEndYmd: "2027-12-31",
          reportDate: new Date("2026-09-15T00:00:00.000Z"),
          previousMonths: 1,
          lookaheadMonths: 2,
          planKickoffYmd: "2026-08-01",
          planEndYmd: "2027-06-30",
        })
      ).toEqual({ startDate: "2026-08-01", endDate: "2026-11-30" });
    });

    it("never starts the Plan axis before kickoff even when lookback is larger", () => {
      expect(
        resolveReportTimelineAxis({
          scheduleSource: "plan",
          projectStartYmd: "2026-01-01",
          projectEndYmd: "2026-12-31",
          reportDate: new Date("2026-09-15T00:00:00.000Z"),
          previousMonths: 4,
          lookaheadMonths: 2,
          planKickoffYmd: "2026-08-01",
          planEndYmd: "2026-12-31",
        })
      ).toEqual({ startDate: "2026-08-01", endDate: "2026-11-30" });
    });

    it("does not let a stored full-year Arrange window reopen Jan–Dec on the slide", () => {
      expect(
        resolveReportTimelineAxis({
          scheduleSource: "plan",
          projectStartYmd: "2026-01-01",
          projectEndYmd: "2026-12-31",
          reportDate: new Date("2026-09-15T00:00:00.000Z"),
          previousMonths: 1,
          lookaheadMonths: 2,
          planKickoffYmd: "2026-08-01",
          planEndYmd: "2026-12-31",
          windowStartYmd: "2026-01-01",
          windowEndYmd: "2026-12-31",
        })
      ).toEqual({ startDate: "2026-08-01", endDate: "2026-11-30" });
    });

    it("lets an author window narrow the auto range, not expand it", () => {
      expect(
        resolveReportTimelineAxis({
          scheduleSource: "plan",
          projectStartYmd: "2026-01-01",
          projectEndYmd: "2027-12-31",
          reportDate: new Date("2026-09-15T00:00:00.000Z"),
          previousMonths: 1,
          lookaheadMonths: 2,
          planKickoffYmd: "2026-08-01",
          planEndYmd: "2027-06-30",
          windowStartYmd: "2026-09-01",
          windowEndYmd: "2026-10-31",
        })
      ).toEqual({ startDate: "2026-09-01", endDate: "2026-10-31" });
    });

    it("floors to first Plan work when kickoff is earlier than any bar", () => {
      expect(
        resolveReportTimelineAxis({
          scheduleSource: "plan",
          projectStartYmd: "2026-01-01",
          projectEndYmd: "2026-12-31",
          reportDate: new Date("2026-09-15T00:00:00.000Z"),
          previousMonths: 1,
          lookaheadMonths: 2,
          planKickoffYmd: "2026-01-01",
          planEndYmd: "2026-12-31",
          planWorkStartYmd: "2026-08-03",
        })
      ).toEqual({ startDate: "2026-08-01", endDate: "2026-11-30" });
    });

    it("does not treat early-only Plan work as visible on a late windowed axis", () => {
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
      const windowed = resolveReportTimelineAxis({
        scheduleSource: "plan",
        projectStartYmd: projectStart,
        projectEndYmd: projectEnd,
        reportDate,
        previousMonths: 1,
        lookaheadMonths: 2,
        planKickoffYmd: projectStart,
        planEndYmd: projectEnd,
      });
      expect(isValidPlanTimeline(buildPlanTimelineCandidate(phases, "phases", clipped))).toBe(
        false
      );
      expect(isValidPlanTimeline(buildPlanTimelineCandidate(phases, "phases", windowed))).toBe(
        false
      );
    });
  });

  describe("shouldClipLockedTimelineToPreviousMonths", () => {
    it("clips locked Timeline snapshots and leaves Plan snapshots on their stored axis", () => {
      expect(shouldClipLockedTimelineToPreviousMonths("timeline")).toBe(true);
      expect(shouldClipLockedTimelineToPreviousMonths("plan")).toBe(false);
    });
  });
});
