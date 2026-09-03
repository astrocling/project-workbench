# Plan Beta Gate and Report Schedule Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the Plan tab per project (Admin-only enable) and let Standard/Milestones status reports snapshot a compact Plan-derived schedule instead of the legacy Timeline tab, without replacing Timeline.

**Architecture:** `Project.planEnabled` / `planReportDefault` replace env/email flags. Plan APIs 404 when the project flag is off. Compact mapping (`lib/plan/reportSchedule.ts`) turns phases and key-date items into the existing `snapshot.timeline` bars/markers shape. Status report create/refresh pass `scheduleSource`; `TimelineBlock` is unchanged.

**Tech Stack:** Next.js App Router, Prisma 7 / PostgreSQL, Zod, Vitest, existing StatusReportsTab / PlanTab patterns.

## Global Constraints

- No View/Edit mode on the Plan tab; editors use `canEdit` in place.
- Only Admins may set `planEnabled`. Non-admin PATCH that includes `planEnabled` returns 403 and applies no fields.
- Anyone who can open a project with `planEnabled === true` sees the Plan tab.
- Timeline tab stays. CDA and Modular reports do not gain Plan schedule in this slice.
- Compact Plan never includes nested tasks, `waiting_on_client` bars, assumed meetings, or assumptions.
- `rowIndex` is 1–4: `(phase.order % 4) + 1`. Bar `color` is always `null`.
- Marker shapes: milestone `Pin`, sign_off `ThumbsUp`, hard_deadline `BadgeAlert`, scheduled meeting `Rocket`.
- Follow TDD for lib helpers. UI follows existing StatusReportsTab / Settings Toggle patterns.
- Spec: `docs/superpowers/specs/2026-09-03-plan-beta-and-status-reports-design.md`

## File map

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | `PlanReportDefault` enum; `Project.planEnabled`, `Project.planReportDefault`. |
| `lib/plan/feature.ts` | Project-flag gate for Plan APIs (replace env/allowlist). |
| `lib/plan/projectSettingsPatch.ts` | Admin-only `planEnabled` fail-closed check. |
| `lib/plan/reportSchedule.ts` | Compact Plan → report bars/markers. |
| `lib/statusReportPdfData.ts` | Snapshot `scheduleSource` / `planDensity`; build timeline from Plan when chosen. |
| `app/api/projects/[id]/route.ts` | PATCH `planEnabled` / `planReportDefault`. |
| `app/api/projects/[id]/plan/**` | Use project-id gate after resolve. |
| `app/api/projects/[id]/status-reports/route.ts` | Accept schedule fields on create; persist on snapshot. |
| `app/api/projects/[id]/status-reports/[reportId]/refresh-timeline/route.ts` | Rebuild from Plan when snapshot source is plan. |
| `components/ProjectSettingsTab.tsx` | Admin Enable Plan toggle. |
| `components/PlanTab.tsx` | Default for new reports. |
| `components/StatusReportsTab.tsx` | Schedule source + density + refresh copy. |
| `app/(app)/projects/[slug]/page.tsx` | `planEnabled` from project, not env. |
| `docs/USER_GUIDE.md`, `docs/TECHNICAL.md` | User/dev docs; remove `PLAN_FEATURE_*`. |

---

### Task 1: Schema — Plan beta fields on Project

**Files:**
- Modify: `prisma/schema.prisma` (`Project` model, near `cdaEnabled`)
- Create: `prisma/migrations/YYYYMMDDHHMMSS_add_project_plan_beta/migration.sql` via Prisma

**Interfaces:**
- Consumes: existing `Project` model
- Produces: `planEnabled: Boolean`, `planReportDefault: PlanReportDefault`

- [ ] **Step 1: Add enum and fields to schema**

After `enum ProjectStatus`, add:

```prisma
enum PlanReportDefault {
  timeline
  plan
}
```

On `model Project`, after `cdaReportHoursOnly`:

```prisma
  /// Show Plan tab (beta schedule builder). Admin-only to change.
  planEnabled Boolean @default(false)
  /// Prefill for new Standard/Milestones reports: legacy Timeline vs compact Plan.
  planReportDefault PlanReportDefault @default(timeline)
```

- [ ] **Step 2: Create and apply the migration**

Run:

```bash
npx prisma migrate dev --name add_project_plan_beta
npx prisma generate
```

