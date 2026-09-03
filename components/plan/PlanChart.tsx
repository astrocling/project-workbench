"use client";

import { Pin } from "lucide-react";
import { expandYmdRange } from "@/lib/plan/businessDays";
import { positionPercent, widthPercent } from "@/lib/plan/positioning";
import { getScaleColumns } from "@/lib/plan/scale";
import type { PlanItemJson, PlanJson, PlanMeetingJson } from "@/lib/plan/serialize";
import type { PlanItemType } from "@/lib/plan/types";

const MEETING_VIOLET = "#6d28d9";

const MILESTONE_TYPES: PlanItemType[] = ["milestone", "sign_off"];

function isMilestoneItem(item: PlanItemJson): boolean {
  return item.startDate === item.endDate || MILESTONE_TYPES.includes(item.type);
}

type PlanChartProps = {
  plan: PlanJson;
};

export function PlanChart({ plan }: PlanChartProps) {
  const { kickoffDate, endDate, phases, meetings } = plan;
  const columns = getScaleColumns(kickoffDate, endDate);
  const columnFrs = columns.map(
    (col) => expandYmdRange(col.startYmd, col.endYmd).length
  );

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-x-auto">
      <div className="relative min-w-[640px] p-4">
        <div
          className="grid gap-0 border-b-2 border-surface-300 dark:border-dark-muted w-full"
          style={{ gridTemplateColumns: columnFrs.map((f) => `${f}fr`).join(" ") }}
        >
          {columns.map((col, i) => (
            <div
              key={col.key}
              className={`text-white text-center py-2 text-label-sm font-bold uppercase tracking-wide px-1 truncate ${
                i < columns.length - 1 ? "border-r border-white/40" : ""
              }`}
              style={{ backgroundColor: "#040966" }}
              title={col.label}
            >
              {col.label}
            </div>
          ))}
        </div>

        <div className="divide-y divide-surface-200 dark:divide-dark-border">
          {phases.map((phase) => (
            <div key={phase.id} className="flex min-h-[52px]">
              <div className="w-36 shrink-0 py-2 pr-3 flex items-center">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 mr-2"
                  style={{ backgroundColor: phase.color }}
                  aria-hidden
                />
                <span className="text-body-sm font-medium text-surface-800 dark:text-surface-100 truncate">
                  {phase.name}
                </span>
              </div>
              <div className="relative flex-1 min-h-[52px] border-l border-surface-200 dark:border-dark-border">
                {phase.items.map((item) => (
                  <PlanItemBar
                    key={item.id}
                    item={item}
                    color={phase.color}
                    planStart={kickoffDate}
                    planEnd={endDate}
                  />
                ))}
              </div>
            </div>
          ))}

          {meetings.length > 0 && (
            <div className="flex min-h-[52px]">
              <div className="w-36 shrink-0 py-2 pr-3 flex items-center">
                <span className="text-body-sm font-medium text-surface-600 dark:text-surface-300">
                  Meetings
                </span>
              </div>
              <div className="relative flex-1 min-h-[52px] border-l border-surface-200 dark:border-dark-border">
                {meetings.map((meeting) => (
                  <MeetingMarker
                    key={meeting.id}
                    meeting={meeting}
                    planStart={kickoffDate}
                    planEnd={endDate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanItemBar({
  item,
  color,
  planStart,
  planEnd,
}: {
  item: PlanItemJson;
  color: string;
  planStart: string;
  planEnd: string;
}) {
  const left = positionPercent(item.startDate, planStart, planEnd);
  const isDiamond = isMilestoneItem(item);
  const waiting = item.type === "waiting_on_client";

  if (isDiamond) {
    return (
      <div
        className="absolute top-1/2 flex flex-col items-center pointer-events-none"
        style={{ left: `${left}%`, transform: "translate(-50%, -50%)" }}
        title={`${item.label} (${item.startDate})`}
      >
        <div
          className="w-3 h-3 rotate-45 border border-white/60 shadow-sm"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-medium text-surface-700 dark:text-surface-300 mt-1 bg-white/90 dark:bg-dark-raised px-1 rounded text-center max-w-[80px] truncate">
          {item.label}
        </span>
      </div>
    );
  }

  const width = widthPercent(item.startDate, item.endDate, planStart, planEnd);

  return (
    <div
      className={`absolute top-2 bottom-2 flex items-center rounded px-2 text-white text-body-sm font-medium truncate ${
        waiting ? "border-2 border-dashed border-white/80 bg-transparent" : ""
      }`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        minWidth: "4px",
        backgroundColor: waiting ? "transparent" : color,
        color: waiting ? color : undefined,
        borderColor: waiting ? color : undefined,
      }}
      title={`${item.label} (${item.startDate} – ${item.endDate})`}
    >
      {!waiting && item.label}
    </div>
  );
}

function MeetingMarker({
  meeting,
  planStart,
  planEnd,
}: {
  meeting: PlanMeetingJson;
  planStart: string;
  planEnd: string;
}) {
  if (meeting.status === "scheduled" && meeting.scheduledDate) {
    const left = positionPercent(meeting.scheduledDate, planStart, planEnd);
    return (
      <div
        className="absolute top-1 flex flex-col items-center pointer-events-none"
        style={{ left: `${left}%`, transform: "translateX(-50%)" }}
        title={`${meeting.label} (${meeting.scheduledDate})`}
      >
        <Pin className="text-jred-600 dark:text-jred-500 shrink-0" size={18} strokeWidth={2} aria-hidden />
        <span className="text-[10px] font-medium text-surface-700 dark:text-surface-300 mt-1 bg-white/90 dark:bg-dark-raised px-1 rounded text-center max-w-[80px] truncate">
          {meeting.label}
        </span>
      </div>
    );
  }

  const left = positionPercent(meeting.windowStart, planStart, planEnd);
  const width = widthPercent(meeting.windowStart, meeting.windowEnd, planStart, planEnd);

  return (
    <div
      className="absolute top-2 bottom-2 rounded border-2 border-dashed pointer-events-none"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        minWidth: "4px",
        borderColor: MEETING_VIOLET,
        background: `repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 4px,
          ${MEETING_VIOLET}33 4px,
          ${MEETING_VIOLET}33 8px
        )`,
      }}
      title={`${meeting.label} (assumed ${meeting.windowStart} – ${meeting.windowEnd})`}
    />
  );
}
