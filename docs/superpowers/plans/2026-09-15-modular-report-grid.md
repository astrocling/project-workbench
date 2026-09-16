---
name: Modular report grid
overview: Turn Modular into a 16:9 grid composer on a 1440x810 canvas. Rows always fill the slide (no leftover gaps). Upcoming Meetings and Plan vs typed activity columns are mix-and-match; Risks stays typed. Compact budget modules are specified views of the same snapshot. Standard / Milestones / CDA stay unchanged.
todos:
  - id: canvas-and-rows
    content: Lock 1440x810 canvas, type scale, and fill-the-slot row templates; migrate Modular defaults
    status: in_progress
  - id: render-existing
    content: Render Modular body as templated rows in StatusReportView + PDF Document; capture at 1440 then scale to 16:9 PDF page
    status: pending
  - id: continuation-pages
    content: Support a second 16:9 module page with compact header; meeting notes remain last
    status: pending
  - id: modular-snapshot
    content: Attach and refresh budget/timeline snapshots on Modular when those modules are present
    status: pending
  - id: plan-modules
    content: Upcoming Meetings + mix-and-match Completed/Upcoming (typed or Plan) + typed Risks; Refresh Plan lists
    status: pending
  - id: compact-budget
    content: Full HIGH/LOW, compact dollars, compact hours, and burn-only modules from the same snapshot.budget
    status: pending
  - id: editor-presets
    content: "Status Reports tab: presets, add row / add module into slots, page assignment; docs and tests"
    status: pending
isProject: false
---

# Modular status report grid

## Scope

**In this slice:** only the **Modular** variation. [Standard](components/StatusReportView.tsx), **Milestones**, and **CDA** stay on the existing **720×405** slide.

**Out of scope:** rewriting other variations onto the grid; live-linking saved reports; full Plan Gantt on the slide; freeform packing; more than **two** 16:9 module pages (plus meeting notes).

## Canvas: same 16:9, twice the layout size

Modular lays out at **1440 × 810** CSS px (exactly 2× today’s 720×405) with ~11–13px body type. PDF still uses the existing 16:9 **page** size: capture the 1440 canvas and scale the image down. Preview fits the 1440 slide in the modal. Standard / CDA / Milestones keep 720.

Capture in [`lib/statusReportPdfCapture.ts`](lib/statusReportPdfCapture.ts) must not always pin 720 for Modular.

## Horizontal space: fill the slot (plain language)

Think of the body as **rows that always stretch edge-to-edge**, like a table. You never place a module “somewhere in 12 columns” and hope it wraps. You **add a row shape**, then put **one module in each cell**. Every cell is stretched: full width of that cell, full height of that row. Empty cells still show a bordered placeholder so the row does not collapse.

**Fill contract (no weird leftover space):**

- The row is 100% of the slide content width (inside padding).
- Each cell is `flex-grow` according to the row shape (thirds, halves, etc.).
- The module’s outer box is `width 100%` / `height 100%` with a header bar and border.
- Lists scroll or “+N more” **inside** the cell; they do not shrink the box.

**Row shapes you can add** (that is the whole list):

```
Full width          [ ████████████  one module ████████████ ]

Two halves          [ ██████ left ██████ | ██████ right ██████ ]

Three equals        [ ████ A ████ | ████ B ████ | ████ C ████ ]

Wide + KPI          [ ████████ wide ████████ | ██ KPI ██ ]

KPI + wide          [ ██ KPI ██ | ████████ wide ████████ ]
```

That is it for v1. Drop the earlier `9-3` / `3-3-3-3` options — they were hard to picture and easy to leave a skinny leftover. If you need two donuts, put them **stacked in the KPI cell** of a wide+KPI row, or use two halves.

Default **page 1**:

```
┌─────────────────────────────────────────────────────────────┐
│  Full header: bio                          │ RAG table      │
├───────────────┬───────────────┬─────────────┤
│ Completed     │ Upcoming      │ Risks       │  three equals │
├───────────────┴───────────────┴─────────────┤
│ Timeline (full width) — omit this row if unused             │
├──────────────────────────────┬──────────────┤
│ Sprint schedule              │ Donuts       │  wide + KPI   │
│ (or story points in the      │ stacked      │               │
│  other half via two-halves)  │              │               │
└──────────────────────────────┴──────────────┘
│ Footer                                                      │
```

Classic Modular’s three bottom pieces (sprint, story points, donuts) become **two halves** (sprint | story points) plus donuts **stacked in a following wide+KPI row**, or story points in the wide cell and donuts in the KPI cell. Never three unequal boxes on one row.

Editor: **Add row** (pick a shape) → **Add module** into an empty cell. You do not type “span 6.”

## Continuation pages

Page 1: full bio + RAG. Optional page 2: compact header (name, period, date, RAG pills). Meeting notes stay last. Cap: two 16:9 module pages.

## Status columns: mix-and-match, added individually

These are **separate modules**. A typical row is three equals. You can mix sources. You cannot auto-fill Risks.

| Add-menu name | On-slide title | Source | Editor |
| --- | --- | --- | --- |
| Completed (typed) | Completed Activities | `completedActivities` text | Same bullets as today |
| Completed (from Plan) | Completed Activities | Plan items, not meetings, `status === complete` as of report date | Refresh Plan lists; no typing |
| Upcoming (typed) | Upcoming Activities | `upcomingActivities` text | Same as today |
| Upcoming (from Plan) | Upcoming Activities | Plan items, not meetings, not complete, still open as of report date | Refresh Plan lists |
| Risks | Risks / Issues / Decisions | `risksIssuesDecisions` text **only** | Always typed; no Plan auto-fill |

