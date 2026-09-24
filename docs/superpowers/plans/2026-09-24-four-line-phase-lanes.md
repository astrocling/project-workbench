# Four-line Plan Advanced lanes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan Advanced charts use at most four occupied swimlanes (wrap 5→1), names on bars, no left column, no inner timeline scroll, leaders from the pin bottom, and Edit bar-drag plus 1–4 to set `timelineLayout.rows`.

**Architecture:** Reuse `timelineLayout.rows[phaseId]` (1–4). Advanced density always uses wrap4 and `TIMELINE_RENDERABLE_ROW_MAX` (4); Condensed Modular keeps `onePhasePerRow` / fill max 16. Metrics drop Advanced fill `labelColPx`. Pure helpers for pin-bottom Y and mapping pointer Y to a line. HTML/PDF `TimelineBlock` share geometry; bar drag only when `interactive`.

**Tech Stack:** TypeScript, React, react-pdf, Vitest, existing `StatusReport.snapshot.timelineLayout` JSON (no Prisma).

**Spec:** `docs/superpowers/specs/2026-09-24-four-line-phase-lanes-design.md`

## Global Constraints

- Condensed Plan (`planDensity: "phases"`) and `scheduleSource: "timeline"` metrics/render stay as they are today (Modular Condensed still `onePhasePerRow`).
- Do not change Plan item dates. Pins and phase bars do not drag horizontally.
- Preview / Present / PDF are not interactive.
- No Prisma schema change. Overlay is JSON on `StatusReport.snapshot.timelineLayout`.
- Overlapping phases on the same line both draw.
- Unused lines omitted; extra key-date names clip (`overflow: hidden`), not chart scroll.
- TDD: failing test first, then minimal implementation.
- Do not edit this plan file while implementing.
- This repo’s user rule: do not git commit unless the user explicitly asks. **SDD exception:** per-task commits on `feat/modular-plan-schedule` are allowed so review-package has SHAs.

## File map

| File | Responsibility |
| --- | --- |
| `lib/plan/reportSchedule.ts` | wrap4 vs onePhasePerRow; `timelineLayoutMaxRow(variation, planDensity?)` |
| `lib/statusReportPdfData.ts` + API create/refresh | pass density into policy / maxRow |
| `lib/statusReportTimelineLayout.ts` | Advanced fill `labelColPx: 0`; pin-bottom + line-from-offset helpers |
| `__tests__/lib/plan/reportSchedule.test.ts` | wrap default, Advanced Modular max 4 |
| `__tests__/lib/statusReportTimelineLayout.test.ts` | metrics, helpers |
| `components/StatusReportView.tsx` | no left rail, leader y1, clip, bar drag |
| `components/pdf/StatusReportDocument.tsx` | leader y1, in-bar names, no left rail |
| `components/ArrangeScheduleFields.tsx` | 1–4 control |
| `components/StatusReportsTab.tsx` | `onPhaseRowChange`, `maxRow` with density, drop `overflow-auto` on the live chart |
| `docs/TECHNICAL.md` | Advanced packing + on-bar names |

---

### Task 1: Advanced wrap4 and max row 4

**Files:**
- Modify: `lib/plan/reportSchedule.ts`
- Modify: `lib/statusReportPdfData.ts`
- Modify: `lib/statusReportScheduleBuild.ts` (only if it chooses policy without density)
- Modify: `components/StatusReportsTab.tsx` (`timelineLayoutMaxRow(formVariation)` call sites)
- Modify: `app/api/projects/[id]/status-reports/route.ts`
- Modify: `app/api/projects/[id]/status-reports/[reportId]/refresh-timeline/route.ts`
- Test: `__tests__/lib/plan/reportSchedule.test.ts`

**Interfaces:**
- Consumes: existing `CompactLanePolicy`, `PlanReportDensity`
- Produces:

```ts
export function compactLanePolicyForVariation(
  variation: string,
  planDensity?: PlanReportDensity | null
): CompactLanePolicy {
  if (planDensity != null && planDensity !== "phases") return "wrap4";
  return variation === "Modular" ? "onePhasePerRow" : "wrap4";
}

export function timelineLayoutMaxRow(
  variation: string,
  planDensity?: PlanReportDensity | null
): number {
  if (planDensity != null && planDensity !== "phases") return TIMELINE_RENDERABLE_ROW_MAX;
  return variation === "Modular" ? TIMELINE_FILL_ROW_MAX : TIMELINE_RENDERABLE_ROW_MAX;
}
```

