# Pinned key dates with draggable in-lane labels

Date: 2026-09-17

## Problem

Plan **Advanced** status-report timelines pulled key dates into a thin top (and Modular bottom) rail so swimlanes could stay bars-only. That failed the original readability goal:

- Several Design sign-offs share the same ~12% of a four-month axis. Two stagger rows, hang-left, and clipping still overlap or truncate names.
- The rails stole vertical space from phases, so later swimlanes were cropped.
- Automatic packing cannot beat date density. Authors need to park **names** in empty space while the **pin** stays on the true date.

## Goals

- Plan Advanced HTML preview and PDF: each visible key date is a **phase-colored pin on its swimlane at the real date**, with a **readable name** connected by a short leader.
- Default layout **stacks colliding labels down the lane** (not across a global 32px band) so the row grows instead of covering neighbors.
- On **Edit → Arrange**, authors **drag a label** (not the pin). Dragging down to sit under another label **increases that row’s height**. Dragging sideways parks the name in a quieter month. Preview and PDF are read-only and honor saved offsets.
- Remove the promoted top band and bottom rail so phase rows get that height back.
- Condensed Plan (`phases`) and Project-timeline source stay unchanged.

## Non-goals

- Changing Plan item dates, or dragging a pin horizontally (that would lie about the calendar).
- Drag on Preview, Present, or PDF.
- Condensed Plan, CDA, or Project timeline overlay.
- A second date list column beside the chart.
- Pointer drag in react-pdf (PDF is a snapshot of offsets).

## Product rules

### When this layout applies

Same gate as today’s Advanced chart: `scheduleSource === "plan"` and `planDensity !== "phases"` (helper may keep the name `usesPromotedTimeline` or be renamed `usesPinnedKeyDates`; behavior is the gate, not rails).

### Pins

- Pin **x** is always `positionPercent(date)` on the chart.
- Pin **y** is in the marker band under the phase bar (`markerTopPx`), not on the month header and not on a global rail.
- Stroke/fill follows phase color (existing `applyPlanPhaseColors` / `timelineMarkerPhaseColor`). Shape still encodes type (Pin / ThumbsUp / Flag / Calendar).
- Vertical pin drag onto another phase is **out of scope for the first slice** (Arrange left/right already moves the key date to a neighboring phase row). Pin stays on its laid-out row.

### Labels

- Default: label centered under its pin, immediately below the icon.
- If two or more labels on the **same row** would share less than `SR_TIMELINE_MARKER_MIN_GAP_PCT` of axis width, later labels in date order get `topPx += n * stackStep` (stack under the previous). That default is **computed at render**; it is not stored until the author drags.
- Saved override per marker id: `{ cxPct: number; topPx: number }`
  - `cxPct`: label center as % of chart width (0–100).
  - `topPx`: label top in px from the **row top**.
- Clamp: `topPx` cannot go above the bar bottom (labels stay in the marker band). `cxPct` keeps the label box inside the chart (padding = half label width).
- A 1px leader runs from the pin toward the label box.

### Row height

For each swimlane:

```
needed = max(baseRowHeightPx, max over markers of (labelTopPx + labelHeightPx + pad))
```

`labelTopPx` is the saved `topPx` or the default/stacked value. `labelHeightPx` is `markerFontPx + 4` (name line; date line optional at `markerFontPx - 1`).

- Dragging a label down updates `topPx` and the row grows immediately in Edit.
- Other rows keep `baseRowHeightPx` unless they also have stacked/saved labels.
- Modular fill: rows still `flexGrow` leftover module height **after** honoring `minHeight: needed`. Do not `flexShrink` below `needed` (that was the Hypercare crop).
- Standard/Milestones 16:9: `statusReportTimelineSlotHeightPx` becomes **content-sized** for Advanced: month header + report-date row + sum of per-row `needed` (no extra promoted band). Condensed and Project timeline stay 70px.

### Edit vs published

| Surface | Pins | Labels | Drag |
| --- | --- | --- | --- |
| Edit Arrange | yes | yes | yes (labels only) |
| Preview / Present / PDF | yes | yes | no |

Arrange checklist (hide, rename, phase up/down, key-date left/right, eye) stays. **Remove Top/Bottom rail chips** and `markerRails`.

Drag lives on a **live `TimelineBlock`** in the edit form under Arrange (same `formTimeline` + `formTimelineLayout`), not on the published preview. `pointerdown` on a label, `pointermove`/`pointerup` on `window`, commit overlay through existing `saveTimelineLayout`.

### Density and sources

- Condensed: still `lanes`/`bands` as today; no key-date pins if density is phases-only.
- Project timeline: still compact overlay; no new offsets.
- Advanced Modular: left phase-name column remains (~240px). Bar interiors stay unlabeled when the label column is present.

## Data

No Prisma schema change. Extend `TimelineLayoutOverlay`:

```ts
markerLabelLayout?: Record<string, { cxPct: number; topPx: number }>;
```

Drop `markerRails` from new writes. `pruneTimelineLayout` keeps keys whose `itemId` still exists. Zod on create/PATCH accepts the new record (`cxPct` 0–100, `topPx` ≥ 0, finite).

`applyTimelineLayout` does not have to stamp offsets onto each marker; render reads overlay + marker `itemId`. Optional stamp is fine if it simplifies PDF/HTML.

## Render architecture

1. Pure helpers in `lib/statusReportTimelineLayout.ts` (unit-tested):
   - `defaultPinnedLabelLayout(markers, axisStart, axisEnd, metrics) -> Map<id, { cxPct, topPx }>`
   - `resolvePinnedLabelLayout(markers, overlay, axis, metrics)` (saved overrides win)
   - `timelinePinnedRowHeightPx(base, markersInRow, resolvedLayout, metrics)`
   - `statusReportTimelineSlotHeightPx` accepts optional `{ rows: number[]; heights: number[] }` or a precomputed sum for Advanced
2. HTML `TimelineBlock`: draw pins + leaders + labels in the row (not a sibling rail). `interactive` enables drag.
3. PDF `TimelineBlock`: same geometry, `wrap={false}` on label text, no pointer handlers.

Metrics: Advanced compact and fill set `mode: "pinned"` (or `"lanes"` with labels forced on), `topBandPx: 0`, `bottomRailPx: 0`. Fill Advanced `rowHeightPx` can return to the taller bands baseline (~40) as the **minimum**; stacks grow from there.

## Success criteria

- SNY.TV Modular Advanced: Kickoff … Hypercare all visible without the old rails.
- Clustered Design sign-offs are stacked under the Design bar by default, names not truncated to `"Design Sign Of…"`.
- Dragging one label under another in Edit grows only the Design row; Preview after save matches.
- Condensed and Project-timeline reports look as they do today.
- Unit tests cover stack defaults, override wins, row height, prune, and slot height.

## Risks

- A Design row with many stacked labels can dominate Modular leftover height; other phases stay at minHeight. Acceptable.
- Standard 16:9 Advanced with four stacked labels may grow into activities; slot is content-sized and the rest of the slide flexes as it does for the current +32px band. If a report has extreme stacking, authors drag labels sideways instead of down.
- Drag vs scroll on a tall Arrange chart: pointer capture on the label; the page does not scroll while dragging.
