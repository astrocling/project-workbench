# Modular Plan schedule on the slide and full Plan export page

Date: 2026-09-16

## Problem

Modular status reports can place a `ganttTimeline` module, but that module still snapshots the **Timeline tab**. Projects whose Plan is the real schedule (for example SNY.TV) show Design / MVP / UAT instead of Plan phases. Standard and Milestones already support Plan as schedule source, Arrange, and an extra detailed Plan Gantt page. Modular was explicitly left out of that slice.

The 16:9 module cannot hold the full Plan Gantt. Authors need a **limited Plan strip** on the slide and an optional **full Plan** on extra PDF pages.

## Goals

- When an author selects **Project Plan** on a Modular report, the `ganttTimeline` module uses compact Plan phases (and optional key dates), not Timeline-tab bars.
- Authors can customize that strip: density, lookback/lookahead window, hide/rename phases and key dates, **one phase per row** (no wrap onto four lanes).
- Authors can **add the full project plan to the report**: the existing landscape Plan Gantt pages (`PlanPrintDocument` / `includeDetailedPlan`), after 16:9 slides; meeting notes stay last.
- When Plan is not selected (or Plan is off for the project), Modular keeps using the Timeline tab.
- Saved reports stay locked. Refresh schedule rebuilds from the locked source. Arrange remains editable after create.

## Non-goals

- Replacing or hiding the Timeline tab.
- Live-linking Plan into old Modular reports (no silent overwrite).
- Putting the full Smartsheet-style Plan grid, nested tasks, or assumptions **on the 16:9 slide**.
- A new Modular grid module type for the full Gantt (it is a report-level checkbox, not a slot).
- Changing CDA.
- Fixing inverted Plan item dates in author data (those phases still drop from compact mapping until dates are valid).
- Raising Standard/Milestones past four swimlanes.

## Product rules

### Schedule source

- Modular joins Standard and Milestones as a **schedule-eligible variation** when Plan is enabled on the project (or the saved report already locked `scheduleSource: "plan"`).
- Form: same **Schedule source** select (Project timeline | Project Plan). Locked after create, same as Standard.
- New Modular reports use `Project.planReportDefault` the same way Standard does when entering the variation.
- **Project Plan selected** → compact snapshot from `compactPlanToSchedule` + `resolveReportTimelineAxis` (`scheduleSource: "plan"`).
- **Project timeline selected** → existing Timeline-tab snapshot (`scheduleSource: "timeline"`).

### On-slide module (limited)

Shown only in a placed `ganttTimeline` cell. Data still comes from `snapshot.timeline` (plus `timelineLayout` overlay).

Customization (create locks density and window; Arrange is editable later):

| Control | Behavior |
| --- | --- |
| Plan density | `phases` or `phases_and_key_dates` (locked after create) |
| Previous months | 1–4, Plan axis lookback (locked after create) |
| Months after report date | 1–4, Plan lookahead (locked after create) |
| Arrange | Hide/rename bars and markers; reorder onto **one row per phase**, not `order % 4` wrap. Cap **16** lanes on Modular (`TIMELINE_FILL_ROW_MAX`), not 4. |

Render: existing Modular fill TimelineBlock (12px module type, bands for key dates, expand wrapped bars onto own rows). Window clipping stays: phases fully outside the axis do not draw.

If Modular has no `ganttTimeline` module, the strip is absent. Schedule source / density / window / detailed-plan checkbox can still be set so a later add-module + refresh works.

### Extra pages (full Gantt)

- Checkbox when Modular + Plan source: **Add full project plan to report**.
- Snapshot flag remains `includeDetailedPlan: true`.
- Preview and PDF reuse `PlanPrintDocument` (`chartOnly` as today) from `data.detailedPlan`.
- Page order: 16:9 module page(s) → optional detailed Plan pages → meeting notes (if any).
- Standard copy may keep “Include detailed plan page”; Modular uses “Add full project plan to report” (same flag). Do not invent a second snapshot field.

### Refresh

- **Refresh timeline** stays available on Modular when a `ganttTimeline` module is placed.
- Rebuild uses locked `scheduleSource` / `planDensity` / window months. Does not switch Timeline ↔ Plan.
- If locked source is Plan and Plan has been disabled, same 400 as Standard (`PLAN_NOT_ENABLED_ERROR`).
- Arrange overlay is pruned to ids that still exist after refresh (existing `pruneTimelineLayout`).

## Data and API