When `planDensity` is omitted, keep today’s variation-only behavior so Condensed-unaware callers stay safe. All **report** call sites that know density **must** pass `report.planDensity` / `formPlanDensity`.

- [ ] **Step 1: Write the failing tests**

In `__tests__/lib/plan/reportSchedule.test.ts` keep the existing Modular-without-density assertion. Add:

```ts
it("uses wrap4 and max row 4 for Advanced on Modular and Standard", () => {
  expect(compactLanePolicyForVariation("Modular", "phases_and_key_dates")).toBe("wrap4");
  expect(compactLanePolicyForVariation("Standard", "phases_and_key_dates")).toBe("wrap4");
  expect(timelineLayoutMaxRow("Modular", "phases_and_key_dates")).toBe(4);
  expect(timelineLayoutMaxRow("Standard", "phases_and_key_dates")).toBe(4);
});

it("keeps onePhasePerRow and fill max for Condensed Modular", () => {
  expect(compactLanePolicyForVariation("Modular", "phases")).toBe("onePhasePerRow");
  expect(timelineLayoutMaxRow("Modular", "phases")).toBe(16);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --exclude '.worktrees/**' __tests__/lib/plan/reportSchedule.test.ts`
Expected: FAIL — extra args ignored, Modular Advanced still onePhasePerRow / 16.

- [ ] **Step 3: Implement the two functions; thread density at call sites**

`lib/statusReportPdfData.ts`: `compactLanePolicyForVariation(report.variation, resolvePlanDensity(...))` and `timelineLayoutMaxRow(report.variation, density)`.

`StatusReportsTab.tsx`: `timelineLayoutMaxRow(formVariation, formPlanDensity)`.

API create + refresh-timeline: pass the report’s resolved plan density into `timelineLayoutMaxRow`.

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run --exclude '.worktrees/**' __tests__/lib/plan/reportSchedule.test.ts __tests__/lib/statusReportScheduleBuild.test.ts`
Expected: PASS. Update any test that assumed Advanced Modular is onePhasePerRow **without** passing `lanePolicy` explicitly.

- [ ] **Step 5: Commit** (SDD)

```bash
git add lib/plan/reportSchedule.ts lib/statusReportPdfData.ts lib/statusReportScheduleBuild.ts \
  components/StatusReportsTab.tsx \
  app/api/projects/[id]/status-reports/route.ts \
  app/api/projects/[id]/status-reports/[reportId]/refresh-timeline/route.ts \
  __tests__/lib/plan/reportSchedule.test.ts __tests__/lib/statusReportScheduleBuild.test.ts
git commit -m "Use wrap4 and four lanes for Plan Advanced Modular."
```

---

### Task 2: Drop Advanced fill label column

**Files:**
- Modify: `lib/statusReportTimelineLayout.ts` (`PLAN_ADVANCED_FILL_TIMELINE_METRICS.labelColPx`)
- Test: `__tests__/lib/statusReportTimelineLayout.test.ts` (the example that expects `filled.labelColPx` **240**)

**Interfaces:**
- Produces: Advanced fill `labelColPx === 0`. Condensed fill stays `112`. HTML already paints in-bar names when `!(fillAvailableHeight && labelCol > 0)`.

- [ ] **Step 1: Change the existing assertion to 0 and run it (RED)**

In `"uses pinned mode for Plan Advanced..."`:

```ts
expect(filled.labelColPx).toBe(0);
```

Run: `npx vitest run --exclude '.worktrees/**' __tests__/lib/statusReportTimelineLayout.test.ts -t "uses pinned mode for Plan Advanced"`
Expected: FAIL received 240.

- [ ] **Step 2: Set `labelColPx: 0` on `PLAN_ADVANCED_FILL_TIMELINE_METRICS`.**

Do not change `PLAN_FILL_TIMELINE_METRICS` (Condensed Modular rail).

- [ ] **Step 3: Re-run the file**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "Put Advanced Modular phase names on bars, not a left rail."
```

---

### Task 3: Leader from pin bottom

**Files:**
- Modify: `lib/statusReportTimelineLayout.ts`
- Modify: `components/StatusReportView.tsx` (replace `pinCenterY`)
- Modify: `components/pdf/StatusReportDocument.tsx` (same)
- Test: `__tests__/lib/statusReportTimelineLayout.test.ts`

**Interfaces:**
- Produces:

