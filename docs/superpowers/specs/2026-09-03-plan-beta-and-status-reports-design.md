# Plan beta gate and status-report schedule source

Date: 2026-09-03

## Problem

The Plan builder is usable, but it is either visible to everyone (dev) or gated by env/email flags that cannot be managed in the app. Status reports still snapshot the legacy Timeline tab (`TimelineBar` / `TimelineMarker`). Putting the full Smartsheet-style Plan on a report slide will not fit. We need a slow beta roll (Admin picks projects), and a way for a report to use a compact Plan-derived schedule without replacing the Timeline tab.

## Goals

- Hide Plan until an Admin enables it on a project.
- Once enabled, anyone who can open the project sees the Plan tab; editors keep in-place edit (`canEdit`). No separate View/Edit mode on the Plan tab.
- New status reports (Standard and Milestones) can snapshot either the legacy Timeline or a compact Plan-derived schedule.
- The report form owns that choice. The Plan tab only sets a default for *new* reports.
- Compact Plan on the slide reuses the existing status-report timeline renderer (bars + markers + previous-months window).
- Saved reports stay locked; Refresh updates only the source that report used.

## Non-goals

- Replacing or hiding the Timeline tab.
- Live-linking Plan into old reports (no silent overwrite).
- Dumping the full Plan grid/Gantt, nested tasks, assumed meeting windows, or assumptions onto the slide.
- Rendering Modular `ganttTimeline` in this slice.
- Guided setup, Plan PDF export, Gantt drag-resize.
- Env/email feature flags (`PLAN_FEATURE_ENABLED`, `PLAN_FEATURE_ALLOWLIST`).
- Restricting Plan visibility to a single user once a project is enabled.

## Beta gate (per project)

Follow `cdaEnabled`, except **only Admins** may change the Plan toggle.

### Data

- `Project.planEnabled Boolean @default(false)`
- `Project.planReportDefault` enum `timeline` | `plan`, default `timeline`

### Settings UI

File: `components/ProjectSettingsTab.tsx`, Details section, after the CDA toggle.

- Admins see **Enable Plan tab (beta)** (same Toggle pattern as CDA).
- Non-admins do not see the control and cannot send `planEnabled` on PATCH.
- Helper text: Plan is a beta schedule builder. When on, everyone who can open this project sees the Plan tab. Status reports still use the Timeline tab until a report opts into Plan.

### Visibility

When `planEnabled` is false:

- Hide the Plan tab in `ProjectDetailTabs`.
- `?tab=plan` falls back to overview (same as today when the env flag is off).
- All `/api/projects/[id]/plan*` routes return **404**.

When `planEnabled` is true:

- Anyone who can open the project sees the Plan tab.
- APIs still require a signed-in session; mutations still require project `canEdit` (User/Admin).

### Remove env gate

Delete `PLAN_FEATURE_ENABLED` / `PLAN_FEATURE_ALLOWLIST` from `lib/plan/feature.ts` and docs. Gate on `project.planEnabled` instead (lookup by project id after resolving the project). Keep thin helpers such as `requirePlanSession` / `requirePlanEditSession`, but they must load the project flag, not env.

### PATCH project

File: `app/api/projects/[id]/route.ts`.

- Accept `planEnabled` and `planReportDefault` in the Zod schema.
- If the body includes `planEnabled` and the session is not Admin → **403**. Do not apply other fields in that request (fail closed).
- `planReportDefault` may be set by any project editor (User or Admin), because it only affects new reports, not tab visibility.
- Non-admins omitting `planEnabled` continue to PATCH other settings as today.

## Plan tab (no mode toggle)

File: `components/PlanTab.tsx`.

- Editors get the builder; viewers without `canEdit` get the existing read-only inputs (text instead of fields). There is **no** View/Edit segmented control.
- Once a plan exists, editors see **New status reports use:** `Project timeline` | `Project Plan`. This PATCHes `planReportDefault`. Copy: changing this does not rewrite saved reports.
- Short note with a link to `?tab=status-reports`: reports still use the Timeline tab unless a report chooses Project Plan.

## Status reports

Applies to **Standard** and **Milestones** only. CDA and Modular keep current timeline behavior (CDA has no Plan schedule on the slide in this slice; Modular does not gain `ganttTimeline`).

### Form (create / edit)

File: `components/StatusReportsTab.tsx`.

When `planEnabled` is true, show **Schedule source**:

- `Project timeline` (legacy bars/markers)
- `Project Plan`

Prefill from `project.planReportDefault` on **create**. When editing, the value is locked to the snapshot (like report date / previous months): show it read-only.

