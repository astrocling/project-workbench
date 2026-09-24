# Pinned key-date labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan Advanced timelines put phase-colored pins on swimlanes at the real date, stack or drag labels in the lane (growing the row), and drop the promoted rails that were clipping names and phases.

**Architecture:** Replace `mode: "promoted"` rails with `mode: "pinned"` in-row pins + leader labels. Default collision stacks `topPx` downward (pure helper). Saved `{ cxPct, topPx }` on `timelineLayout.markerLabelLayout` wins. HTML Edit Arrange hosts an interactive `TimelineBlock`; Preview/PDF are read-only with the same geometry.

**Tech Stack:** Next.js client `TimelineBlock`, react-pdf `TimelineBlock`, Vitest, existing snapshot JSON overlay (no Prisma change).

**Spec:** `docs/superpowers/specs/2026-09-17-pinned-key-date-labels-design.md`

## Global Constraints

- Condensed Plan (`planDensity: "phases"`) and `scheduleSource: "timeline"` metrics/render stay as they are today.
- Do not change Plan item dates. Pins do not drag horizontally.
- Preview / Present / PDF are not interactive.
- No Prisma schema change. Overlay is JSON on `StatusReport.snapshot.timelineLayout`.
- This repo’s user rule: **do not git commit unless the user explicitly asks**. Skip every Commit step unless they ask.
- TDD: failing test first, then minimal implementation.
- Do not edit this plan file while implementing.

## File map

| File | Responsibility |
| --- | --- |
| `lib/statusReportTimelineLayout.ts` | Pinned metrics, label layout helpers, row/slot height, overlay type + prune/apply |
| `__tests__/lib/statusReportTimelineLayout.test.ts` | Helpers, metrics, prune |
| `app/api/projects/[id]/status-reports/route.ts` | Zod `markerLabelLayout` |
| `app/api/projects/[id]/status-reports/[reportId]/route.ts` | Same Zod |
| `components/StatusReportView.tsx` | HTML pins, leaders, labels, optional drag, row minHeight |
| `components/pdf/StatusReportDocument.tsx` | PDF parity, no drag, content-sized Advanced slot |
| `components/ArrangeScheduleFields.tsx` | Drop Top/Bottom rail; keep hide/rename/move |
| `components/StatusReportsTab.tsx` | Interactive TimelineBlock on Plan Advanced edit |
| `docs/TECHNICAL.md` | Replace promoted-rail description |

---

### Task 1: Overlay type and prune

**Files:**
- Modify: `lib/statusReportTimelineLayout.ts`
- Modify: `__tests__/lib/statusReportTimelineLayout.test.ts`
- Modify: `app/api/projects/[id]/status-reports/route.ts`
- Modify: `app/api/projects/[id]/status-reports/[reportId]/route.ts`

**Interfaces:**
- Produces: `TimelineLayoutOverlay.markerLabelLayout?: Record<string, { cxPct: number; topPx: number }>`
- Drop persist of `markerRails` (ignore if present on old snapshots).

- [ ] **Step 1: Write the failing test**

In `__tests__/lib/statusReportTimelineLayout.test.ts` add:

```ts
it("prunes markerLabelLayout to ids still on the compact schedule", () => {
  const stale = {
    markerLabelLayout: {
      m1: { cxPct: 40, topPx: 20 },
      gone: { cxPct: 10, topPx: 8 },
    },
  };
  expect(pruneTimelineLayout(stale, timeline)).toEqual({
    markerLabelLayout: { m1: { cxPct: 40, topPx: 20 } },
  });
});
```