```ts
export function timelinePinnedPinBottomY(metrics: {
  markerTopPx: number;
  markerIconPx: number;
}): number {
  return metrics.markerTopPx + metrics.markerIconPx;
}
```

HTML/PDF leader `y1={timelinePinnedPinBottomY(metrics)}` (already in scaled metrics). Do not use `markerIconPx / 2`.

- [ ] **Step 1: Failing test**

```ts
it("attaches pinned leaders at the pin icon bottom", () => {
  expect(timelinePinnedPinBottomY({ markerTopPx: 16, markerIconPx: 8 })).toBe(24);
});
```

- [ ] **Step 2: Implement helper; wire both TimelineBlocks.**

- [ ] **Step 3: Run** `npx vitest run --exclude '.worktrees/**' __tests__/lib/statusReportTimelineLayout.test.ts` — PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "Start key-date leaders at the pin icon bottom."
```

---

### Task 4: Clip lines; no timeline inner scroll

**Files:**
- Modify: `components/StatusReportView.tsx` (row already `overflow-hidden`; remove inner `overflow-auto` / `min-h-0` that creates a scrollbar on the Advanced chart body; keep page-level preview scroll)
- Modify: `components/StatusReportsTab.tsx` — live Arrange chart `className="mt-2 max-h-[360px] overflow-auto"` **must not** be the published behavior; for Advanced Plan use `className="mt-2"` without overflow-auto (page can still scroll). Published `StatusReportView` modules: no `overflow-auto` on the timeline chart itself.
- Modify: `components/pdf/StatusReportDocument.tsx` only if a row `overflow` is missing (clip labels).

**Interfaces:**
- Occupied rows still `flexGrow` leftover **inside** the module; `overflow: hidden` on each row. Do not `flexShrink` below min bar+pin band if it would clip the **bar**; clip **labels** below the pin band.

- [ ] **Step 1:** Confirm published Modular timeline wrapper is `flex flex-col min-h-0` without `overflow-auto` on the chart. Remove `overflow-auto` from the Edit `TimelineBlock` className.

- [ ] **Step 2:** Grep `TimelineBlock` / `data-timeline-row-chart` parents for `overflow-auto`. Only the Edit embed was specified; do not strip `StatusReportPreview` page scroll.

- [ ] **Step 3:** No new unit test required for CSS. Self-check: Advanced fill rows use `overflow-hidden`.

- [ ] **Step 4: Commit**

```bash
git commit -m "Clip Advanced swimlanes instead of scrolling the timeline."
```

---

### Task 5: Arrange 1–4 line control

**Files:**
- Modify: `components/ArrangeScheduleFields.tsx`
- Modify: `lib/statusReportTimelineLayout.ts` only if you add `setArrangePhaseRow` — prefer existing `setTimelineLayoutRow(layout.rows, phaseId, currentRow, nextRow, 4)` then `{ ...layout, rows }`.
- Test: `__tests__/lib/statusReportTimelineLayout.test.ts` if you add a small wrapper; otherwise rely on `setTimelineLayoutRow` tests with `maxRow = 4`.

**Interfaces:**
- For each visible phase, render four buttons labeled `1` `2` `3` `4`. Active line is `displayRow` / overlay. `disabled` when `disabled` prop. Keep hide, rename, up/down, key-date left/right.

```tsx
{[1, 2, 3, 4].map((line) => (
  <button
    key={line}
    type="button"
    aria-label={`Place phase on line ${line}`}
    aria-pressed={currentRow === line}
    disabled={disabled}
    onClick={() =>
      onChange({
        ...layout,
        rows: setTimelineLayoutRow(layout.rows, phaseId!, currentRow, line, 4),
      })
    }
  >
    {line}
  </button>
))}
```

`currentRow` is the group’s display row (already computed in `groupArrangeSchedule`). Use `rowMax` of 4 when `rowMax >= 4` for this control (Advanced callers pass 4 after Task 1). If `rowMax > 4` (Condensed Modular Arrange), **do not show 1–4**; keep up/down only so Condensed can still use rows 5–16.

- [ ] **Step 1:** Add a unit test that `setTimelineLayoutRow(..., 4)` writes `{ p1: 3 }` when original is 1.

Already exists at original `1` → `3`. Add:

```ts
it("places a phase on an explicit line 1-4", () => {
  expect(setTimelineLayoutRow({ p1: 1 }, "p1", 1, 2, 4)).toEqual({ p1: 2 });
});
```

- [ ] **Step 2:** Implement the buttons when `rowMax <= 4`.

- [ ] **Step 3:** Run layout tests — PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "Add Arrange 1-4 controls for Advanced phase lines."
```