Putting Plan Completed and typed Completed on the **same** slide is allowed (two cells) but unusual; presets pick one pair.

**Plan delivery preset (page 1, three equals):** Completed (from Plan) | Upcoming (from Plan) | Risks (typed).

## Upcoming Meetings

Module id can stay `planMeetings`. **Title on the slide: Upcoming Meetings.**

Requires Plan enabled. Snapshot at create/refresh. All meeting items (not `showOnReports`).

- **Needs scheduling:** unscheduled — date shows TBD
- **Scheduled:** scheduled and not complete — date + optional time
- Completed meetings do **not** appear here; they show under Completed (from Plan) if that module is on the slide

Rows: date/TBD, label (`reportLabel` or `label`), time if set. Cap ~8–10 with “+N more”. Empty: “No upcoming meetings.” Typical cell: a **half** next to compact budget, or **full width** on page 2.

## Budget modules: what is actually on the slide

All four read the **same** locked `snapshot.budget` (HIGH/LOW $ and hours from Budget tab lines + spend to date). No second calculation. **Refresh budget** rebuilds that snapshot.

Spent dollars and actual hours are **one number** (to-date). HIGH vs LOW only changes the **budgeted** side (est / remaining). Compact views show **HIGH only** so a half-width cell is readable. The Standard table’s LOW row is what makes the full module need the whole width.

### 1. Full budget (`budgetFinancials`) — row shape: full width

Same as today’s Standard bottom block.

```
┌─────────────────────────────────────────────────────┬────────┐
│         Est. Budget  $ Spent  $ Remaining           │        │
│         Budgeted Hrs Actual Hrs Hrs Remaining       │ donut  │
│ HIGH    $ …          $ …      $ …                   │  % of  │
│         hrs …        hrs …    hrs …                 │  HIGH $│
│ LOW     $ …          $ …      $ …                   │  used  │
│         hrs …        hrs …    hrs …                 │        │
└─────────────────────────────────────────────────────┴────────┘
```

Donut = `burnPercentHigh` (dollar burn vs HIGH est). Use this when budget is the story.

### 2. Compact dollars (`budgetCompactDollars`) — row shape: half (or the wide cell)

HIGH dollars only. No hours, no LOW row.

```
┌ Budget ──────────────────────────────────┬──────┐
│  Est. (HIGH)     Spent        Remaining  │ donut│
│  $125,000        $48,200      $76,800    │  39% │
└──────────────────────────────────────────┴──────┘
```

Three figures + the same HIGH $ burn donut. Fits beside Upcoming Meetings or compact hours.

### 3. Compact hours (`budgetCompactHours`) — row shape: half

HIGH hours only. No dollars.

```
┌ Hours ───────────────────────────────────┬──────┐
│  Budgeted (HIGH)  Actual     Remaining   │ donut│
│  1,200            410        790         │  34% │
└──────────────────────────────────────────┴──────┘
```

Hours donut = actual hours / HIGH budgeted hours (not the dollar %). Pair with compact dollars on a **two halves** row for a dense budget strip without the LOW table.

### 4. Burn only (`budgetBurnOnly`) — row shape: KPI cell (wide+KPI)

No table.

```
┌──────────┐
│  (donut) │
│   39%    │
│  Budget  │
│   used   │
└──────────┘
```

Same HIGH $ burn as the full module. Use when the row’s wide cell is timeline, sprint, or meetings.

**Do not** put two different budget snapshots on one report. You *may* put compact dollars and compact hours side by side (same snapshot, two presentations). Putting full HIGH/LOW **and** compact dollars on the same page is redundant; the editor can allow it, presets will not.

## How the editor works

[`components/StatusReportsTab.tsx`](components/StatusReportsTab.tsx):

1. Presets: Classic Modular (typed three-equals + sprint/metrics/donuts), Plan delivery (Plan completed/upcoming + typed Risks + Upcoming Meetings), Budget-forward (typed three-equals + full budget).
2. Add continuation slide (compact header).
3. Add row (shape) → add module into a cell (Completed typed vs from Plan are two menu items, etc.).
4. Move/remove rows and modules.

`StatusReport.panels` becomes `{ layout, modules }` with migrate-on-read from today’s `ReportPanel[]`.

## Data / render / tests

Snapshot Plan lists and budget when those modules exist. [`StatusReportView.tsx`](components/StatusReportView.tsx) is source of truth; [`StatusReportDocument.tsx`](components/pdf/StatusReportDocument.tsx) stays in parity. Capture 1440, scale to current 16:9 PDF page.

Tests: row shapes always fill; modules stretch; migrate legacy panels; Plan meeting title and filters; typed vs Plan activity modules; Risks never auto; each budget module’s fields; Standard capture still 720.

## Implementation order

1. Canvas + fill-the-slot rows + migrate Modular defaults.
2. Render existing modules on page 1; capture scale.
3. Continuation page + compact header.
4. Modular budget/timeline snapshot + refresh.
5. Upcoming Meetings + Completed/Upcoming Plan vs typed + Risks typed.
6. Four budget presentations.
7. Editor presets and docs.