Use the existing `timeline` fixture (`m1` exists, `gone` does not).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --exclude '.worktrees/**' __tests__/lib/statusReportTimelineLayout.test.ts`

Expected: FAIL (unknown field stripped or missing).

- [ ] **Step 3: Minimal implementation**

Add to `TimelineLayoutOverlay`:

```ts
markerLabelLayout?: Record<string, { cxPct: number; topPx: number }>;
```

Extend `overlayHasContent` and `pruneTimelineLayout` (`pickExisting` on marker ids). Widen `pickExisting` if it only allows `string | number` — use a generic value type.

Zod on both status-report routes:

```ts
markerLabelLayout: z
  .record(
    z.string(),
    z.object({
      cxPct: z.number().min(0).max(100),
      topPx: z.number().min(0),
    })
  )
  .optional(),
```

Leave `markerRails` out of new Zod (old clients simply stop sending it).

- [ ] **Step 4: Run tests**

Run: `npx vitest run --exclude '.worktrees/**' __tests__/lib/statusReportTimelineLayout.test.ts`

Expected: PASS.

---

### Task 2: Default stack + row height helpers

**Files:**
- Modify: `lib/statusReportTimelineLayout.ts`
- Modify: `__tests__/lib/statusReportTimelineLayout.test.ts`

**Interfaces:**

```ts
export type PinnedLabelBox = { cxPct: number; topPx: number };

export function defaultPinnedLabelLayout<T extends { itemId?: string; date: string }>(
  markers: T[],
  axisStart: string,
  axisEnd: string,
  opts: { markerTopPx: number; markerIconPx: number; stackStepPx: number; minGapPct?: number }
): Record<string, PinnedLabelBox>;

export function resolvePinnedLabelLayout<T extends { itemId?: string; date: string }>(
  markers: T[],
  overlay: TimelineLayoutOverlay | undefined,
  axisStart: string,
  axisEnd: string,
  opts: { markerTopPx: number; markerIconPx: number; stackStepPx: number; minGapPct?: number }
): Record<string, PinnedLabelBox>;

export function timelinePinnedRowHeightPx(
  baseRowHeightPx: number,
  markerIds: string[],
  layout: Record<string, PinnedLabelBox>,
  labelHeightPx: number,
  padPx?: number
): number;
```

Default `cxPct` is the marker’s date percent on the axis. Default `topPx` is `markerTopPx + markerIconPx + 2`. Markers on the same row are **not** passed as a row here — callers pass **one row’s markers**. Clustering: sort by date; if `pct(a) - lastPct < minGapPct` (default `SR_TIMELINE_MARKER_MIN_GAP_PCT`), increment stack index; `topPx += stackIndex * stackStepPx`. Saved overlay boxes replace the whole box for that id.

- [ ] **Step 1: Failing tests**

```ts
const opts = { markerTopPx: 8, markerIconPx: 10, stackStepPx: 14 };

it("stacks a same-row cluster downward and leaves a distant date on the first band", () => {
  const layout = defaultPinnedLabelLayout(
    [
      { itemId: "a", date: "2026-09-02" },
      { itemId: "b", date: "2026-09-03" },
      { itemId: "c", date: "2026-11-15" },
    ],
    "2026-07-01",
    "2026-12-31",
    opts
  );
  expect(layout.a?.topPx).toBe(20);
  expect(layout.b?.topPx).toBe(34);
  expect(layout.c?.topPx).toBe(20);
});

it("lets a saved box win over the automatic stack", () => {
  const resolved = resolvePinnedLabelLayout(
    [
      { itemId: "a", date: "2026-09-02" },
      { itemId: "b", date: "2026-09-03" },
    ],
    { markerLabelLayout: { b: { cxPct: 55, topPx: 48 } } },
    "2026-07-01",
    "2026-12-31",
    opts
  );
  expect(resolved.b).toEqual({ cxPct: 55, topPx: 48 });
});

