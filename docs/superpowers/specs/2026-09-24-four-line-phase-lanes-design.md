# Four-line Plan Advanced lanes with on-bar names

Date: 2026-09-24

Amends [pinned key-date labels](2026-09-17-pinned-key-date-labels-design.md): same pins, leaders, and Arrange label drag. This spec changes **how many swimlanes exist**, **where phase names live**, **leader pin attachment**, and **scroll**.

## Problem

Modular Advanced still uses **one phase per row** (fill cap 16). SNY.TV-style plans grow a fifth+ swimlane and the timeline **scrolls**. The 240px left name column also steals chart width. Leaders currently start at the **center** of the pin icon.

## Goals

- Plan Advanced (HTML Preview/Present and PDF): **at most four** occupied lines; unused lines omitted.
- Multiple phases may share a line. Overlapping date ranges **both draw**.
- Default line when `timelineLayout.rows[phaseId]` is unset: wrap by phase order `1, 2, 3, 4, 5→1` (`(order % 4) + 1`).
- Authors set the line with **1–4** in Arrange and by **dragging the phase bar vertically** on the live **Edit** chart. Same overlay field.
- Phase **name is on the bar**. Drop the Advanced fill left label column (`labelColPx: 0`).
- Chart **does not scroll**. Occupied lines share the module (Modular) or the Standard slot without an inner scrollbar. Extra stacked key-date names **clip** inside the line; authors drag labels in Edit to recover them.
- Leader from **bottom center of the pin icon** (`markerTopPx + markerIconPx`) to the label box.

## Non-goals

- Horizontal phase-bar drag (would fake dates).
- Drag on published Preview, Present, or PDF.
- Condensed Plan (`planDensity: "phases"`), CDA, or Project-timeline source.
- Auto-bumping overlapping phases to another line.
- Always showing four empty bands.
- Prisma schema change.

## When this applies

Same Advanced gate: `scheduleSource === "plan"` && `planDensity !== "phases"`.

Condensed Plan and Project timeline keep today’s metrics, row policy, and (where present) label column.

## Product rules

### Lines

- Renderable row indices are **1–4** for Advanced **Standard and Modular**. Modular Advanced no longer uses `TIMELINE_FILL_ROW_MAX` (16) or `onePhasePerRow` for this chart.
- `getActiveTimelineRows` / row cap for Advanced Plan is **4**.
- A line is drawn only if at least one visible bar or in-axis marker maps to that index after overlay.
- Two phases on line 2 with overlapping dates: both bars on that line (opacity/muted unchanged).

### Defaults vs overlay

- Snapshot bars still carry `rowIndex` from schedule build. For Advanced, schedule build must use wrap4 (`(order % 4) + 1`), not one-row-per-phase.
- Overlay `rows[phaseId]` wins when it is an integer 1–4.
- Prune still drops keys whose phase id is gone.
- Zod already accepts `rows` as a record of numbers; clamp invalid values the same way Arrange already clamps (ignore / treat as default), do not 400 a whole PATCH for a stale 5 if we can clamp to 4.

### Edit: 1–4 control

- Arrange: each visible phase shows **1 2 3 4**. Selecting N writes `rows[phaseId] = N` via existing `saveTimelineLayout`.
- Keep hide, rename, key-date left/right, eye. Phase **up/down swap** can stay as a secondary move or be replaced by 1–4; 1–4 is required.

### Edit: drag phase bar

- Live `TimelineBlock` in the edit form (`interactive`): pointer down on a **bar** (not pin, not key-date label) starts a vertical drag.
- On move/up: map pointer Y to the nearest **occupied or insertable** line among 1–4. Empty indices become occupied when the first phase lands there; dropping onto an existing line **shares** that line.
- Commit `{ ...layout, rows: { ...rows, [phaseId]: n } }`.
- Cursor `grab` / `grabbing` on bars only when `interactive`.
- Key-date label drag is unchanged (label only; pin stays on date).

### Published surfaces

- Preview / Present / PDF: no pointer handlers. Honor `rows` and `markerLabelLayout`.
- No left phase-name rail. Bar label: existing in-bar ellipsis (`whitespace: nowrap; text-overflow: ellipsis`) whenever `labelColPx === 0`.
- HTML and PDF `TimelineBlock` share metrics (`labelColPx: 0` for Advanced fill).

### Leader

- `y1` = pin bottom = `markerTopPx + markerIconPx` (unscaled metric space, then × `layoutScale` at render).
- `x1` = pin date percent. `x2, y2` = label box (existing `cxPct` / `topPx`).
- Do not use icon vertical center.

### Height and clip

- Modular fill: occupied lines `flexGrow` leftover module height; `flexShrink: 0` only down to a **max** that still fits the module (no `overflow: auto` on the timeline). Each line `overflow: hidden`.
- Standard Advanced: slot stays content-sized but **must not** introduce an inner scrollbar; clip labels rather than growing past the slide timeline region.
- This **replaces** the pinned-label rule that dragging a label down always grows the published chart. Edit may still preview the drag; published clip is the overflow policy.

## Data

No new overlay keys. Use:

```ts
rows?: Record<string, number>; // phaseId → 1..4
markerLabelLayout?: Record<string, { cxPct: number; topPx: number }>;
```

## Implementation sketch

- `compactLanePolicyForVariation` / schedule build: Advanced Plan Modular uses **wrap4**, `timelineLayoutMaxRow` **4** for Plan Advanced (both variations).
- `PLAN_ADVANCED_FILL_TIMELINE_METRICS.labelColPx = 0` (drop `SR_FILL_ADVANCED_PHASE_LABEL_COL_PX` for this mode).
- `TimelineBlock`: hide left column when `labelColPx === 0`; always show in-bar names; leader `y1` pin bottom; `interactive` bar drag; no overflow scroll class on Advanced chart (`max-h-[360px] overflow-auto` on the Edit embed can remain for the **page**, not as a substitute for 16 phase rows).
- `ArrangeScheduleFields`: 1–4 control writing `rows`.

## Success criteria

- SNY.TV Modular Advanced: five sequential phases default to lines 1–4 with the fifth on line 1; **no timeline scrollbar**; Kickoff and the fifth phase can share line 1.
- No left name column; names visible on bars.
- Leaders leave the **bottom** of the pin.
- Edit: drag Design bar onto Kickoff’s line → both on line 1 after save; Preview matches; PDF matches offsets.
- Condensed and Project-timeline reports unchanged.

## Tests

TDD on helpers, not DOM:

- Wrap default: orders 0..4 → rows 1,2,3,4,1.
- Occupied-only: overlay all on row 1 → one active row.
- Overlay wins over snapshot `rowIndex`.
- Advanced Modular `timelineLayoutMaxRow` / policy is 4 / wrap4.
- Leader attachment helper (if extracted): `pinBottomY = markerTopPx + markerIconPx`.

## Risks

- Two overlapping bars on one line hide names; authors pick another line or rely on ellipsis.
- Clipped key-date names on a short line: authors drag labels in Edit (already shipped).
- Edit chart in a `max-h-[360px]` pane may still scroll **the embed** if the page is short; the **published** module must not.
