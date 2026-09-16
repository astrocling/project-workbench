# Modular Plan schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modular status reports can lock a compact Plan strip into `ganttTimeline` (with Arrange up to 16 rows) and optionally append the full Plan Gantt via the existing `includeDetailedPlan` extra pages.

**Architecture:** Reuse Standard/Milestones snapshot fields (`scheduleSource`, `planDensity`, window months, `includeDetailedPlan`, `timelineLayout`). Make Modular schedule-eligible in flags and create validation. Compact mapping gains a `lanePolicy` so Modular assigns one phase per row while Standard stays `% 4`. Layout overlay `clampRow` accepts a max so Modular Arrange can persist rows 5–16. Create passes Plan options into `buildStatusReportPdfData` (today Modular builds with an empty snapshot and always gets Timeline-tab bars).

**Tech Stack:** Next.js App Router, Prisma `StatusReport.snapshot` JSON (no schema change), Vitest, React client form (`StatusReportsTab`, `ArrangeScheduleFields`).

**Spec:** `docs/superpowers/specs/2026-09-16-modular-plan-schedule-design.md`

## Global Constraints

- No Prisma schema change.
- Do not replace or hide the Timeline tab.
- Do not silently overwrite old Modular snapshots (only create + Refresh schedule rebuild `timeline`).
- Standard/Milestones compact mapping stays `order % 4` (rows 1–4). Modular Plan compact mapping is one phase per row, cap 16 (`TIMELINE_FILL_ROW_MAX`).
- Extra pages reuse `includeDetailedPlan` + `PlanPrintDocument`; do not add a second snapshot field.
- Modular checkbox copy: **Add full project plan to report**. Standard copy stays **Include detailed plan page**.
- Refresh timeline still requires a placed `ganttTimeline` module (`shouldShowRefreshTimeline` / refresh route).
- Inverted Plan item dates still drop from compact mapping (no data-fix in this plan).
- This repo’s user rule: **do not git commit unless the user explicitly asks**. Skip every Commit step unless they ask.
- TDD: failing test first, then minimal implementation. DRY / YAGNI.

---

## File map

| File | Responsibility |
| --- | --- |
| `lib/plan/reportSchedule.ts` | `CompactLanePolicy`, `compactPlanToSchedule(..., options?)`, `compactLanePolicyForVariation`, `timelineLayoutMaxRow` |
| `lib/statusReportScheduleBuild.ts` | Pass `lanePolicy` into compact mapping |
| `lib/plan/reportScheduleErrors.ts` | `isPlanScheduleCreateRequest` true for Modular + plan |
| `lib/statusReportFlags.ts` | Modular is schedule-eligible; checkbox label; lock-timeline-on-create helper |
| `lib/statusReportTimelineLayout.ts` | `clampRow` / `setTimelineLayoutRow` / `applyTimelineLayout` take `maxRow` |
| `lib/statusReportPdfData.ts` | Modular Plan uses `onePhasePerRow`; overlay uses fill max |
| `app/api/projects/[id]/status-reports/route.ts` | Persist Plan fields on Modular create; lock compact timeline when Plan; rollback on empty Plan |
| `components/ArrangeScheduleFields.tsx` | Optional `maxRow` (default 4) |
| `components/StatusReportsTab.tsx` | Pass maxRow; Modular checkbox label |
| `docs/TECHNICAL.md` | Document Modular eligibility, 16-row Arrange, extra pages |
| Tests listed per task | |

`StatusReportView` / `StatusReportDocument` already render Modular fill TimelineBlock and `includeDetailedPlan` extra pages. No change unless a later task finds they ignore Plan `phaseId` bars (they should not).

---

### Task 1: Compact Plan lane policy

**Files:**
- Modify: `lib/plan/reportSchedule.ts`
- Test: `__tests__/lib/plan/reportSchedule.test.ts`

**Interfaces:**
- Consumes: existing `compactPlanToSchedule(phases, density)` default remains wrap-4
- Produces:

```ts
export type CompactLanePolicy = "wrap4" | "onePhasePerRow";

export function compactLanePolicyForVariation(
  variation: string
): CompactLanePolicy; // "Modular" → "onePhasePerRow", else "wrap4"

export function timelineLayoutMaxRow(variation: string): number;
// "Modular" → TIMELINE_FILL_ROW_MAX (16), else TIMELINE_RENDERABLE_ROW_MAX (4)

export function compactPlanToSchedule(
  phases: PlanPhaseJson[],
  density: PlanReportDensity,
  options?: { lanePolicy?: CompactLanePolicy }
): ReportScheduleSlice | null;
```

`onePhasePerRow` row index: `clamp(phase.order + 1, 1, TIMELINE_FILL_ROW_MAX)`. Default `lanePolicy` is `"wrap4"` (`(order % 4) + 1`). Markers use the same row as their phase.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/plan/reportSchedule.test.ts` (reuse existing `phase` / `item` helpers):

```ts
it("maps phase order 4 to row 5 when lanePolicy is onePhasePerRow", () => {
  const result = compactPlanToSchedule(
    [
      phase({
        id: "p2",
        name: "Deployment",
        order: 4,
        items: [item({ id: "i2", phaseId: "p2", label: "Task" })],
      }),
    ],
    "phases",
    { lanePolicy: "onePhasePerRow" }
  );
  expect(result?.bars[0]?.rowIndex).toBe(5);
});

it("still wraps order 4 onto row 1 by default", () => {
  const result = compactPlanToSchedule(
    [
      phase({
        id: "p2",
        name: "Deployment",
        order: 4,
        items: [item({ id: "i2", phaseId: "p2", label: "Task" })],
      }),
    ],
    "phases"
  );
  expect(result?.bars[0]?.rowIndex).toBe(1);
});