it("grows row height to the lowest label", () => {
  expect(
    timelinePinnedRowHeightPx(40, ["a", "b"], { a: { cxPct: 10, topPx: 20 }, b: { cxPct: 12, topPx: 48 } }, 12, 4)
  ).toBe(64);
});
```

Adjust expected `topPx` if `markerTopPx + icon + 2` is implemented as a named constant — keep the test math identical to the helper.

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement the three functions**

Skip markers without `itemId`. `timelinePinnedRowHeightPx` returns `Math.max(base, ... topPx + labelHeightPx + pad)`.

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 3: Metrics — drop rails, add pinned mode

**Files:**
- Modify: `lib/statusReportTimelineLayout.ts`
- Modify: `__tests__/lib/statusReportTimelineLayout.test.ts`

**Interfaces:**
- `StatusReportTimelineMetrics.mode` includes `"pinned"` instead of using `"promoted"` for Advanced.
- `PLAN_ADVANCED_TIMELINE_METRICS`: `mode: "pinned"`, `topBandPx: 0`, `bottomRailPx: 0` (keep in-lane `markerTopPx` / icon sizes from current **lanes** compact metrics).
- `PLAN_ADVANCED_FILL_TIMELINE_METRICS`: `mode: "pinned"`, `topBandPx: 0`, `bottomRailPx: 0`, `rowHeightPx` back to fill baseline **40**, `labelColPx` stays `SR_FILL_ADVANCED_PHASE_LABEL_COL_PX` (240).
- `usesPromotedTimeline` remains the Advanced **gate** (or rename to `usesPinnedKeyDates` and update all call sites in the same task — pick rename if grep is small).
- `statusReportTimelineSlotHeightPx` for Advanced compact: `SR_TIMELINE_SLOT_HEIGHT_PX` (70) as **minimum**; a later render pass can pass an explicit pixel height. Add optional third argument:

```ts
export function statusReportTimelineSlotHeightPx(opts: {
  scheduleSource?: "timeline" | "plan" | null;
  planDensity?: PlanReportDensity | null;
  contentHeightPx?: number;
}): number {
  if (!usesPromotedTimeline(opts.scheduleSource, opts.planDensity)) {
    return SR_TIMELINE_SLOT_HEIGHT_PX;
  }
  return Math.max(SR_TIMELINE_SLOT_HEIGHT_PX, opts.contentHeightPx ?? SR_TIMELINE_SLOT_HEIGHT_PX);
}
```

Until Task 4 computes `contentHeightPx`, Standard Advanced is 70px (rails gone, labels stack inside rows and may overflow until Task 4 wires per-row minHeight + slot sum). Task 4 must pass the sum.

- [ ] **Step 1: Failing test** — change the existing “promotes Plan Advanced key dates into rails” example:

```ts
expect(compact.mode).toBe("pinned");
expect(compact.topBandPx).toBe(0);
expect(compact.bottomRailPx).toBe(0);
expect(filled.mode).toBe("pinned");
expect(filled.topBandPx).toBe(0);
expect(filled.bottomRailPx).toBe(0);
expect(filled.labelColPx).toBe(240);
expect(filled.rowHeightPx).toBe(40);
expect(statusReportTimelineSlotHeightPx({ scheduleSource: "plan", planDensity: "phases" })).toBe(70);
expect(
  statusReportTimelineSlotHeightPx({
    scheduleSource: "plan",
    planDensity: "phases_and_key_dates",
    contentHeightPx: 140,
  })
).toBe(140);
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Change metric objects; delete unused `SR_TIMELINE_PROMOTED_TOP_BAND_PX` usage from Advanced fill/compact. Keep the constant only if slot math still references it; otherwise remove dead constants in this task.**

- [ ] **Step 4: Run — expect PASS.** Update any other tests that still expect `promoted` / `topBandPx > 0` / fill `rowHeightPx: 22`.

---

### Task 4: HTML TimelineBlock — pins, leaders, growing rows

**Files:**
- Modify: `components/StatusReportView.tsx`
- Modify: `lib/statusReportTimelineLayout.ts` (`timelinePhaseRowLayout` already `flexShrink: 0` — keep it)