Expected: migration SQL adds enum `PlanReportDefault` and two columns with defaults; `prisma generate` succeeds.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add Project planEnabled and planReportDefault for Plan beta."
```

---

### Task 2: Gate Plan APIs on `project.planEnabled`

**Files:**
- Modify: `lib/plan/feature.ts` (replace env/allowlist)
- Modify: all files under `app/api/projects/[id]/plan/` that call `requirePlanSession` / `requirePlanEditSession`
- Modify: `__tests__/lib/plan/feature.test.ts`
- Modify: `app/(app)/projects/[slug]/page.tsx` (stop using env `isPlanFeatureEnabled`)

**Interfaces:**
- Consumes: `requireSession`, `canEdit` from `lib/plan/api.ts`; Prisma `project.planEnabled`
- Produces:

```ts
export function isPlanTabEnabled(planEnabled: boolean | null | undefined): boolean;

export async function isProjectPlanEnabled(projectId: string): Promise<boolean>;

export async function requirePlanSessionForProject(projectId: string): Promise<
  | { session: Session }
  | { error: NextResponse }
>;

export async function requirePlanEditSessionForProject(projectId: string): Promise<
  | { session: Session }
  | { error: NextResponse }
>;
```

`isPlanTabEnabled` returns `planEnabled === true` (default off).

`requirePlanSessionForProject`: 401 if no session; 404 `{ error: "Not found" }` if `!await isProjectPlanEnabled(projectId)`; else `{ session }`.

`requirePlanEditSessionForProject`: same, then 403 if `!canEdit(session)`.

Delete `parsePlanFeatureAllowlist`, `isPlanFeatureEnabled`, env-based `requirePlanSession` / `requirePlanEditSession`.

- [ ] **Step 1: Rewrite failing tests**

Replace `__tests__/lib/plan/feature.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { isPlanTabEnabled } from "@/lib/plan/feature";