No Prisma schema change. Reuse snapshot fields already on Standard:

- `scheduleSource`, `planDensity`, `timelinePreviousMonths`, `timelineLookaheadMonths`
- `timeline`, `timelineLayout`
- `includeDetailedPlan` (and `detailedPlan` on PDF data, not necessarily persisted as a duplicate of Plan JSON beyond current behavior)

### Create `POST .../status-reports`

- `isPlanScheduleCreateRequest` is true for **Modular** when `scheduleSource === "plan"` (today it is Standard/Milestones only).
- Validate Plan enabled + project end date with the existing helpers.
- Persist the Plan snapshot fields even if `ganttTimeline` is not in the layout yet.
- Still only **lock `snapshot.timeline`** when `modularNeedsTimeline` (module placed), matching current Modular create. If Plan is selected but the module is missing, store source/density/window/`includeDetailedPlan` without compact bars until the module is added and refreshed—or lock compact timeline whenever Plan is selected so Arrange has data on first edit. **Decision: lock compact `timeline` whenever Modular create uses Plan source**, even without the module, so Arrange and refresh have a snapshot. If Timeline source and no module, skip locking timeline (today).

### PATCH

- Same as Standard for `includeDetailedPlan` and `timelineLayout`.
- Modular Arrange must persist `rowIndex` values **> 4** (overlay `rows` map). `clampRow` in `applyTimelineLayout` / `setTimelineLayoutRow` currently rejects rows outside 1–4. Modular Plan Arrange uses 1–`TIMELINE_FILL_ROW_MAX`. Standard/Milestones stay 1–4.

### PDF data

- `buildStatusReportPdfData` already builds Plan vs Timeline from `resolveScheduleSource`. Once Modular reports store `scheduleSource: "plan"`, the `ganttTimeline` module picks it up with no second calculation.
- `includeDetailedPlan` already attaches `detailedPlan`. Ensure Modular preview/export still renders `PlanPrintDocument` when that flag is set (already in `StatusReportView`).

## UI

File: `components/StatusReportsTab.tsx`

- `isScheduleEligibleVariation` includes **Modular**.
- `shouldResetScheduleDefaultsOnVariationChange`: entering Modular from CDA (or from a non-eligible variation) reapplies `planReportDefault`.
- Show Arrange when editing Modular, Plan source, and `formTimeline` exists (same as Standard). Arrange row list uses fill max (16) for Modular Plan, not 4.
- Show the detailed-plan checkbox when Modular + Plan source.

File: `components/ArrangeScheduleFields.tsx`

- Accept an optional `maxRow` (default 4). Modular Plan passes 16.
- Drag targets and row labels follow `maxRow`.

## Rendering

- Keep expand-wrapped-bars-to-own-rows for **already-locked** Plan snapshots that used `% 4` wrap, so old Modular reports that get a source fix/refresh still unstack.
- New compact mapping for Modular Plan: prefer **one row per dated phase** at compact time (`phase.order` sequence, not modulo 4) so Arrange starts 1:1 with Plan phases. Standard compact mapping **stays** modulo 4.
- Pass a compact option (for example `lanePolicy: "wrap4" | "onePhasePerRow"`) into `compactPlanToSchedule`. Modular Plan create/refresh uses `onePhasePerRow`.

## Errors

Reuse `lib/plan/reportScheduleErrors.ts` copy. Modular Plan create with empty compact schedule returns the same 400 as Standard (density-aware empty / point-date messages).

## Tests (must cover)

- `isScheduleEligibleVariation("Modular") === true`
- `isPlanScheduleCreateRequest("Modular", "plan") === true`
- `compactPlanToSchedule(..., { lanePolicy: "onePhasePerRow" })` assigns phase order 4 to row 5, not row 1
- `setTimelineLayoutRow` / `applyTimelineLayout` accept row 5 when max is 16; Standard still rejects row 5
- Modular PDF data with `scheduleSource: "plan"` and a `ganttTimeline` module exposes Plan phase labels, not Timeline-tab labels
- `includeDetailedPlan` on Modular sets `data.includeDetailedPlan` / `detailedPlan` like Standard
- Flags: refresh timeline still requires the gantt module; schedule form fields show for Modular when Plan is enabled

## Docs

Update `docs/TECHNICAL.md` status-report / Plan schedule section: Modular is schedule-eligible; compact strip vs `includeDetailedPlan` extra pages; Arrange row cap 16 on Modular Plan only.