**Interfaces:**
- `TimelineBlock` gains optional `labelLayout?: TimelineLayoutOverlay` (or the overlay itself) and does **not** take drag yet.
- When `metrics.mode === "pinned"`:
  - Do **not** render `PromotedDateRail`.
  - Do **not** empty `chartMarkers`.
  - For each active row, `resolvePinnedLabelLayout` on that row’s visible markers.
  - `rowLayout` `minHeight` = `timelinePinnedRowHeightPx(metrics.rowHeightPx, ids, resolved, labelHeight)`.
  - Each marker: pin at date x / `markerTopPx`; label at `left: cxPct%` with `top: topPx`; SVG leader from pin center to label.
  - Label text uses phase color (`timelineMarkerPhaseColor`). Truncate only if the box is wider than `metrics.markerColPx` **after** the author parked it — prefer wrapping one extra line (`WebkitLineClamp: 2`) rather than `"…"`.
- Report-date row and month header stay; no topBand/bottomRail spacers when those metrics are 0.

- [ ] **Step 1: No new unit test required for JSX.** Keep helpers covered. Manually confirm types compile (`npx tsc --noEmit` is noisy; filter `StatusReportView` if needed).

- [ ] **Step 2: Delete or stop calling `PromotedDateRail` when mode is pinned. Remove `partitionPromotedTimelineMarkers` from this render path.**

- [ ] **Step 3: Standard Advanced parent: compute slot height from sum of pinned row heights + month + report-date and pass into existing `statusReportTimelineSlotHeightPx({ ..., contentHeightPx })` where the Standard slide reserves the timeline (search `statusReportTimelineSlotHeightPx` in `StatusReportView.tsx` / `StatusReportDocument.tsx`).**

- [ ] **Step 4: Browser (after Task 5 if PDF is faster in the same sitting):** SNY.TV Modular Advanced — all five phase names visible; Design sign-offs stacked under the Design bar, not on a header rail.

---

### Task 5: PDF parity

**Files:**
- Modify: `components/pdf/StatusReportDocument.tsx`

Same geometry as Task 4: no rails, in-row pins, `Text` labels, `Svg`/`Line` leader, row `minHeight` from `timelinePinnedRowHeightPx`. `wrap={false}` or two-line max. Pass `contentHeightPx` into `statusReportTimelineSlotHeightPx` for Standard Advanced pages.

- [ ] **Step 1: Mirror HTML structure; no pointer handlers.**

- [ ] **Step 2: Confirm `layoutScale` / Modular chrome scale still applies through `scaleStatusReportTimelineMetrics` so `topPx` stored in **unscaled slide px** is multiplied when `layoutScale !== 1`. **Store offsets in unscaled metric space** (the numbers in the overlay match `getStatusReportTimelineMetrics` before scale). When rendering, multiply `topPx` by `layoutScale`. Document this in a one-line comment on the overlay field.**

If Modular HTML fill uses `layoutScale === 1` on a 1440 canvas, `topPx` is 1:1. If Standard uses `layoutScale === 1` on 720, 1:1. Only multiply when `scaleStatusReportTimelineMetrics` is applied.

---

### Task 6: Drag labels in Edit Arrange

**Files:**
- Modify: `components/StatusReportView.tsx` (`TimelineBlock` `interactive?: boolean`, `onLabelLayoutChange?: (id: string, box: PinnedLabelBox) => void`)
- Modify: `components/StatusReportsTab.tsx`
- Modify: `components/ArrangeScheduleFields.tsx` (remove rail toggle only; drag is on the chart)

**Interfaces:**
- Interactive only when `interactive === true`.
- On pointer down on a label: `setPointerCapture`, record start pointer + start box.
- On move: `topPx = max(barBottomPx, startTop + dy)`; `cxPct` from pointer x relative to chart width, clamped.
- On up: `onLabelLayoutChange(id, { cxPct, topPx })` → parent merges `markerLabelLayout` and `saveTimelineLayout`.
- Cursor `grab` / `grabbing`. Do not drag the pin.

- [ ] **Step 1: Unit-test the math, not the DOM**

