import { describe, expect, it } from "vitest";
import {
  SR_TIMELINE_MARKER_TOP_PX,
  SR_TIMELINE_ROW_HEIGHT_PX,
  timelineMarkerHangsLeft,
} from "@/lib/statusReportTimelineLayout";

describe("statusReportTimelineLayout", () => {
  it("keeps the marker band below the bar inside the row", () => {
    expect(SR_TIMELINE_MARKER_TOP_PX).toBeGreaterThan(15);
    expect(SR_TIMELINE_MARKER_TOP_PX).toBeLessThan(SR_TIMELINE_ROW_HEIGHT_PX);
  });

  it("alternates clustered marker columns left and right of the date", () => {
    expect(timelineMarkerHangsLeft(0)).toBe(true);
    expect(timelineMarkerHangsLeft(1)).toBe(false);
    expect(timelineMarkerHangsLeft(2)).toBe(true);
  });
});