---

### Task 6: Drag phase bars on the Edit chart

**Files:**
- Modify: `lib/statusReportTimelineLayout.ts`
- Modify: `components/StatusReportView.tsx` (`TimelineBlock`: `onPhaseRowChange?: (phaseId: string, row: number) => void`)
- Modify: `components/StatusReportsTab.tsx`
- Test: `__tests__/lib/statusReportTimelineLayout.test.ts`

**Interfaces:**
- Produces:

```ts
/** Map Y in the chart body to a line 1–maxRow (equal bands of the body height). */
export function timelineLineFromPointerY(
  offsetY: number,
  bodyHeightPx: number,
  maxRow = 4
): number {
  if (bodyHeightPx <= 0) return 1;
  const t = Math.min(Math.max(offsetY, 0), bodyHeightPx - 1);
  return Math.min(maxRow, Math.max(1, Math.floor((t / bodyHeightPx) * maxRow) + 1));
}
```

Interactive only: `onPointerDown` on the **bar** div (`phaseId` required), `setPointerCapture`, on up compute `offsetY` relative to `[data-timeline-chart-body]` and `onPhaseRowChange(phaseId, line)`. Do not start a bar drag if the event target is a key-date label. Threshold ~3px like labels. `pointercancel` discards.

Parent:

```tsx
onPhaseRowChange={(phaseId, row) =>
  saveTimelineLayout({
    ...formTimelineLayout,
    rows: setTimelineLayoutRow(
      formTimelineLayout.rows,
      phaseId,
      /* original snapshot row */ formTimeline.bars.find((b) => b.phaseId === phaseId)?.rowIndex ?? 1,
      row,
      4
    ),
  })
}
```

If `setTimelineLayoutRow` deletes the key when `value === original`, dragging back to the default wrap row clears the override — that is correct.

- [ ] **Step 1: Failing tests**

```ts
it("maps pointer Y to lines 1-4", () => {
  expect(timelineLineFromPointerY(0, 100, 4)).toBe(1);
  expect(timelineLineFromPointerY(26, 100, 4)).toBe(2);
  expect(timelineLineFromPointerY(99, 100, 4)).toBe(4);
  expect(timelineLineFromPointerY(-10, 100, 4)).toBe(1);
});
```

- [ ] **Step 2: Implement helper + bar handlers. Add `data-timeline-chart-body` on the rows container.**

- [ ] **Step 3: Run layout tests — PASS.**

- [ ] **Step 4: Browser (if app running):** Edit SNY.TV Modular Advanced — five phases on four lines, no chart scrollbar, names on bars, drag Design onto Kickoff’s line, 1–4 buttons, leader from pin bottom. Condensed Modular unchanged.

- [ ] **Step 5: Commit**

```bash
git commit -m "Drag Advanced phase bars between four Edit chart lines."
```

---

### Task 7: TECHNICAL.md

**Files:**
- Modify: `docs/TECHNICAL.md` Advanced / compact mapping / Arrange bullets (around the pinned-layout and `lanePolicy` paragraphs)

- [ ] **Step 1:** Replace onePhasePerRow-for-all-Modular with: Advanced = wrap4, max 4, names on bars, clip not scroll, Arrange 1–4 + Edit bar drag. Condensed Modular still onePhasePerRow. Leader from pin bottom.

- [ ] **Step 2:** Grep `onePhasePerRow` in `docs/TECHNICAL.md` and app code (not `.worktrees`) for leftover Advanced+16 claims.

- [ ] **Step 3: Commit**

```bash
git commit -m "Document four-line Advanced lanes and on-bar phase names."
```

---

## Spec coverage

| Spec rule | Task |
| --- | --- |
| Max 4 lines Advanced Standard+Modular | 1 |
| Wrap 1,2,3,4,5→1 | 1 |
| Condensed Modular unchanged | 1, 5 |
| Occupied-only lines | existing `getActiveTimelineRows` |
| Overlap both draw | existing row render |
| `rows` overlay | 5, 6 |
| No left column / names on bars | 2 |
| Leader pin bottom | 3 |
| No timeline scroll / clip | 4 |
| Arrange 1–4 | 5 |
| Edit bar drag | 6 |
| Preview/PDF read-only | 6 (no handlers unless interactive) |
| Docs | 7 |