```ts
export function movePinnedLabelBox(
  start: PinnedLabelBox,
  deltaXPct: number,
  deltaYPx: number,
  opts: { minTopPx: number; minCxPct: number; maxCxPct: number }
): PinnedLabelBox {
  return {
    cxPct: Math.min(opts.maxCxPct, Math.max(opts.minCxPct, start.cxPct + deltaXPct)),
    topPx: Math.max(opts.minTopPx, start.topPx + deltaYPx),
  };
}
```

Test: dragging down increases `topPx`; dragging up stops at `minTopPx`; `cxPct` clamps.

- [ ] **Step 2: FAIL then implement `movePinnedLabelBox`.**

- [ ] **Step 3: Wire TimelineBlock pointer handlers using that helper.**

- [ ] **Step 4: In `StatusReportsTab` edit form, when `editingReportId && scheduleSource === plan && planDensity !== phases && formTimeline`, render:**

```tsx
<TimelineBlock
  timeline={/* applyTimelineLayout(formTimeline, formTimelineLayout, maxRow) */}
  reportDate={/* editing report date */}
  scheduleSource="plan"
  planDensity={editingPlanDensity}
  fillAvailableHeight={formVariation === "Modular"}
  interactive
  labelOverlay={formTimelineLayout}
  onLabelLayoutChange={(id, box) =>
    saveTimelineLayout({
      ...formTimelineLayout,
      markerLabelLayout: { ...formTimelineLayout.markerLabelLayout, [id]: box },
    })
  }
  className="mt-2 max-h-[360px] overflow-auto"
/>
```

Use the same apply-overlay helper the preview uses so hide/rename/rows match. Modular fill in a 360px pane is OK for Arrange; published Modular still fills the module.

- [ ] **Step 5: Remove Top/Bottom rail button from `ArrangeScheduleFields`. Remove unused `markerRails` / `setTimelineLayoutMarkerRail` call sites. Keep left/right key-date move.**

- [ ] **Step 6: Browser:** Edit SNY.TV Modular Advanced → drag a Design sign-off under its neighbor → Design row grows → Save/reload Preview matches. Condensed preview unchanged.

---

### Task 7: Docs and leftover promoted tests

**Files:**
- Modify: `docs/TECHNICAL.md` (promoted rails → pinned labels + Arrange drag)
- Modify: leftover tests (`partitionPromotedTimelineMarkers` / rail overflow). Keep partition helpers if unused: **delete** `partitionPromotedTimelineMarkers`, `staggerPromotedMarkers` rail overflow, `PromotedDateRail`, `PromotedDateRailPdf`, and their tests if nothing else calls them.

- [ ] **Step 1: Grep `promoted`, `PromotedDateRail`, `markerRails`, `topBandPx` in app code (not `.worktrees`). Remove dead code.**

- [ ] **Step 2: Update TECHNICAL.md Advanced bullet to match the spec.**

- [ ] **Step 3: Run** `npx vitest run --exclude '.worktrees/**' __tests__/lib/statusReportTimelineLayout.test.ts __tests__/lib/plan/reportSchedule.test.ts __tests__/lib/statusReportFlags.test.ts`

Expected: PASS.

- [ ] **Step 4: Browser regression:** one Condensed Plan Modular (or Standard) report and one Project-timeline report — no pinned labels, no rails.

---

## Spec coverage

| Spec rule | Task |
| --- | --- |
| Pins on swimlane at real date + phase color | 4, 5 |
| Default downward stack | 2, 4 |
| Saved `{ cxPct, topPx }` | 1, 2, 6 |
| Row grows with lowest label | 2, 4, 6 |
| No rails / space back to phases | 3, 4, 5, 7 |
| Drag only in Edit Arrange | 6 |
| No date mutation / no horizontal pin drag | 6 |
| Condensed + Project timeline unchanged | 3, 7 |
| PDF matches offsets | 5 |
| Zod + prune | 1 |