it("picks onePhasePerRow only for Modular", () => {
  expect(compactLanePolicyForVariation("Modular")).toBe("onePhasePerRow");
  expect(compactLanePolicyForVariation("Standard")).toBe("wrap4");
  expect(timelineLayoutMaxRow("Modular")).toBe(16);
  expect(timelineLayoutMaxRow("Standard")).toBe(4);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/plan/reportSchedule.test.ts`

Expected: FAIL — `compactPlanToSchedule` does not accept a third argument / order 4 is still row 1; helpers are not exported.

- [ ] **Step 3: Minimal implementation**

In `lib/plan/reportSchedule.ts`:

1. Move `TIMELINE_RENDERABLE_ROW_MIN/MAX` and `TIMELINE_FILL_ROW_MAX` **above** `phaseRowIndex` (they are currently below `compactPlanToSchedule`) so row helpers can use them.
2. Replace `phaseRowIndex(order)` with:

```ts
export type CompactLanePolicy = "wrap4" | "onePhasePerRow";

function phaseRowIndex(order: number, lanePolicy: CompactLanePolicy): number {
  if (lanePolicy === "onePhasePerRow") {
    return Math.min(
      TIMELINE_FILL_ROW_MAX,
      Math.max(TIMELINE_RENDERABLE_ROW_MIN, order + 1)
    );
  }
  return (order % 4) + 1;
}

export function compactLanePolicyForVariation(variation: string): CompactLanePolicy {
  return variation === "Modular" ? "onePhasePerRow" : "wrap4";
}

export function timelineLayoutMaxRow(variation: string): number {
  return variation === "Modular" ? TIMELINE_FILL_ROW_MAX : TIMELINE_RENDERABLE_ROW_MAX;
}
```

3. `compactPlanToSchedule` third arg default `{ lanePolicy: "wrap4" }`. Pass `lanePolicy` into both the bars `.map` and the markers `flatMap` (`const rowIndex = phaseRowIndex(phase.order, lanePolicy)`).

Keep the existing `"maps phase order to rowIndex with wrap at 4"` test passing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/plan/reportSchedule.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless the user asked)

```bash
git add lib/plan/reportSchedule.ts __tests__/lib/plan/reportSchedule.test.ts
git commit -m "feat: compact Plan one-phase-per-row lanes for Modular"
```

---

### Task 2: Schedule-eligible Modular flags and copy

**Files:**
- Modify: `lib/statusReportFlags.ts`
- Test: `__tests__/lib/statusReportFlags.test.ts`

**Interfaces:**
- Consumes: `isScheduleEligibleVariation` currently Standard | Milestones
- Produces:

```ts
export function isScheduleEligibleVariation(variation: StatusReportVariationLike): boolean;
// true for Standard | Milestones | Modular

export const ADD_FULL_PROJECT_PLAN_LABEL = "Add full project plan to report";

export function detailedPlanCheckboxLabel(variation: StatusReportVariationLike): string;
// Modular → ADD_FULL_PROJECT_PLAN_LABEL, else INCLUDE_DETAILED_PLAN_LABEL

export function shouldLockModularTimelineOnCreate(
  needsTimelineModule: boolean,
  scheduleSource: ScheduleSource | undefined
): boolean;
// true when needsTimelineModule || scheduleSource === "plan"
```

`shouldResetScheduleDefaultsOnVariationChange` needs no code change once Modular is eligible: CDA → Modular resets; Modular ↔ Standard/Milestones preserves. Tests must be updated to match.

- [ ] **Step 1: Write the failing tests**

Update `__tests__/lib/statusReportFlags.test.ts`:

```ts
describe("isScheduleEligibleVariation", () => {
  it("is true for Standard, Milestones, and Modular", () => {
    expect(isScheduleEligibleVariation("Standard")).toBe(true);
    expect(isScheduleEligibleVariation("Milestones")).toBe(true);
    expect(isScheduleEligibleVariation("Modular")).toBe(true);
    expect(isScheduleEligibleVariation("CDA")).toBe(false);
  });
});
```

Change `shouldResetScheduleDefaultsOnVariationChange`:

- Preserve Standard ↔ Milestones **and** Modular ↔ Standard/Milestones.
- Reset when entering any eligible variation from CDA (including Modular).
- Do not reset when leaving eligible → CDA.

```ts
it("preserves schedule choices among Standard, Milestones, and Modular", () => {
  expect(shouldResetScheduleDefaultsOnVariationChange("Standard", "Modular")).toBe(false);
  expect(shouldResetScheduleDefaultsOnVariationChange("Modular", "Milestones")).toBe(false);
});

it("reapplies defaults when entering an eligible variation from CDA", () => {
  expect(shouldResetScheduleDefaultsOnVariationChange("CDA", "Standard")).toBe(true);
  expect(shouldResetScheduleDefaultsOnVariationChange("CDA", "Modular")).toBe(true);
});
```

Delete or rewrite the old example that expected `Modular → Milestones === true`.

`buildScheduleSourceCreatePayload(true, "Modular", "timeline", "phases")` must equal `{ scheduleSource: "timeline" }` (today `{}`). Add:

```ts
expect(
  buildScheduleSourceCreatePayload(true, "Modular", "plan", "phases_and_key_dates")
).toEqual({
  scheduleSource: "plan",
  planDensity: "phases_and_key_dates",
});
```

New:

```ts
it("uses Modular copy for the detailed-plan checkbox", () => {
  expect(detailedPlanCheckboxLabel("Modular")).toBe("Add full project plan to report");
  expect(detailedPlanCheckboxLabel("Standard")).toBe("Include detailed plan page");
});

it("locks Modular timeline when Plan is selected even without a gantt module", () => {
  expect(shouldLockModularTimelineOnCreate(false, "plan")).toBe(true);
  expect(shouldLockModularTimelineOnCreate(false, "timeline")).toBe(false);
  expect(shouldLockModularTimelineOnCreate(true, "timeline")).toBe(true);
});
```

Leave `shouldShowRefreshTimeline("Modular", MODULAR_DEFAULT_DOCUMENT) === false` as-is.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/statusReportFlags.test.ts`

Expected: FAIL on Modular eligibility / payload / reset / missing helpers.

- [ ] **Step 3: Minimal implementation**

```ts
export function isScheduleEligibleVariation(
  variation: StatusReportVariationLike
): boolean {
  return (
    variation === "Standard" ||
    variation === "Milestones" ||
    variation === "Modular"
  );
}

export const ADD_FULL_PROJECT_PLAN_LABEL = "Add full project plan to report";

export function detailedPlanCheckboxLabel(
  variation: StatusReportVariationLike
): string {
  return variation === "Modular"
    ? ADD_FULL_PROJECT_PLAN_LABEL
    : INCLUDE_DETAILED_PLAN_LABEL;
}

export function shouldLockModularTimelineOnCreate(
  needsTimelineModule: boolean,
  scheduleSource: ScheduleSource | undefined
): boolean {
  return needsTimelineModule || scheduleSource === "plan";
}
```

Update the comment on `shouldResetScheduleDefaultsOnVariationChange` (it still mentions “Standard/Milestones from CDA/Modular”).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/statusReportFlags.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 3: Treat Modular Plan as a Plan-schedule create request

**Files:**
- Modify: `lib/plan/reportScheduleErrors.ts`
- Test: `__tests__/lib/plan/reportScheduleErrors.test.ts`

**Interfaces:**
- Consumes: `isPlanScheduleCreateRequest(variation, scheduleSource)`
- Produces: type predicate includes Modular:

```ts
export type PlanScheduleReportVariation = "Standard" | "Milestones" | "Modular";

export function isPlanScheduleCreateRequest(
  variation: PlanScheduleReportVariation | "CDA" | "Modular",
  scheduleSource?: ScheduleSource
): variation is PlanScheduleReportVariation {
  return (
    (variation === "Standard" ||
      variation === "Milestones" ||
      variation === "Modular") &&
    scheduleSource === "plan"
  );
}
```

If the union still lists `"Modular"` twice after widening `PlanScheduleReportVariation`, drop the extra `"Modular"` from the parameter union so it is just `PlanScheduleReportVariation | "CDA"`.

- [ ] **Step 1: Write the failing test**

Replace the existing `isPlanScheduleCreateRequest` example:

```ts
it("is true for Standard, Milestones, and Modular with scheduleSource plan", () => {
  expect(isPlanScheduleCreateRequest("Standard", "plan")).toBe(true);
  expect(isPlanScheduleCreateRequest("Milestones", "plan")).toBe(true);
  expect(isPlanScheduleCreateRequest("Modular", "plan")).toBe(true);
  expect(isPlanScheduleCreateRequest("Standard", "timeline")).toBe(false);
  expect(isPlanScheduleCreateRequest("CDA", "plan")).toBe(false);
  expect(isPlanScheduleCreateRequest("Modular", "timeline")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/plan/reportScheduleErrors.test.ts`

Expected: FAIL `Modular` + `plan` is still false.

- [ ] **Step 3: Minimal implementation** as in Interfaces.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/plan/reportScheduleErrors.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 4: Arrange overlay rows 1–16

**Files:**
- Modify: `lib/statusReportTimelineLayout.ts`
- Test: `__tests__/lib/statusReportTimelineLayout.test.ts`

**Interfaces:**
- Consumes: `clampRow` hardcoded 1–4; `setTimelineLayoutRow(rows, id, original, value)`; `applyTimelineLayout(timeline, layout)`
- Produces:

```ts
function clampRow(row: number, maxRow = 4): number | null {
  if (!Number.isInteger(row) || row < 1 || row > maxRow) return null;
  return row;
}

export function setTimelineLayoutRow(
  rows: Record<string, number> | undefined,
  id: string,
  original: number,
  value: number,
  maxRow = 4
): Record<string, number> | undefined;

export function applyTimelineLayout<T extends LayoutTimelineSlice>(
  timeline: T,
  layout?: TimelineLayoutOverlay | null,
  maxRow = 4
): T;
```

Default `maxRow` stays **4** so Standard Arrange and existing tests do not change.

- [ ] **Step 1: Write the failing tests**

In `__tests__/lib/statusReportTimelineLayout.test.ts`, keep the existing `setTimelineLayoutRow(undefined, "p1", 1, 9)` → `undefined` (default max 4). Add:

```ts
it("accepts row 5 when maxRow is 16", () => {
  expect(setTimelineLayoutRow(undefined, "p1", 1, 5, 16)).toEqual({ p1: 5 });
  expect(setTimelineLayoutRow(undefined, "p1", 1, 17, 16)).toBeUndefined();
});

it("applies row 5 overlay when maxRow is 16", () => {
  const next = applyTimelineLayout(
    timeline,
    { rows: { p1: 5 } },
    16
  );
  expect(next.bars.find((bar) => bar.phaseId === "p1")?.rowIndex).toBe(5);
});
```

Use a `phaseId: "p1"` bar already in the file’s `timeline` fixture. If that fixture has no `p1`, add a one-bar fixture in this test.

Default `applyTimelineLayout(timeline, { rows: { p1: 5 } })` must **not** move the bar to 5 (clamp rejects; keep original `rowIndex`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/statusReportTimelineLayout.test.ts`

Expected: FAIL — extra args ignored / row 5 rejected.

- [ ] **Step 3: Minimal implementation**

Thread `maxRow` through `clampRow` in `setTimelineLayoutRow` and both bar/marker maps in `applyTimelineLayout`. Do not change hide/rename/window behavior.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/statusReportTimelineLayout.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 5: Wire lane policy and overlay max into PDF data build

**Files:**
- Modify: `lib/statusReportScheduleBuild.ts` (`buildPlanTimelineCandidate`)
- Modify: `lib/statusReportPdfData.ts` (Plan candidate + `applyTimelineLayout`)
- Test: `__tests__/lib/statusReportScheduleBuild.test.ts`

**Interfaces:**
- Consumes: Task 1 `CompactLanePolicy`; Task 4 `applyTimelineLayout(..., maxRow)`
- Produces:

```ts
export function buildPlanTimelineCandidate(
  phases: PlanPhaseJson[],
  density: PlanReportDensity,
  axis: TimelineAxisInput,
  options?: { lanePolicy?: CompactLanePolicy }
): NonNullable<StatusReportSnapshot["timeline"]> | undefined;
```

Inside: `compactPlanToSchedule(phases, density, { lanePolicy: options?.lanePolicy ?? "wrap4" })`.

In `lib/statusReportPdfData.ts` around the existing `buildPlanTimelineCandidate(planJson.phases, density, axis)` call (~line 516):

```ts
timeline = buildPlanTimelineCandidate(planJson.phases, density, axis, {
  lanePolicy: compactLanePolicyForVariation(report.variation),
});
```

Around `applyTimelineLayout(timeline, snapshot?.timelineLayout)` (~line 553):

```ts
timeline = applyTimelineLayout(
  timeline,
  snapshot?.timelineLayout,
  timelineLayoutMaxRow(report.variation)
);
```

`includeDetailedPlan` / `detailedPlan` in this file are already variation-agnostic. No second flag.

- [ ] **Step 1: Write the failing test**

In `__tests__/lib/statusReportScheduleBuild.test.ts`, add a Plan assembly test (copy the existing dated-phase item shape from neighboring tests; set `order: 4`):

```ts
it("places Modular compact phases on their own rows", () => {
  const phases: PlanPhaseJson[] = [
    {
      id: "phase-deploy",
      planId: "plan-1",
      name: "Deployment",
      color: "#1941FA",
      order: 4,
      items: [
        {
          id: "t1",
          phaseId: "phase-deploy",
          type: "task",
          label: "Ship",
          startDate: "2026-03-01",
          endDate: "2026-03-10",
          order: 0,
          parentItemId: null,
          meetingStatus: null,
          scheduledTime: null,
        },
      ],
    },
  ];
  const wrapped = buildPlanTimelineCandidate(phases, "phases", axis);
  expect(wrapped?.bars[0]?.rowIndex).toBe(1);
  expect(wrapped?.bars[0]?.label).toBe("Deployment");

  const stacked = buildPlanTimelineCandidate(phases, "phases", axis, {
    lanePolicy: "onePhasePerRow",
  });
  expect(stacked?.bars[0]?.rowIndex).toBe(5);
  expect(stacked?.bars[0]?.label).toBe("Deployment");
});
```

This is the spec’s “Plan phase labels, not Timeline-tab labels” check at the mapping layer (PDF data only forwards this candidate).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/statusReportScheduleBuild.test.ts`

Expected: FAIL — `buildPlanTimelineCandidate` has no options argument.

- [ ] **Step 3: Minimal implementation** in `lib/statusReportScheduleBuild.ts` and the two `lib/statusReportPdfData.ts` call sites. Import `compactLanePolicyForVariation` and `timelineLayoutMaxRow` from `@/lib/plan/reportSchedule`.

Existing `buildPlanTimelineCandidate(phases, density, axis)` callers must keep wrapping.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/statusReportScheduleBuild.test.ts __tests__/lib/statusReportPdfData.test.ts __tests__/lib/plan/reportSchedule.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 6: Modular create snapshot (Plan source + optional extra pages)

**Files:**
- Modify: `app/api/projects/[id]/status-reports/route.ts`
- Test: `__tests__/lib/statusReportFlags.test.ts` (lock helper already in Task 2); no dedicated route test file exists — keep this task’s behavior specified so the route change is copy-pasteable.

**Interfaces:**
- Consumes: Task 2 `shouldLockModularTimelineOnCreate`; Task 3 `isPlanScheduleCreateRequest` (now true for Modular + plan); `buildStatusReportPdfData`; `isValidPlanTimeline`; `resolvePlanScheduleEmptyError`; `rollbackCreatedStatusReport`
- Produces: Modular POST snapshot may include `scheduleSource`, `planDensity`, `timelinePreviousMonths`, `timelineLookaheadMonths`, `includeDetailedPlan`, and compact `timeline` when Plan is selected.

**Current bug:** Modular create calls `buildStatusReportPdfData(id, report.id)` with **no options** and **no schedule fields on snapshot yet**, so `resolveScheduleSource` is always `timeline`.

Replace the Modular snapshot block after `prisma.statusReport.create` (~lines 237–288) with this behavior (keep period/today and budget/plan-list locking as they are):

```ts
const needsBudget = modularNeedsBudget(panelsDoc);
const needsTimelineModule = modularNeedsTimeline(panelsDoc);
const needsPlanLists = modularNeedsPlanLists(panelsDoc);
const lockTimeline = shouldLockModularTimelineOnCreate(
  needsTimelineModule,
  parsed.data.scheduleSource
);
let snapshot: StatusReportSnapshot = {
  period: periodStr,
  today: todayStr,
};

if (needsBudget || lockTimeline || needsPlanLists || usePlanSchedule) {
  try {
    const pdfData = await buildStatusReportPdfData(id, report.id, {
      timelinePreviousMonths: parsed.data.timelinePreviousMonths,
      ...(usePlanSchedule
        ? {
            scheduleSource: "plan" as const,
            planDensity: parsed.data.planDensity,
            timelineLookaheadMonths: parsed.data.timelineLookaheadMonths,
            includeDetailedPlan: parsed.data.includeDetailedPlan === true,
          }
        : {}),
    });
    if (usePlanSchedule && !isValidPlanTimeline(pdfData?.timeline)) {
      const planError = resolvePlanScheduleEmptyError(parsed.data.planDensity);
      const rollback = await rollbackCreatedStatusReport(
        async (reportId) => {
          await prisma.statusReport.delete({ where: { id: reportId } });
        },
        report.id
      );
      if (!rollback.ok) {
        return NextResponse.json(
          { error: PLAN_CREATE_ROLLBACK_FAILED_ERROR },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: planError }, { status: 400 });
    }
    if (pdfData) {
      if (needsBudget) snapshot.budget = pdfData.budget;
      if (lockTimeline) snapshot.timeline = pdfData.timeline;
      if (needsPlanLists) {
        snapshot = mergePlanListsIntoSnapshot(snapshot, {
          planMeetings: pdfData.planMeetings ?? { needsScheduling: [], scheduled: [] },
          planActivitiesCompleted: pdfData.planActivitiesCompleted ?? {
            items: [],
            overflowCount: 0,
          },
          planActivitiesUpcoming: pdfData.planActivitiesUpcoming ?? {
            items: [],
            overflowCount: 0,
          },
        });
      }
    }
  } catch (buildError) {
    if (usePlanSchedule) {
      console.error("Failed to build Modular Plan snapshot after create:", buildError);
      const rollback = await rollbackCreatedStatusReport(
        async (reportId) => {
          await prisma.statusReport.delete({ where: { id: reportId } });
        },
        report.id
      );
      if (!rollback.ok) {
        return NextResponse.json(
          { error: PLAN_CREATE_ROLLBACK_FAILED_ERROR },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: PLAN_CREATE_BUILD_FAILED_ERROR }, { status: 500 });
    }
    console.error(
      "Failed to build Modular budget/timeline/plan-list snapshot after create:",
      buildError
    );
  }
}

if (usePlanSchedule) {
  snapshot = {
    ...snapshot,
    scheduleSource: "plan",
    planDensity: parsed.data.planDensity ?? "phases_and_key_dates",
    timelinePreviousMonths: parsed.data.timelinePreviousMonths,
    timelineLookaheadMonths: parsed.data.timelineLookaheadMonths ?? 2,
    includeDetailedPlan: parsed.data.includeDetailedPlan === true,
  };
} else if (parsed.data.scheduleSource === "timeline") {
  snapshot = {
    ...snapshot,
    scheduleSource: "timeline",
    timelinePreviousMonths: parsed.data.timelinePreviousMonths,
  };
}

await prisma.statusReport.update({
  where: { id: report.id },
  data: { snapshot: snapshot as Prisma.InputJsonValue },
});
```

Notes for the implementer:

- Import `shouldLockModularTimelineOnCreate` from `@/lib/statusReportFlags`.
- Import `isValidPlanTimeline` from `@/lib/statusReportScheduleBuild` if not already imported.
- `usePlanSchedule` is already computed **before** create and already runs `validatePlanScheduleCreateEligibility` — that now fires for Modular Plan (Task 3).
- Timeline-source + no gantt module: `lockTimeline` is false → do **not** write `snapshot.timeline`. Still write `scheduleSource: "timeline"` when the client sent it (Task 2 payload).
- Only persist `scheduleSource: "timeline"` when the create payload actually includes it (Plan enabled). If `parsed.data.scheduleSource` is undefined (Plan off), omit those fields (old Modular).
- Do not duplicate Standard’s non-Modular branch.

- [ ] **Step 1: Confirm eligibility is already gated**

Re-read `usePlanSchedule` at ~line 193. After Task 3 it is true for Modular + plan. No extra `if (variation === "Modular")` bypass.

- [ ] **Step 2: Implement the Modular snapshot block** as above.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --pretty false`

Expected: no errors in the create route.

- [ ] **Step 4: Regression tests**

Run: `npx vitest run __tests__/lib/statusReportFlags.test.ts __tests__/lib/plan/reportScheduleErrors.test.ts __tests__/lib/statusReportScheduleBuild.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 7: Form UI — Arrange cap and Modular checkbox copy

**Files:**
- Modify: `components/ArrangeScheduleFields.tsx`
- Modify: `components/StatusReportsTab.tsx`
- Test: none new (logic covered in Tasks 2 and 4). Smoke by reading the form gates: `isScheduleEligibleVariation(formVariation)` already wraps source/density/window/checkbox/Arrange.

**Interfaces:**
- Consumes: `timelineLayoutMaxRow`, `detailedPlanCheckboxLabel`, `setTimelineLayoutRow(..., maxRow)`, `applyTimelineLayout(..., maxRow)`
- Produces: `ArrangeScheduleFields` optional `maxRow?: number` default `TIMELINE_RENDERABLE_ROW_MAX` (4).

- [ ] **Step 1: Extend ArrangeScheduleFields**

Add `maxRow = TIMELINE_RENDERABLE_ROW_MAX` to props.

```ts
type ArrangeScheduleFieldsProps = {
  timeline: NonNullable<StatusReportPDFData["timeline"]>;
  layout: TimelineLayoutOverlay;
  onChange: (next: TimelineLayoutOverlay) => void;
  disabled?: boolean;
  maxRow?: number;
};
```

Use `const rowMax = maxRow ?? TIMELINE_RENDERABLE_ROW_MAX`.

- `applyTimelineLayout(timeline, layout, rowMax)`
- `setTimelineLayoutRow(..., target, rowMax)` for both bar and marker drops
- Replace `Array.from({ length: TIMELINE_RENDERABLE_ROW_MAX - TIMELINE_RENDERABLE_ROW_MIN + 1 }, ...)` with `rowMax`.

- [ ] **Step 2: StatusReportsTab wiring**

Import `timelineLayoutMaxRow` from `@/lib/plan/reportSchedule` and `detailedPlanCheckboxLabel` from flags.

Checkbox label:

```tsx
{detailedPlanCheckboxLabel(formVariation)}
```

Arrange:

```tsx
<ArrangeScheduleFields
  timeline={formTimeline}
  layout={formTimelineLayout}
  maxRow={timelineLayoutMaxRow(formVariation)}
  onChange={(next) => {
    void saveTimelineLayout(next);
  }}
/>
```

No other form-gate changes: once Task 2 lands, Modular already shows source/density/window/checkbox/Arrange.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --pretty false`

Expected: PASS

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 8: TECHNICAL.md

**Files:**
- Modify: `docs/TECHNICAL.md` sections *Plan schedule on status reports* (~554–562) and *Modular status reports* create snapshot (~583)

**Interfaces:** none

- [ ] **Step 1: Update docs** with these facts (do not invent APIs):

- Schedule-eligible variations: **Standard, Milestones, Modular**.
- Compact mapping: `compactPlanToSchedule` `lanePolicy` `wrap4` (Standard/Milestones) vs `onePhasePerRow` (Modular, rows 1–`TIMELINE_FILL_ROW_MAX`).
- Arrange: Standard 4 rows; Modular Plan `maxRow` 16 via `applyTimelineLayout` / `setTimelineLayoutRow`.
- Modular create locks compact `timeline` when Plan is selected even without a gantt module; Refresh still requires the module.
- Checkbox: Modular **Add full project plan to report** (`includeDetailedPlan`); extra pages still `PlanPrintDocument` after 16:9 slides.
- API line that says create schedule fields are for Standard/Milestones only: include Modular.

- [ ] **Step 2: Skim spec vs docs** — every spec “Docs” bullet is covered.

- [ ] **Step 3: Commit** (skip unless asked)

---

### Task 9: Full regression

**Files:** none new

- [ ] **Step 1: Run the schedule-related Vitest files**

```bash
npx vitest run \
  __tests__/lib/plan/reportSchedule.test.ts \
  __tests__/lib/plan/reportScheduleErrors.test.ts \
  __tests__/lib/statusReportFlags.test.ts \
  __tests__/lib/statusReportTimelineLayout.test.ts \
  __tests__/lib/statusReportScheduleBuild.test.ts \
  __tests__/lib/statusReportPdfData.test.ts
```

Expected: PASS

- [ ] **Step 2: Manual checks (when implementing in app)**

1. Plan-enabled project, new **Modular** report, schedule source **Project Plan**, place `ganttTimeline`: preview bars use Plan phase names (not Timeline-tab labels); more than 4 phases stack, they do not wrap onto row 1.
2. Uncheck/check **Add full project plan to report**: extra landscape Gantt appears after the 16:9 page(s); meeting notes stay last.
3. Edit Arrange: drag a phase to row 5, save, reload — it stays on row 5.
4. Create Modular Plan **without** gantt module: create succeeds (if Plan has dated phases); Refresh schedule stays hidden until the module is placed; adding the module + refresh shows the locked Plan strip.
5. Old Modular report with no `scheduleSource`: still Timeline-tab bars; no silent Plan overwrite.
6. Standard Plan report still wraps phase `order` 4 onto row 1; Arrange rejects row 5.

- [ ] **Step 3: Commit** (skip unless asked)

---

## Self-review (spec coverage)

| Spec requirement | Task |
| --- | --- |
| Modular is schedule-eligible | 2 |
| Plan selected → compact Plan on `ganttTimeline` | 5 + 6 |
| Timeline selected → Timeline tab | 6 (`lockTimeline` only if module) |
| Density + lookback/lookahead lock at create | 2 (fields show) + 6 (persist) |
| Arrange hide/rename, one phase per row, cap 16 | 1 + 4 + 7 |
| `includeDetailedPlan` extra pages, Modular copy | 2 + 6 + 7 |
| Refresh requires module; locked source; Plan disabled 400 | 2 (existing refresh tests) + 3 (create eligibility); refresh route already uses `resolveScheduleSource` |
| Lock compact timeline on Modular Plan create even without module | 2 helper + 6 |
| `clampRow` Standard 1–4 vs Modular 1–16 | 4 + 5 pdf overlay |
| `compactPlanToSchedule` lanePolicy; order 4 → row 5 | 1 |
| `isPlanScheduleCreateRequest("Modular", "plan")` | 3 |
| Empty Plan 400 on Modular create | 6 |
| No schema change / no CDA / no inverted-date fixer | constraints |
| TECHNICAL.md | 8 |

No remaining spec gaps. Placeholder scan: none. Names are consistent (`lanePolicy`, `maxRow`, `shouldLockModularTimelineOnCreate`, `detailedPlanCheckboxLabel`, `timelineLayoutMaxRow`).