When source is `plan`, also show **Plan density**:

- `Phases only`
- `Phases + key dates` (default)

Density is chosen at create and stored on the snapshot. Editing shows it read-only; changing density later is a **Refresh** concern (refresh rebuilds compact Plan with the stored density). Do not add a second density editor on update in this slice.

When `planEnabled` is false, hide these controls; create always uses legacy timeline.

### Snapshot

Extend `StatusReportSnapshot` in `lib/statusReportPdfData.ts`:

```ts
scheduleSource?: "timeline" | "plan"; // default "timeline" when absent
planDensity?: "phases" | "phases_and_key_dates"; // only when scheduleSource === "plan"
```

- `scheduleSource === "timeline"` or omitted: build `snapshot.timeline` from `TimelineBar` / `TimelineMarker` as today.
- `scheduleSource === "plan"`: build `snapshot.timeline` from the compact Plan mapping below (same `bars` / `markers` / `startDate` / `endDate` shape the slide already renders). Also store `planDensity`. Do **not** require a parallel full Plan JSON blob on the snapshot.

`timelinePreviousMonths` clips Timeline-source reports (lookback through project end). Plan-source reports use Plan kickoff/end as floor/ceil, then a short window around the report date (`timelinePreviousMonths` lookback, `timelineLookaheadMonths` lookahead, default 2). Optional `timelineLayout.windowStartYmd` / `windowEndYmd` may **narrow** that window; they cannot expand it back to a full project year.

### Compact mapping

Helper in `lib/plan/` (e.g. `lib/plan/reportSchedule.ts`), used at report create and refresh.

Axis: for Plan source, `max(plan.kickoff, project.start, windowStart)` through `min(plan.end, project.end, windowEnd)`. Kickoff is the earliest month that can appear. Project start is not used when it is before kickoff.

**Phases only**

- One bar per phase with at least one dated item.
- `label` = phase name; `startDate` / `endDate` = min item start / max item end.
- `rowIndex` is 1–4 (same as `TimelineBar`): `rowIndex = (phase.order % 4) + 1`.
- `color` = `null` (renderer default). Do not map Plan hex colors onto the named Timeline palette in this slice.
- Markers: none.

**Phases + key dates** (default)

- Phase bars as above.
- Markers from items whose type is `milestone`, `sign_off`, `hard_deadline`, or `meeting` with `meetingStatus === "scheduled"`.
- Marker `date` = item `startDate` (point types already have end = start).
- Marker `label` = item label.
- Marker `rowIndex` = parent phase’s bar row.
- Marker `shape` (existing Timeline shapes only):

| Plan item | `shape` |
|---|---|
| `milestone` | `Pin` |
| `sign_off` | `ThumbsUp` |
| `hard_deadline` | `BadgeAlert` |
| scheduled `meeting` | `Rocket` |

**Excluded from the slide:** nested tasks, `waiting_on_client` bars, assumed meeting windows, assumptions list, indent, zoom, inline add.

**Create/refresh errors**

- Source is Plan and the project has no `ProjectPlan`, or no phase with dated items → **400** with a message to add phases/items on the Plan tab (or choose Project timeline).
- Same class of failure as “no project end date” for legacy timeline: do not save a blank chart silently.

### Refresh

`POST .../refresh-timeline` already rebuilds `snapshot.timeline` from project bars/markers.

- If `snapshot.scheduleSource === "plan"`, rebuild from compact Plan using stored `planDensity` (default `phases_and_key_dates` if missing).
- If source is timeline or omitted, keep current bar/marker rebuild.
- Button copy stays **Refresh timeline** for timeline-source reports; use **Refresh schedule** when source is Plan (same confirm modal pattern).
- Refresh does not change `scheduleSource`, `planDensity`, report date, or previous-months.

## Rendering

No new slide layout. `StatusReportView` / `StatusReportDocument` `TimelineBlock` keep consuming `data.timeline`. Compact Plan is an input mapping, not a second chart component.

## Testing

- Unit: compact mapping (empty plan, phases only, key dates, extra phases row wrap, assumed meetings omitted, scheduled meetings included).
- Unit: snapshot build chooses mapping vs bars/markers from `scheduleSource`.
- Unit: `planEnabled` false → plan API helper would 404 (or route-level test if one exists).
- PATCH project: non-admin cannot set `planEnabled`; admin can.

## Docs

- USER_GUIDE: Plan tab beta (Admin enable); reports choose schedule source; density; refresh.
- TECHNICAL: new Project fields; snapshot fields; mapping helper; Admin-only `planEnabled`.
- Remove env-var rows for `PLAN_FEATURE_*`.
