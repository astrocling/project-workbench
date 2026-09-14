-- Rename meeting window status from assumed → unscheduled (same semantics, clearer product language).
ALTER TYPE "PlanMeetingStatus" RENAME VALUE 'assumed' TO 'unscheduled';