describe("isPlanTabEnabled", () => {
  it("is off when false, null, or undefined", () => {
    expect(isPlanTabEnabled(false)).toBe(false);
    expect(isPlanTabEnabled(null)).toBe(false);
    expect(isPlanTabEnabled(undefined)).toBe(false);
  });

  it("is on only when true", () => {
    expect(isPlanTabEnabled(true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect fail (old exports) or fail until `isPlanTabEnabled` exists**

```bash
npx vitest run __tests__/lib/plan/feature.test.ts
```

Expected: FAIL until implementation.

- [ ] **Step 3: Implement `lib/plan/feature.ts`**

```ts
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { canEdit, requireSession } from "@/lib/plan/api";
import { prisma } from "@/lib/prisma";

export function isPlanTabEnabled(planEnabled: boolean | null | undefined): boolean {
  return planEnabled === true;
}

function planNotFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function isProjectPlanEnabled(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { planEnabled: true },
  });
  return isPlanTabEnabled(project?.planEnabled);
}

export async function requirePlanSessionForProject(projectId: string) {
  const auth = await requireSession();
  if ("error" in auth) return auth;
  if (!(await isProjectPlanEnabled(projectId))) {
    return { error: planNotFound() };
  }
  return auth;
}

export async function requirePlanEditSessionForProject(projectId: string) {
  const auth = await requirePlanSessionForProject(projectId);
  if ("error" in auth) return auth;
  if (!canEdit(auth.session)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}
```

- [ ] **Step 4: Update plan API routes**

In each plan route, keep `requireSession`/`requireEdit` **after** `resolveProjectId`, then gate:

Pattern for mutations and GET after `resolveProjectId`:

```ts
const sessionAuth = await requireSession();
if ("error" in sessionAuth) return sessionAuth.error;

const projectResult = await resolveProjectId(idOrSlug);
if ("error" in projectResult) return projectResult.error;

const planAuth = await requirePlanSessionForProject(projectResult.id);
if ("error" in planAuth) return planAuth.error;
```

Use `requirePlanEditSessionForProject(projectResult.id)` on POST/PATCH/DELETE.

Do not 404 for Plan-disabled until the project id is known (unknown id stays 404 from `resolveProjectId`).

Replace every `requirePlanSession()` / `requirePlanEditSession()` with the `ForProject` variants using `projectResult.id`.

Files: `route.ts`, `phases/route.ts`, `phases/[phaseId]/route.ts`, `items/route.ts`, `items/[itemId]/route.ts`, `non-working-days/route.ts`.

- [ ] **Step 5: Point the project page at the DB flag**

In `app/(app)/projects/[slug]/page.tsx`:

- Remove `import { isPlanFeatureEnabled } from "@/lib/plan/feature"`.
- After `project` is loaded: `const planEnabled = isPlanTabEnabled(project.planEnabled);`
- Keep `if (tab === "plan" && !planEnabled) tab = "overview";` **after** project load (move it down).
- Import `isPlanTabEnabled`.

- [ ] **Step 6: Run tests**

```bash
npx vitest run __tests__/lib/plan/feature.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/plan/feature.ts __tests__/lib/plan/feature.test.ts app/api/projects/[id]/plan app/\(app\)/projects/[slug]/page.tsx
git commit -m "Gate Plan APIs and tab on Project.planEnabled."
```

---

### Task 3: PATCH project — Admin-only `planEnabled`

**Files:**
- Create: `lib/plan/projectSettingsPatch.ts`
- Test: `__tests__/lib/plan/projectSettingsPatch.test.ts`
- Modify: `app/api/projects/[id]/route.ts`
- Modify: `app/(app)/projects/[slug]/edit/EditProjectDataContext.tsx` (`EditProjectInitial`)
- Modify: wherever `initialSettingsProject` is built (`page.tsx`)

**Interfaces:**
- Consumes: session `permissions`
- Produces:

```ts
export function rejectNonAdminPlanEnabledPatch(
  permissions: string | undefined,
  body: unknown
): { error: string; status: 403 } | null;
```

Returns 403 payload if `body` is a non-null object with own key `planEnabled` and `permissions !== "Admin"`. Otherwise `null`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from "vitest";
import { rejectNonAdminPlanEnabledPatch } from "@/lib/plan/projectSettingsPatch";

describe("rejectNonAdminPlanEnabledPatch", () => {
  it("allows Admin to set planEnabled", () => {
    expect(rejectNonAdminPlanEnabledPatch("Admin", { planEnabled: true })).toBeNull();
  });

  it("allows User when planEnabled is omitted", () => {
    expect(rejectNonAdminPlanEnabledPatch("User", { name: "X" })).toBeNull();
  });

  it("forbids User when planEnabled is present even if false", () => {
    const result = rejectNonAdminPlanEnabledPatch("User", { planEnabled: false, name: "X" });
    expect(result).toEqual({
      error: "Only admins can enable or disable the Plan tab",
      status: 403,
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run __tests__/lib/plan/projectSettingsPatch.test.ts
```

- [ ] **Step 3: Implement helper and PATCH**

Implement `rejectNonAdminPlanEnabledPatch` as specified.

In `app/api/projects/[id]/route.ts` `PATCH`, after `const body = await req.json();` and **before** applying fields:

```ts
const planFlagBlock = rejectNonAdminPlanEnabledPatch(permissions, body);
if (planFlagBlock) {
  return NextResponse.json({ error: planFlagBlock.error }, { status: planFlagBlock.status });
}
```

Extend `updateSchema`:

```ts
planEnabled: z.boolean().optional(),
planReportDefault: z.enum(["timeline", "plan"]).optional(),
```

When applying data:

```ts
if (parsed.data.planEnabled !== undefined) data.planEnabled = parsed.data.planEnabled;
if (parsed.data.planReportDefault !== undefined) data.planReportDefault = parsed.data.planReportDefault;
```

Add `planEnabled` and `planReportDefault` to `EditProjectInitial` and the object built for `initialSettingsProject` on the project page (same place as `cdaEnabled`).

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/lib/plan/projectSettingsPatch.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/plan/projectSettingsPatch.ts __tests__/lib/plan/projectSettingsPatch.test.ts app/api/projects/[id]/route.ts app/\(app\)/projects/[slug]/edit/EditProjectDataContext.tsx app/\(app\)/projects/[slug]/page.tsx
git commit -m "Allow only admins to PATCH planEnabled."
```

---

### Task 4: Settings and Plan-tab default UI

**Files:**
- Modify: `components/ProjectSettingsTab.tsx`
- Modify: `app/(app)/projects/[slug]/ProjectDetailTabs.tsx`
- Modify: `components/PlanTab.tsx`

**Interfaces:**
- Consumes: `planEnabled`, `planReportDefault` from project; `isAdmin` boolean
- Produces: Admin toggle; editor default for new reports via `PATCH /api/projects/:id` `{ planReportDefault }`

- [ ] **Step 1: Settings — Admin-only toggle**

Pass `isAdmin` from `ProjectDetailTabs` into `ProjectSettingsTab` (`canAccessAdmin(permissionLevel)` computed on the server page and passed down, or derive from a new `isAdmin` prop on `ProjectDetailTabs` from `page.tsx` using `canAccessAdmin(getSessionPermissionLevel(session.user))`).

In Details, after the CDA toggle, if `isAdmin`:

```tsx
<Toggle
  checked={planEnabled}
  onChange={setPlanEnabled}
  label="Enable Plan tab (beta)"
  aria-label="Enable Plan tab"
/>
<p className="text-body-sm text-surface-500 dark:text-surface-400">
  Plan is a beta schedule builder. When on, everyone who can open this project sees the Plan tab.
  Status reports still use the Timeline tab until a report opts into Plan.
</p>
```

Include `planEnabled` in `buildPayload` **only when `isAdmin`** so User saves do not send the key.

Hydrate from `initialProject.planEnabled`.

- [ ] **Step 2: Plan tab — new-report default**

`PlanTab` props: add `projectSlug: string` and `planReportDefault: "timeline" | "plan"`.

Pass them from `ProjectDetailTabs` (`project.planReportDefault` from page → tabs).

After the plan exists, for `canEdit`:

```tsx
<section className="rounded-lg border ... p-4 space-y-2">
  <p className="text-body-sm font-medium">New status reports use</p>
  <div className="flex gap-2">
    <button type="button" aria-pressed={planReportDefault === "timeline"} onClick={() => saveDefault("timeline")}>
      Project timeline
    </button>
    <button type="button" aria-pressed={planReportDefault === "plan"} onClick={() => saveDefault("plan")}>
      Project Plan
    </button>
  </div>
  <p className="text-body-sm text-surface-600">
    Changing this does not rewrite saved reports.{" "}
    <Link href={`/projects/${projectSlug}?tab=status-reports`}>Status Reports</Link>
    {" "}still use the Timeline tab unless a report chooses Project Plan.
  </p>
</section>
```

`saveDefault` PATCHes `/api/projects/${projectId}` with `{ planReportDefault }` and calls `router.refresh()` so the server prop updates.

Match existing Plan toolbar button classes (`BTN_TOOLBAR` / pressed styles from PlanGridGantt zoom).

- [ ] **Step 3: Manual check**

As Admin: enable Plan on a project, confirm tab appears, APIs load. As a User (or with Admin logged out of settings): no Enable Plan toggle. Timeline tab still present.

- [ ] **Step 4: Commit**

```bash
git add components/ProjectSettingsTab.tsx components/PlanTab.tsx app/\(app\)/projects/[slug]/ProjectDetailTabs.tsx app/\(app\)/projects/[slug]/page.tsx
git commit -m "Add Admin Plan beta toggle and report default on Plan tab."
```

---

### Task 5: Compact Plan → report schedule mapping

**Files:**
- Create: `lib/plan/reportSchedule.ts`
- Test: `__tests__/lib/plan/reportSchedule.test.ts`

**Interfaces:**
- Consumes: `PlanPhaseJson` from `lib/plan/serialize.ts`
- Produces:

```ts
export type PlanReportDensity = "phases" | "phases_and_key_dates";

export type ReportScheduleSlice = {
  bars: Array<{
    rowIndex: number;
    label: string;
    startDate: string;
    endDate: string;
    color: string | null;
  }>;
  markers: Array<{
    label: string;
    date: string;
    shape: string;
    rowIndex: number;
  }>;
};

export function compactPlanToSchedule(
  phases: PlanPhaseJson[],
  density: PlanReportDensity
): ReportScheduleSlice | null;
```

Returns `null` when no phase has at least one item (no dated phase bars).

Implementation rules (copy from spec):

- Bar per phase with `items.length > 0`; start = min `startDate`, end = max `endDate`; `rowIndex = (phase.order % 4) + 1`; `color: null`.
- Density `phases`: `markers: []`.
- Density `phases_and_key_dates`: markers from items with type `milestone` | `sign_off` | `hard_deadline` or `type === "meeting" && meetingStatus === "scheduled"`. Skip `task`, `waiting_on_client`, assumed meetings.
- Shapes: milestone `Pin`, sign_off `ThumbsUp`, hard_deadline `BadgeAlert`, scheduled meeting `Rocket`.
- Marker `rowIndex` = that phase’s bar row.

- [ ] **Step 1: Write failing tests**

Use a helper phase factory in the test file. Cover:

1. Empty phases → `null`
2. Phase with no items → omitted; if all empty → `null`
3. One phase order `0` → `rowIndex` 1; order `4` → `rowIndex` 1 (wrap)
4. Phases only: two items `2026-03-01`–`03-05` and `03-10`–`03-12` → bar `2026-03-01`–`2026-03-12`, markers `[]`
5. Key dates: include milestone, sign_off, hard_deadline, scheduled meeting; omit task, assumed meeting, waiting_on_client
6. Nested task under a phase still only contributes to phase min/max dates, not a marker

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run __tests__/lib/plan/reportSchedule.test.ts
```

- [ ] **Step 3: Implement `compactPlanToSchedule`**

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run __tests__/lib/plan/reportSchedule.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/plan/reportSchedule.ts __tests__/lib/plan/reportSchedule.test.ts
git commit -m "Map Plan phases and key dates to report timeline bars."
```

---

### Task 6: Snapshot build, create, and refresh

**Files:**
- Modify: `lib/statusReportPdfData.ts`
- Modify: `__tests__/lib/statusReportPdfData.test.ts`
- Modify: `app/api/projects/[id]/status-reports/route.ts`
- Modify: `app/api/projects/[id]/status-reports/[reportId]/refresh-timeline/route.ts`

**Interfaces:**
- Consumes: `compactPlanToSchedule`, `serializePlan` / plan include
- Produces: snapshot fields and timeline from Plan when requested

```ts
export type ScheduleSource = "timeline" | "plan";
export type PlanReportDensity = "phases" | "phases_and_key_dates"; // re-export from reportSchedule.ts

// on StatusReportSnapshot:
scheduleSource?: ScheduleSource; // default timeline when absent
planDensity?: PlanReportDensity;

// on BuildStatusReportPdfDataOptions:
scheduleSource?: ScheduleSource;
planDensity?: PlanReportDensity;
```

```ts
export function resolveScheduleSource(
  snapshot: StatusReportSnapshot | null,
  options?: Pick<BuildStatusReportPdfDataOptions, "scheduleSource">
): ScheduleSource {
  if (options?.scheduleSource === "plan" || options?.scheduleSource === "timeline") {
    return options.scheduleSource;
  }
  if (snapshot?.scheduleSource === "plan") return "plan";
  return "timeline";
}

export function resolvePlanDensity(
  snapshot: StatusReportSnapshot | null,
  options?: Pick<BuildStatusReportPdfDataOptions, "planDensity">
): PlanReportDensity {
  if (options?.planDensity === "phases" || options?.planDensity === "phases_and_key_dates") {
    return options.planDensity;
  }
  if (snapshot?.planDensity === "phases") return "phases";
  return "phases_and_key_dates";
}
```

When building a **new** timeline (`timeline === undefined` after locked-snapshot skip, or `rebuildTimelineFromProject`):

- If `resolveScheduleSource(...) === "plan"`: load plan (add `projectPlan: { include: planInclude }` to the existing project query, or a second query). Serialize phases via existing `serializePlan` / phase JSON. Call `compactPlanToSchedule`. If `null`, leave `timeline` undefined (callers 400).
- Else: existing bars/markers logic.

Axis `startDate`/`endDate` still use project dates + `timelinePreviousMonths` (do not use Plan kickoff/end for the window). Attach compact `bars`/`markers` onto that same `{ startDate, endDate, bars, markers }` object.

Create POST (`status-reports/route.ts`):

- Add to `createSchema`: `scheduleSource: z.enum(["timeline", "plan"]).optional()`, `planDensity: z.enum(["phases", "phases_and_key_dates"]).optional()`.
- If variation is Standard or Milestones and `scheduleSource === "plan"`, pass those into `buildStatusReportPdfData`.
- If `scheduleSource === "plan"` and `!pdfData?.timeline`, return **400** `{ error: "Add phases and dated items on the Plan tab (or choose Project timeline)." }` **before** treating create as success. If the report row was already inserted, delete it or build snapshot before insert — **prefer: call `buildStatusReportPdfData` only after create as today, but if Plan source and no timeline, delete the report and return 400** so we do not leave a report without a schedule. Implement that delete-on-failure path in the non-Modular branch.
- Persist `scheduleSource` (default `"timeline"`) and `planDensity` (only when source is plan) on the snapshot object.

Refresh route:

- After rebuild, if source is plan and `!pdfData.timeline`, 400 with the same Plan message (not the Timeline-tab message).
- Keep `scheduleSource` and `planDensity` on `nextSnapshot` (spread `existingSnapshot`).

- [ ] **Step 1: Unit tests for resolvers**

Add to `__tests__/lib/statusReportPdfData.test.ts`:

```ts
describe("resolveScheduleSource", () => {
  it("defaults to timeline", () => {
    expect(resolveScheduleSource(baseSnapshot)).toBe("timeline");
  });
  it("uses snapshot plan unless options override", () => {
    expect(resolveScheduleSource({ ...baseSnapshot, scheduleSource: "plan" })).toBe("plan");
    expect(
      resolveScheduleSource({ ...baseSnapshot, scheduleSource: "plan" }, { scheduleSource: "timeline" })
    ).toBe("timeline");
  });
});

describe("resolvePlanDensity", () => {
  it("defaults to phases_and_key_dates", () => {
    expect(resolvePlanDensity(baseSnapshot)).toBe("phases_and_key_dates");
  });
  it("honors snapshot phases", () => {
    expect(resolvePlanDensity({ ...baseSnapshot, planDensity: "phases" })).toBe("phases");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run __tests__/lib/statusReportPdfData.test.ts
```

- [ ] **Step 3: Implement resolvers, query, mapping branch, create/refresh**

- [ ] **Step 4: Run unit tests — expect PASS**

```bash
npx vitest run __tests__/lib/statusReportPdfData.test.ts __tests__/lib/plan/reportSchedule.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/statusReportPdfData.ts __tests__/lib/statusReportPdfData.test.ts app/api/projects/[id]/status-reports
git commit -m "Snapshot compact Plan onto status report timeline when chosen."
```

---

### Task 7: Status report form, refresh copy, docs

**Files:**
- Modify: `components/StatusReportsTab.tsx`
- Modify: `docs/USER_GUIDE.md`
- Modify: `docs/TECHNICAL.md`

**Interfaces:**
- Consumes: `planEnabled`, `planReportDefault` props; snapshot `scheduleSource` / `planDensity`
- Produces: create payload fields; locked display when editing; **Refresh schedule** when source is plan

- [ ] **Step 1: Form fields**

Pass `planEnabled` and `planReportDefault` into `StatusReportsTab` from `ProjectDetailTabs` (from page project fields).

On create, when `planEnabled` and variation is Standard or Milestones:

- Prefill `formScheduleSource` from `planReportDefault`.
- Prefill `formPlanDensity` to `phases_and_key_dates`.
- Show select **Schedule source**: Project timeline | Project Plan.
- If source is plan, show **Plan density**: Phases only | Phases + key dates.

On edit, read from `r.snapshot?.scheduleSource` / `planDensity`; show read-only text (same pattern as previous months).

POST body includes `scheduleSource` and `planDensity` only on create.

Refresh button: if editing snapshot source is `plan`, label **Refresh schedule** and modal title/body say Plan (phases/key dates), not Timeline tab. If timeline/omitted, keep **Refresh timeline**.

Extend the local snapshot type on the reports list (around line 51) with `scheduleSource?` and `planDensity?`.

- [ ] **Step 2: Docs**

USER_GUIDE Plan tab row: Admin enables in Settings; everyone on the project sees it; editors set default for new reports; Status Reports choose source and density; Refresh schedule vs Refresh timeline.

TECHNICAL: `planEnabled` (Admin PATCH), `planReportDefault`, snapshot `scheduleSource` / `planDensity`, `lib/plan/reportSchedule.ts`. **Remove** `PLAN_FEATURE_ENABLED` / `PLAN_FEATURE_ALLOWLIST` rows if present.

- [ ] **Step 3: Browser check**

Enable Plan on one project. Create Standard report with Project Plan + default density; preview shows phase bars and key-date markers, not the full grid. Create another with Project timeline; unchanged. Refresh schedule on the Plan report. Confirm a project with Plan off has no Plan tab and no schedule-source fields.

- [ ] **Step 4: Commit**

```bash
git add components/StatusReportsTab.tsx app/\(app\)/projects/[slug]/ProjectDetailTabs.tsx docs/USER_GUIDE.md docs/TECHNICAL.md
git commit -m "Let Standard reports opt into compact Plan on the slide."
```

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| `planEnabled` / `planReportDefault` schema | 1 |
| Hide tab + API 404 | 2 |
| Remove env flags | 2 |
| Admin-only PATCH `planEnabled` fail-closed | 3 |
| Settings toggle | 4 |
| No View/Edit mode | already removed; do not reintroduce |
| Plan tab default + Status Reports link | 4 |
| Compact mapping + shapes + row wrap | 5 |
| Snapshot + create 400 + refresh | 6 |
| Form + refresh copy | 7 |
| Docs | 7 |
| Timeline tab remains | 4–7 (do not hide) |
| CDA/Modular unchanged | 6–7 (fields only on Standard/Milestones) |
