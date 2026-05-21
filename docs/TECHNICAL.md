# Project Workbench — Technical Reference

This document summarizes the technical stack, data model, environment, and APIs for developers and deployers. It is written in standard Markdown for easy copy-paste into Confluence (Markdown macro or paste as Markdown).

---

## Versioning

- **App version** is defined in `package.json` and exposed in the UI via `lib/version.ts` (footer). The Float HTTP client may send it in a `User-Agent`-style header when configured.
- **SemVer:** Releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). **1.0.0** is the first stable major release: treat **documented** env vars, API routes, and Prisma-backed data shapes as the compatibility baseline. Breaking changes to those should be released under a new **major** version and called out in [CHANGELOG.md](../CHANGELOG.md).
- **Database:** Apply migrations in order (`prisma migrate`); do not assume forward compatibility across major app versions without checking release notes.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Auth | NextAuth.js (credentials: email/password) |
| UI | Tailwind CSS, TanStack Table, React Hook Form, Zod, Recharts, **sanitize-html** (HTML meeting notes in status reports) |
| Optional | Upstash Redis (rate limiting in production); Trigger.dev (`@trigger.dev/sdk`) for optional scheduled Float sync (`trigger/floatSync.ts`) and missing-actuals Slack nudges (`trigger/missingActualsNudge.ts`) |

---

## App shell

Signed-in routes under `app/(app)/` use a shared chrome:

- **`app/(app)/layout.tsx`** (server) — Session gate, **`AppShell`** props (`userDisplayName`, `isAdmin`, **`asOfDateLabel`**). Does **not** call **`getDashboardContext`** for layout; avoid blocking the shell on DB work that only dashboards or the projects list need.
- **`components/AppShell.tsx`** (client) — Collapsible sidebar + main column (sticky **Project Workbench** header with as-of date, scrollable main).
- **`components/AppSidebar.tsx`** (client) — **Jakala** assets from **`public/brand/`** (`jakala-wordmark.png` / `jakala-wordmark-dark.png` when expanded, **`j512.png`** when collapsed). Expanded: larger wordmark beside the collapse control (header vertically centered in its block; wordmark **`object-left`** in the remaining width). **First nav row** when expanded: **`Hi <First name>`** (see `firstNameFromDisplay` — session **name** first token, else email local-part before `@`) plus Lucide **`Hand`**; row omitted when collapsed. Nav links, theme toggle, optional full **`userDisplayName`** in footer (expanded), **Account** / **Admin** / **Sign out**. Persisted collapse: **`localStorage`** key `project-workbench-sidebar-collapsed` via **`AppShell`**.

### Browser tab icon (favicon)

- **Source asset:** **`public/brand/j512.png`** (same compact mark as the collapsed sidebar).
- **Next.js file conventions** (App Router metadata files in **`app/`**):
  - **`app/favicon.ico`** — serves **`/favicon.ico`** (browsers request this path automatically; without it, Vercel/Next.js may show the default Vercel triangle).
  - **`app/icon.png`** — primary PNG favicon route and **`<link rel="icon">`** tag.
  - **`app/apple-icon.png`** — **`<link rel="apple-touch-icon">`** for home-screen bookmarks.
- **Do not** rely on **`metadata.icons`** in **`app/layout.tsx`** alone for the tab icon; file-based icons are required so **`/favicon.ico`** resolves correctly.
- **Updating the mark:** replace **`public/brand/j512.png`**, then regenerate/copy the three **`app/`** files from that PNG (e.g. **`npx png-to-ico public/brand/j512.png > app/favicon.ico`** plus copies to **`app/icon.png`** and **`app/apple-icon.png`**). Favicons are cached aggressively in browsers—use a hard refresh or incognito when verifying.

---

## Data model (overview)

The schema is defined in `prisma/schema.prisma`. Main entities:

| Entity | Purpose |
|--------|---------|
| **User** | App login (email, password hash, permissions: User/Admin, optional position role, optional **`slackUserId`** for Slack mentions and DM nudges, optional **`industryGroupId`** link to **IndustryGroup** for user-level taxonomy labels). |
| **Person** | Resource (name, email, active, optional **`userId`** link to **User** for Slack resolution on key roles, optional externalId, optional `floatRegionId` / `floatRegionName` from Float sync). Used for assignments and Float import; may be linked to User by email/name for “My Projects”. |
| **Account** | Client/account entity (unique **name**, optional **`floatClientId`**, optional **`slackChannelId`**, optional **`industryGroupId`**). Projects with **`Project.accountId`** inherit that account’s industry group for reporting/UI. Used for Slack health updates and Thursday missing-actuals posts. |
| **IndustryGroup** | Admin-defined taxonomy (**name** unique, optional **`archivedAt`** for soft archive). Referenced by **Account** and **User**. New assignments to accounts/users must use a non-archived group (`lib/industryGroupAssign.ts`). |
| **Role** | Role type (e.g. Project Manager, FE Developer). Used on assignments and matched to Float role names on sync. |
| **Project** | Project (slug, name, client, start/end dates, status, optional **`accountId`** → effective industry group comes from **`Account.industryGroup`** when linked, optional **`slackChannelId`** for Wed/Tue missing-actuals nudges, optional single rate, notes, SOW/estimate/float/metric links, resourcing thresholds, `cdaEnabled`, `cdaReportHoursOnly`, optional clientSponsor/keyStaffName for status reports). |
| **ProjectAssignment** | Person assigned to a project in a role; optional bill-rate override; optional **`hiddenFromGrid`** (hide **rows** on the Resourcing tab only—hours still roll into **column totals**). **`syncRoleFromFloat`** (default true): when false, Float sync does not change `roleId` (set when the user saves a different role in **Settings → Assignments**). |
| **ProjectRoleRate** | Per-role bill rate for a project (rate card). |
| **ProjectKeyRole** | Key role assignment (PM, PGM, CAD) per project and person. |
| **PlannedHours** | Planned hours by project, person, week (Monday). |
| **ActualHours** | Actual hours by project, person, week (Monday); null = missing. |
| **ActualHoursMonthSplit** | When a week spans two calendar months (Mon–Sun UTC), actual hours split by `monthKey` (YYYY-MM) and `(projectId, personId, weekStartDate)`. Hours are quarter-hour increments; the two parts sum to the same total as the parent week. Used for CDA MTD actuals and Resourcing UI. |
| **FloatScheduledHours** | Float-imported scheduled hours by project, person, week (Monday). |
| **PTOHolidayImpact** | Day-level PTO (Float time off) and holidays (regional public/team) per person and UTC calendar day. Populated during **Float API sync** (`lib/float/ptoholidaySyncWriters.ts`); consumed by Resourcing, project **PTO** tab, company **`/pto-holidays`**, and dashboard widgets. |
| **BudgetLine** | Budget line (type: SOW/CO/Other, label, low/high hours and dollars; values may be negative for change orders). |
| **ReadyForFloatUpdate** | Per-project, per-person flag for Float sync. |
| **GridCellComment** | Optional comment on a resourcing grid cell (Planned or Actual) by project, person, week. |
| **StatusReport** | Status report (reportDate, variation: Standard/Milestones/CDA, RAG fields, completed/upcoming/risks/meeting notes, snapshot JSON). |
| **CdaMonth** | CDA monthly planned and MTD actuals by project and month (YYYY-MM). |
| **CdaMilestone** | CDA milestone (phase, dev/UAT/deploy dates, completed). |
| **TimelineBar** | Timeline bar (row, label, start/end date, optional color hex) for a project. |
| **TimelineMarker** | Timeline marker (shape, label, date) on a bar row. |
| **FloatImportRun** | Metadata for each Float import (timestamp, unknown roles, new people, project names, JSON for backfill and client mapping). |
| **AppConfig** | Singleton row (`id: singleton`); **`resourcingChannelId`** — Slack channel for org-wide **resourcing request** posts. |
| **ResourcingNotifyUser** | Users (by `userId`) who receive **@mentions** on resourcing request Slack messages (in addition to PM/PGM). |
| **ResourcingRequest** | Resourcing change request: project, requester, optional note, JSON **`requestedPeople`** (see [Resourcing fulfill variance](#resourcing-fulfill-variance) below), optional **`slackMessageTs`** / **`slackChannelId`** for thread replies, **`status`** (`OPEN` / `FILLED` / `VARIANCE_FLAGGED`). |
| **ActualsNudgeLog** | Audit log for **missing-actuals** Slack sends (project, prior-week `weekStart`, `nudgeDay` 2/3/4, channel kind, Slack ids, snapshot of missing names, ok/error). |

Weeks are always identified by **week start date** (Monday) in UTC. All hour tables use `(projectId, personId, weekStartDate)` (or equivalent for PTO) as the scope.

### Industry groups

- **Models:** `IndustryGroup` (**`name`** unique, optional **`archivedAt`** soft-archive), optional FKs **`Account.industryGroupId`** and **`User.industryGroupId`** (`onDelete: SetNull` when a group row is deleted; archives do not delete the row).
- **Project effective group:** No **`Project.industryGroup`** column—all projects linked to an account (**`Project.accountId`**) inherit **`Account.industryGroup`**. Editors see read-only copy on **Settings → Details** (`components/ProjectSettingsTab.tsx`). **`getCachedProjectBySlugOrId`** (`lib/projectCache.ts`) and **`resolveProject`** in **`app/api/projects/[id]/route.ts`** include **`account.industryGroup`** (`id`, `name`, `archivedAt`).
- **Validation:** **`assertIndustryGroupAssignable`** (`lib/industryGroupAssign.ts`) blocks **newly** assigning an archived group id to accounts/users (existing archived references may remain until cleared).
- **Admin:** **`GET/POST /api/admin/industry-groups`**, **`PATCH /api/admin/industry-groups/[id]`**; **`PATCH /api/admin/accounts/[id]`** / **`PATCH /api/admin/users/[id]`** accept **`industryGroupId`** (nullable). UI: **`/admin/industry-groups`**, pickers on Accounts and Users.

### Split-week actual hours

When `getMonthKeysForWeek(weekStartDate)` returns two month keys, that week is a **split week**. Implementation notes:

- **`lib/monthUtils.ts`** — `getMonthKeysForWeek` / related helpers determine which months a week touches (UTC calendar days). **`isPastLastUtcDayOfMonthInWeek`** — used by the Resourcing Actual split cell so the **first** month’s hours become editable after that UTC calendar month ends, while the **second** month still follows completed-week rules (`isCompletedWeek` / not current week).
- **`lib/splitWeekProRata.ts`** — Pro-rates a total hour value across two months by **UTC calendar-day count** within the week (largest-remainder to quarter hours). Used by `scripts/migrate-split-week-actuals.ts` to backfill `ActualHoursMonthSplit` from legacy `ActualHours` rows that only had a single total.
- **`ActualHours`** still stores the **rolled-up total** for the week (same as before). When month splits exist for a `(personId, weekStartDate)`, the Resourcing and CDA logic prefer splits for per-month attribution and skip double-counting that week’s total in month rollups.
- **API `PATCH /api/projects/[id]/actual-hours`** — Either `{ personId, weekStartDate, hours }` (single value, nullable to clear) **or** `{ personId, weekStartDate, parts: [{ monthKey, hours }, …] }` for split weeks. Each part’s **`hours`** may be a non‑negative quarter-hour **number** **or `null`**: **`null` deletes** that month’s `ActualHoursMonthSplit` row (distinct from storing **0**). After updates, the rolled-up **`ActualHours.hours`** for the week is the sum of remaining split rows, or **`null`** if none remain. **GET** returns `{ rows, monthSplits }` for the optional week range query params.
- **`GET /api/projects/[id]/resourcing`** — Includes `monthSplits` alongside planned/actual/float so the Resourcing grid can render split cells.
- **`GET /api/projects/[id]/cda`** — Computes per-month MTD actuals from `ActualHoursMonthSplit` plus `ActualHours` for weeks that fall entirely in one month (weeks with splits are excluded from the single-month path to avoid double count).

Unit tests: `__tests__/lib/splitWeekProRata.test.ts`, `__tests__/lib/monthUtils.test.ts` (where applicable).

### PM / PGM / CAD dashboards

- **`lib/portfolioMetrics.ts`** — Builds per-role portfolio metrics and `projectTableRows` for the dashboard projects table. Each row includes **`recoveryThisWeekPercent`** (revenue recovery % for the most recent completed week only—aligned with `revenueRecovery.thisWeek`) and **`recovery4WeekPercent`** (rolling sum over the previous four completed weeks—aligned with the “Previous 4 weeks” portfolio card). Also: burn, buffer, actuals status, status-report RAG / stale flag, and **`requestOpen`** (true when any `ReadyForFloatUpdate` has `ready: true` for a person on a non–hidden-from-grid assignment—same visibility rule as `GET /api/projects/[id]/resourcing`).
- **Actuals status / missing actuals (split weeks)** — `computeBudgetRollups` (`lib/budgetCalculations.ts`) sets **`actualsStatus`** and **`missingActuals`** from completed weeks where **`plannedHours > 0`** and **`actualHours === null`** on each **`WeeklyHoursRow`** (dashboard **`actualsStatus`** / portfolio **`staleActuals`** use this). **`PATCH /api/projects/[id]/actual-hours`** keeps **`ActualHours.hours`** equal to the sum of **`ActualHoursMonthSplit`** parts when split updates run, so rolled-up totals stay consistent. The Resourcing **Actual** grid additionally uses **`hasMissingActualsSplitWeek`** (same file) with per-month values and split-row flags so amber “missing” cell styling matches per-month unlock rules without treating an unduly month-half as missing. Tests: `__tests__/lib/budgetCalculations.test.ts`.
- **`components/DashboardProjectsTable.tsx`** — Renders the sortable table (including the **Request** column). Sort state is driven by URL query params `sort` and `dir` on `/pm-dashboard`, `/pgm-dashboard`, and `/cad-dashboard` (see `app/(app)/*-dashboard/page.tsx`). Valid `sort` keys include `requestOpen`.
- **`PATCH /api/projects/[id]/ready-for-float`** — Updates `ReadyForFloatUpdate`; revalidates `project-resourcing:{id}` and **`portfolio-metrics`** so dashboard `requestOpen` stays in sync.
- **`components/DashboardClientFilter.tsx`** — Optional client filter; invalid `client` query values redirect to the unfiltered dashboard.

### Float sync behavior

Scheduled hours are loaded from the **Float API** (not file upload). Orchestration: `lib/float/syncFloatImport.ts` (`executeFloatApiSync`) → `applyFloatImportDatabaseEffects` in `lib/floatImportApply.ts`. The sync also calls `/v3/timeoffs`, `/v3/public-holidays`, and `/v3/holidays` (team holidays; filtered client-side to the sync window) for the same date window as tasks; `lib/float/excludedDays.ts` merges **time off** (per person) and **regional** public/team holidays into `excludedUtcDatesByFloatPeopleId`, and `lib/float/taskAggregation.ts` (`aggregateTasksToWeeklyHours`) subtracts those UTC weekdays before writing `FloatScheduledHours`. **Time off → person mapping** must match Float’s API: `buildExcludedUtcDatesByFloatPeopleId` uses **`people_ids`** (array) when present, else **`people_id`**—the same resolution as `lib/float/ptoholidaySyncWriters.ts` for `PTOHolidayImpact`—so scheduled-hour totals stay consistent with PTO UI when Float omits top-level `people_id`. The same sync run **persists** day-level rows into **`PTOHolidayImpact`** for UI features (Resourcing pills, **PTO** tab, **`/pto-holidays`**, dashboard widget). Admin route: `GET`/`POST` `app/api/admin/float-sync/route.ts` (UI: **Admin → Float sync**, `/admin/float-sync`; `/admin/float-import` redirects there). **Admin → Holidays** uses `GET /api/admin/float-holidays` (read-only JSON tables).

- **Auth / config:** `POST` requires Admin session. `FLOAT_API_TOKEN` must be set; optional `FLOAT_API_USER_AGENT_EMAIL` is sent in `User-Agent` per Float’s integration guidelines. If the token is missing, the API returns **503** with a clear message.
- **Writes (`applyFloatImportDatabaseEffects`):** Incomplete-week **`FloatScheduledHours`** rows are built from the merged snapshot (`!isCompletedWeek` in `lib/weekUtils.ts`) and written with **`INSERT … ON CONFLICT DO UPDATE`**. Behavior depends on **`floatApiSyncWindow`**:
  - **Admin Float API sync** (`executeFloatApiSync` in `lib/float/syncFloatImport.ts`) **sets** `floatApiSyncWindow`. The import **does not** run the optional pre-upsert step that deletes all future float rows for `(project, person)` pairs that have incomplete-week writes in this merge (`pairsWithFutureWrites` in `lib/floatImportApply.ts`). That avoids deleting **backfilled** or out-of-window hours that the current API response does not include. Weeks **present** in the merge are still upserted; **`PlannedHours` and `ActualHours` are never written by this path.**
  - **Paths without `floatApiSyncWindow`** (e.g. legacy CSV-style apply / flows that omit the API window flag) **do** run that pre-delete for pairs that have at least one incomplete-week row in this merge, before upserting—so stale future weeks for those pairs are cleared when the merge does not list them.
- **Cleanup:** For projects in the import, the code finds **future** `FloatScheduledHours` rows and deletes them for `(projectId, personId)` pairs that are **not** in the merged snapshot (person removed from the project in Float). Past weeks for that person are never deleted by that step alone. **Orphan cleanup:** After upserts, for every project in the import, **`applyFloatImportDatabaseEffects`** deletes **all** `FloatScheduledHours` rows (any `weekStartDate`) where the `(projectId, personId)` pair has **no** matching **`ProjectAssignment`** on that project—so stale **completed-week** float rows do not persist after someone is removed and future-only cleanup no longer applies. Project assignments are not removed automatically.
- **Project assignments:** `ProjectAssignment` rows are upserted for every Float `(project_id, people_id)` pair that appears on a task in the sync window, including pairs that produce **no** positive weekly hours — e.g. **zero hours per day** (skipped by `aggregateTasksToWeeklyHours`) or all relevant weekdays excluded (PTO/holidays). Those people still get an assignment when the role resolves to a Workbench role; they may have **no** `FloatScheduledHours` rows. **Role resolution order** (when **`syncRoleFromFloat`** is true): (1) **`Person.floatJobTitle`** (Float `job_title`) is matched to Workbench `Role` names with normalization and **`FLOAT_JOB_TITLE_ALIASES`** in `lib/float/roleWorkbenchMatch.ts` (`resolveJobTitleToWorkbenchId`); (2) if that does not resolve, Float **scheduling** role labels from tasks/people (`role_id` → `/v3/roles`) use the same module’s Float-role lookup (`resolveFloatRoleNameToWorkbenchId`); (3) if still unmapped and the row **already exists**, sync **preserves** the existing `roleId`; (4) for **new** rows only, unmapped roles use a **preferred** fallback (typically **Solutions Consultant**, else the **last** role by alphabetical name). Assignments with **`syncRoleFromFloat: false`** (set when the user saves a role in **Settings → Assignments**) must not have `roleId` overwritten by Float sync: merge logic respects the flag, and the bulk upsert in `applyFloatImportDatabaseEffects` uses **`ON CONFLICT … DO UPDATE … WHERE "ProjectAssignment"."syncRoleFromFloat" = true`** so the database write path cannot revert a manual override even if upstream resolution differs. Rows that should **follow** Float keep the default **`syncRoleFromFloat: true`**; the next sync updates their `roleId` when the pair appears in the merge. Scheduled hours do not depend on role.
- **Legacy assignment roles (e.g. wrong fallback before role matching improved):** Deploying the defensive upsert does **not** bulk-rewrite existing `roleId` values. To align stored roles with Float again, keep **`syncRoleFromFloat` true** and run **Float sync** so pairs in the task window get a fresh resolution; pairs with **no tasks in the sync window** may need a **wider date range** on Admin sync or a **one-off script** that resolves from the Float API or latest `FloatImportRun.projectAssignments` and updates `ProjectAssignment.roleId` for rows that should track Float. Do **not** use Settings → Assignments to “fix” stale roles if the goal is to match Float — saving sets **`syncRoleFromFloat` false** and stops Float-driven updates for that person on the project.
- **Matching:** Projects are matched by `Project.floatExternalId` (Float `project_id`) when set, else by normalized project name. People are synced from Float `/v3/people` into `Person` (including `externalId` and `floatJobTitle`). Scheduling role names from Float must exist in Workbench for path (2) above; unknown names are recorded on the run and shown in the admin UI.
- **Duplicate Float project names:** Weekly hours are merged per Float `(project_id, people_id)`, not per display name, so two different Float projects with the same title are not summed into one inflated total. When applying hours, `resolveProjectIdForMergedFloatEntry` (`lib/floatImportApply.ts`) attaches a row to the Workbench project whose `floatExternalId` matches that Float `project_id`, or to a name match only if `floatExternalId` is unset or matches — avoiding attributing hours from the wrong Float project onto a project already linked to another id.
- **New projects:** When a project is created or `backfill-float` is run, data comes from stored `FloatImportRun.projectFloatHours` (and `getProjectDataFromAllImports` for project create where applicable). Cleanup runs on each **sync**, not on create or backfill.

**Tests:** `__tests__/api/admin/float-import-cleanup.test.ts` covers `applyFloatImportDatabaseEffects` (future cleanup for people not in the merge, past weeks preserved, assignment role preservation / sync when `syncRoleFromFloat` is present). Tests **skip** if `ProjectAssignment.syncRoleFromFloat` is missing from the connected DB (`DATABASE_URL`); run `prisma migrate deploy` on that database. `__tests__/api/admin/float-sync.test.ts` mocks Float HTTP and runs `executeFloatApiSync` end-to-end against the DB.

- **DB / load (implementation notes):** Future `FloatScheduledHours` rows for import pairs are cleared with **tuple `IN`** deletes (`deleteFutureFloatScheduledHoursForPairs` in `lib/floatImportApply.ts`) instead of a large `OR` tree or one `deleteMany` per pair. A secondary index on **`(projectId, weekStartDate)`** supports the “future rows per imported project” scan. `syncPeopleFromFloatList` loads **`Person`** rows matching Float `people_id` / name **only** (not a full table read); `applyPtoHolidaySyncWriters` still loads all rows with `externalId` set so **regional holiday** expansion sees every person with a `floatRegionId`. After **Admin → Float sync**, **`revalidateTag("project-resourcing")`** invalidates cached `GET /api/projects/[id]/resourcing` for all projects in one call (entries are also tagged per-project for targeted invalidation elsewhere). On staging/production-like data, validate hot paths with **`EXPLAIN (ANALYZE, BUFFERS)`** on the delete helpers and the future-rows query if tuning further.

#### Manual QA checklist (Float sync)

Short spot-checks after deploying or changing Float integration:

1. **Resourcing grid** — Sync from Float, then open a project that exists in Float. Confirm **Float** columns show expected hours for future weeks that appear in the **sync merge**. For people **removed** from the project in Float, confirm **future** rows clear and **past** orphan float rows disappear after the next sync (or run sync once after deploy if upgrading). If a week should be empty but still shows old hours, widen the sync window, run **Backfill**, or check that the week is included in Float’s task data for the sync—API sync does not blanket-delete all future rows before upsert (see **Writes** above).
2. **PTO vs Float hours** — For a future week where someone has **time off** in Float, confirm the **Float** column total is **reduced** on PTO weekdays (not full allocation as if they were working), and that the **PTO** tab / pills agree after sync.
3. **Backfill** — From the Projects list (backfill action) or project flow, run **backfill Float** for a project. Confirm scheduled hours update from stored import runs without error.
4. **Sync plan from Float** — On the project Edit page, run **Sync plan from Float (past weeks)**. Confirm **Planned** hours align with Float for completed weeks in the resourcing range.
5. **Project create + Float match** — Create a project whose **name** matches a Float project (or run sync after create so `floatExternalId` is set). Run **Float sync**; confirm assignments and Float hours attach to that project.

### Scheduled Float sync (Trigger.dev)

Optional **background** runs use the same core pipeline as `POST /api/admin/float-sync`: `trigger/floatSync.ts` defines two **`schedules.task`** jobs (`float-sync-weekday`, `float-sync-weekend`) that call `executeFloatApiSync` with `uploadedByUserId: null`. Config: `trigger.config.ts` (`dirs: ["./trigger"]`, `maxDuration` for long runs). **Environment** for the Trigger.dev worker (project dashboard / deploy target) must include **`DATABASE_URL`**, **`FLOAT_API_TOKEN`**, and optionally **`FLOAT_API_USER_AGENT_EMAIL`**—same as the app for Float calls. These tasks **do not** invoke Next.js `revalidateTag` (no request context); interactive admin sync still handles cache invalidation for resourcing tags. Deploy and schedules follow [Trigger.dev](https://trigger.dev) docs (`npx trigger.dev@latest dev` locally, `deploy` for production). Package: `@trigger.dev/sdk` (see `package.json`).

**Schedule / window tradeoffs (product & ops):** Weekday **hourly** and weekend **every 6h** UTC runs the **full** pipeline (`defaultFloatSyncDateRange` in `lib/float/syncFloatImport.ts` is roughly **±12 months** of tasks/time off/holidays). Reducing **cron frequency** (e.g. a few times per weekday) lowers API and DB load if slightly stale grids are acceptable. Narrowing **`startDate` / `endDate`** (via `POST` body or future defaults) reduces rows fetched and written; coordinate with stakeholders before changing defaults. A **changed-since** optimization would require Float API support—verify against current Float docs before relying on it.

### Missing-actuals Slack nudges (Trigger.dev)

`trigger/missingActualsNudge.ts` defines three **`schedules.task`** jobs:

| Task id | Cron (UTC) | Behavior |
|---------|------------|----------|
| `missing-actuals-nudge-tuesday` | `0 15 * * 2` (Tue 15:00) | For each qualifying **active** project: DM every **PM** who has **`User.slackUserId`** set (linked via **`Person.userId`**). PMs **without** a Slack user id fall back to a single post in **`Project.slackChannelId`** when set. |
| `missing-actuals-nudge-wednesday` | `0 15 * * 3` | Post to **`Project.slackChannelId`** only (skips if unset); includes an extra reminder line in the blocks. |
| `missing-actuals-nudge-thursday` | `0 15 * * 4` | Post to **`Account.slackChannelId`** when the project has **`accountId`** and the account has a channel; otherwise skip. |

**Qualifying projects** (`lib/missingActuals.ts` → `getMissingActualsProjects`): **prior full UTC week** (Mon–Sun immediately before the current week) where, for at least one `(project, person, week)` row, **`FloatScheduledHours.hours > 0`** and **`ActualHours`** is missing **or** hours are **0**. This is **not** the same rule as **status report create** blocking (which uses **planned vs actual** on completed weeks via `projectHasMissingActuals` / `computeBudgetRollups`).

**Worker env:** **`SLACK_BOT_TOKEN`**, **`DATABASE_URL`**, optional **`WORKBENCH_BASE_URL`** (default in code: production-style URL; override for staging). If the token is missing, tasks no-op with a log warning.

**Logging:** Each send attempt creates an **`ActualsNudgeLog`** row (`slackOk` / `slackError`).

---

## Slack integration

Slack features use the Slack **Web API** (`chat.postMessage`, `conversations.open`, `reactions.add`) with a **bot token** stored in **`SLACK_BOT_TOKEN`** on the **Next.js server** (Vercel) and on the **Trigger.dev** worker for scheduled nudges.

### Environment variables (Slack)

| Variable | Required | Purpose |
|----------|----------|---------|
| **SLACK_BOT_TOKEN** | For Slack features | Bot OAuth token (`xoxb-…`). Without it, project Slack routes return **500** `"Slack is not configured"`; Trigger nudges skip. |
| **WORKBENCH_BASE_URL** | Optional | Public HTTPS origin for links in Slack (no trailing slash enforced in code). Defaults to a hard-coded production URL if unset—**set explicitly** for preview/staging. |

### Channel and user configuration

| Setting | Where | Used for |
|---------|--------|----------|
| **Resourcing Slack channel** | **Admin → Slack** → persisted in **`AppConfig.resourcingChannelId`** | `POST .../slack/resourcing-request` |
| **Notify users** | **Admin → Slack** → **`ResourcingNotifyUser`** rows | Extra `@user` mentions on resourcing requests |
| **Slack user ID** | **Admin → Users** → **`User.slackUserId`** | Mentions, Tuesday PM DMs, requester display in Slack |
| **Person ↔ User link** | **`Person.userId`** (Prisma) | Resolve PM/PGM **`Person`** rows to **`User.slackUserId`** for mentions and DMs |
| **Project channel** | **Settings → Links** → **`Project.slackChannelId`** (`PATCH /api/projects/[id]`) | Tue fallback, Wed nudge |
| **Account channel** | **Admin → Accounts** → **`Account.slackChannelId`** | Health updates, Thu nudge |

**Channel resolution for status posts:** `POST .../slack/health-update` calls **`resolveAccountSlackChannel`** in **`lib/slackChannels.ts`**, which requires a linked **`accountId`** (or loaded **`account`**) and a non-empty **`Account.slackChannelId`**. It does **not** read **`Project.slackChannelId`**.

### API routes (Slack)

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/projects/[id]/slack/health-update` | Session (User/Admin) | Post **latest saved** status report summary + optional note to **account** channel (`Account.slackChannelId` for the linked account). |
| `POST /api/projects/[id]/slack/resourcing-request` | Session (User/Admin) | Create **`ResourcingRequest`**, post to resourcing channel with PM/PGM/notify mentions. Stores **`requestedPeople`** (Float **`hoursSnapshot`** per person in the sync window, **`requested: true`** when **Ready** was on, plus **`snapshotStartKey`** / **`snapshotEndKey`**). |
| `POST /api/projects/[id]/slack/resourcing-request/fulfill` | Session (User/Admin) | Run **`executeFloatApiSync`**, post **Marked as fulfilled** in the request thread, then post a **variance** reply **only if** **`computeResourcingFulfillVariance`** (`lib/resourcingFulfillVariance.ts`) finds a mismatch (see [Resourcing fulfill variance](#resourcing-fulfill-variance)). Sets **`status`** to **`FILLED`**. Same as **Mark fulfilled** on the Resourcing tab. |
| `GET/PATCH /api/admin/slack-config` | Admin | Read/update **`AppConfig.resourcingChannelId`**. |
| `GET/PATCH /api/admin/slack-config/notify-users` | Admin | List or replace notify-user set. |
| `PATCH /api/admin/slack-config/notify-users/[userId]` | Admin | Toggle one user’s notify membership. |
| `GET /api/admin/accounts` | Admin | List accounts (from Float client sync); includes **`industryGroup`** when set. |
| `PATCH /api/admin/accounts/[id]` | Admin | Set **`Account.slackChannelId`** and/or **`industryGroupId`**. See [Industry groups](#industry-groups) above. |

`[id]` on project routes is **id or slug** (`getProjectId`).

### Workbench links in Slack messages

Project tabs use a **single page** at `/projects/[slug]` with the active tab selected by the **`tab`** query parameter (see `app/(app)/projects/[slug]/page.tsx` and `ProjectDetailTabs.tsx`). Slack messages must use that format—not path segments such as `/projects/{slug}/resourcing` or `/projects/{slug}/status-reports` (those paths do not open the tabbed project page).

| Message type | Workbench link | Float link |
|--------------|----------------|------------|
| **Resourcing request** (`POST .../slack/resourcing-request`) | `{WORKBENCH_BASE_URL}/projects/{slug}?tab=resourcing` | When **`Project.floatLink`** is set (**Settings → Links**): external **View in Float →** mrkdwn link. When unset: plain _Float not linked_ (no link). |
| **Missing-actuals nudge** (`trigger/missingActualsNudge.ts`) | Same resourcing tab URL | — |
| **Health update** (`POST .../slack/health-update`) | `{WORKBENCH_BASE_URL}/projects/{slug}?tab=status-reports` | — |

**URL builder:** `lib/workbenchUrls.ts` — `getWorkbenchBaseUrl()`, `projectTabUrl(slug, tab)`, `projectResourcingUrl(slug)`, `projectStatusReportsUrl(slug)`. Used by Slack message routes so links stay aligned with in-app tab routing.

**Legacy Slack links:** Older resourcing messages used `/projects/{slug}/resourcing`. That path **redirects** to `?tab=resourcing` via `app/(app)/projects/[slug]/resourcing/page.tsx` so existing posts keep working without edits. Older health-update messages that used `/projects/{slug}/status-reports` have **no** redirect; new posts use `?tab=status-reports` only.

### Resourcing fulfill variance

When an editor runs **`POST .../slack/resourcing-request/fulfill`** (or **Mark fulfilled** in the UI), the server:

1. Marks the open **`ResourcingRequest`** as **`FILLED`**, clears **Ready** flags, runs **`executeFloatApiSync`**, and posts **✅ Marked as fulfilled** in the Slack thread (reaction + thread reply when **`SLACK_BOT_TOKEN`** and message metadata exist).
2. Loads current **Float** and **Planned** hours for the snapshot window and runs **`lib/resourcingFulfillVariance.ts`** (`computeResourcingFulfillVariance`).
3. Posts a second thread message **only when** `hasVariance` is true.

**`requestedPeople` JSON (create):** Preferred shape:

```json
{
  "snapshotStartKey": "YYYY-MM-DD",
  "snapshotEndKey": "YYYY-MM-DD",
  "people": [
    {
      "personId": "...",
      "name": "...",
      "requested": true,
      "hoursSnapshot": [{ "weekStartDate": "YYYY-MM-DD", "hours": 0 }]
    }
  ]
}
```

Legacy requests may store a **bare array** of people (no window keys); fulfill falls back to **Monday-on-or-before-today UTC** for the window. **`hoursSnapshot`** is Float hours at request time for everyone in the Float window (plus **Ready** people with no Float rows yet).

**Variance rules (week-by-week, tolerance `1e-9`):**

| Who | Condition | Slack bucket |
|-----|-----------|--------------|
| **Ready** (`requested: true`) | Post-sync Float **matches** Planned at fulfill | No variance for that person |
| **Ready** | Float ≠ Planned and Float **unchanged** vs request **`hoursSnapshot`** | *Requested — no Float changes detected* |
| **Ready** | Float ≠ Planned and Float **changed** vs snapshot | *Requested — partial week updates* (includes full mismatch vs Planned when Float did move) |
| **Non-Ready** | Float **unchanged** vs request **`hoursSnapshot`** | No variance (even if Float ≠ Planned) |
| **Non-Ready** | Float **changed** vs request **`hoursSnapshot`** | *Unexpected Float changes (not requested)* with week deltas (`YYYY-MM-DD: 8h → 16h`) |

**Implementation files:** `app/api/projects/[id]/slack/resourcing-request/route.ts` (create + snapshot), `app/api/projects/[id]/slack/resourcing-request/fulfill/route.ts` (fulfill + Slack), `lib/resourcingFulfillVariance.ts`, `lib/resourcingSnapshotWindow.ts`. Tests: `__tests__/lib/resourcingFulfillVariance.test.ts`.

### Slack app setup (operators)

- Create a Slack app, install to workspace, add **Bot Token Scopes** as needed for: posting messages, opening DMs (`conversations.open`), reading/posting in channels the bot is invited to, adding reactions (fulfill flow). Copy the **Bot User OAuth Token** into **`SLACK_BOT_TOKEN`**.
- Invite the bot to the **resourcing**, **project**, and **account** channels used in Workbench.
- Use Slack’s UI (or API) to copy **channel IDs** (`C…`) and **member IDs** (`U…`) into Workbench.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| **DATABASE_URL** | Yes | PostgreSQL connection string (app runtime and `PrismaClient` via `@prisma/adapter-pg` in `lib/prisma.ts`). |
| **DIRECT_URL** | Optional | Non-pooled URL (e.g. Neon direct). **Prisma 7** reads migration/introspection URLs from `prisma.config.ts`, not `schema.prisma`; that file uses `DIRECT_URL` when set, else `DATABASE_URL`. Set **DIRECT_URL** on Neon if `migrate deploy` / `db push` fail through the pooler. |
| **`npm run db:migrate`** | | Runs `prisma migrate deploy` after loading **`.env` then `.env.local`** (same order as Next.js). Use this locally if Float sync or Prisma errors with a missing column on `ProjectAssignment` — migrations were often applied only to the DB in `.env` while `next dev` uses `DATABASE_URL` from `.env.local`. |
| **Prisma client** | | `lib/prisma.ts` extends the client so `ProjectAssignment` queries omit or strip `syncRoleFromFloat` when that column is not present in the connected database (detected via `information_schema`), so the app and Float sync do not crash before migrations catch up. After migrating, restart the dev server so the column-existence cache refreshes. |
| **NEXTAUTH_URL** | Yes | App URL (e.g. `https://your-app.vercel.app` or `http://localhost:3000`). |
| **NEXTAUTH_SECRET** | Yes (production) | Secret for signing cookies/JWTs; at least 32 characters. Generate: `openssl rand -base64 32`. |
| **SEED_ADMIN_EMAIL** | For seed | Email for the initial admin user. Required in production. |
| **SEED_ADMIN_PASSWORD** | For seed | Password for the initial admin user. Required in production. |
| **SEED_SECRET** | Optional | Used for one-time seed via API (Bearer token). |
| **UPSTASH_REDIS_REST_URL** | Optional | Upstash Redis REST URL for rate limiting. |
| **UPSTASH_REDIS_REST_TOKEN** | Optional | Upstash Redis REST token. |
| **BLOB_READ_WRITE_TOKEN** | Optional | Vercel Blob token for caching status report PDFs; if unset, PDFs are generated on demand without cache. |
| **FLOAT_API_TOKEN** | For Float sync | Bearer token for Float API v3 (`/v3/people`, `/v3/projects`, `/v3/tasks`, `/v3/timeoffs`, `/v3/public-holidays`, `/v3/holidays` (team holidays), etc.). Required for `POST /api/admin/float-sync` and `GET /api/admin/float-holidays` to run; omit only if you never use sync. |
| **FLOAT_API_USER_AGENT_EMAIL** | Optional | Contact email embedded in `User-Agent` for Float API requests (recommended). |
| **SLACK_BOT_TOKEN** | For Slack | Bot token for Slack Web API. See [Slack integration](#slack-integration). |
| **WORKBENCH_BASE_URL** | Optional | Canonical public URL for links inside Slack messages. See [Slack integration](#slack-integration). |

When Upstash is set, rate limits apply: login (per IP), seed (per IP), float sync (`floatImportRatelimit`, same Redis prefix as legacy “float-import”; 20 per 15 min per user). Without them, rate limiting is skipped (e.g. local dev).

---

## Week and as-of semantics

Implemented in `lib/weekUtils.ts`:

- **Week** — Starts Monday 00:00 UTC. All hour data is keyed by this Monday date.
- **As-of date** — End of the previous week (Sunday 23:59:59 UTC). Used to determine:
  - Which weeks are “completed” (weekStartDate ≤ asOfDate).
  - Which weeks are “future” (weekStartDate > asOfDate).
- **To-date rollups** — Only include weeks where weekStartDate ≤ asOfDate; the current week is never included in “to date” totals.
- Users cannot change the as-of date; it is derived from the current time.

---

## Permissions

Permission helpers live in `lib/auth.ts`; NextAuth configuration (session, credentials provider) is in `lib/auth.config.ts`.

| Permission | Capabilities |
|------------|--------------|
| **User** | View and edit projects (assignments, hours, budget, rates, key roles). Can **mark resourcing requests fulfilled** and run the Float sync step tied to fulfillment when Slack is configured. Cannot access Admin. |
| **Admin** | Everything User can do, plus: Admin area (Float sync, Holidays, Roles, **Industry groups**, People, Users, **Slack**, **Accounts**), delete projects. |

Session permission is read from the current user’s `permissions` field (User or Admin). See **Projects list page** below for how “My Projects” resolves the current user’s `Person` and filters `ProjectKeyRole`.

In production, `NEXTAUTH_SECRET` must be set and at least 32 characters; the app fails fast at startup if not.

---

## Projects list page

Server-rendered route: `app/(app)/projects/page.tsx` (no separate list API—the page queries Prisma directly).

| Topic | Implementation |
|--------|------------------|
| **My Projects** | `getDashboardContext(session)` returns `personId` (cached 60s per user in `lib/dashboardContext.ts`). The projects list page and PM/PGM/CAD dashboards call this helper when they need the current user’s linked **Person** id. Filter: `projectKeyRoles: { some: { personId } } }` (any PM/PGM/CAD key role). If no `Person` is linked, the filter uses an impossible id so the table is empty. |
| **Query params** | `filter` (`my` \| `active` \| `closed` \| `all`), `sort` (`name` \| `clientName` \| `status` \| `pms` \| `pgm` \| `cad`), `dir` (`asc` \| `desc`), `page` (default `1`), `pageSize` (default `100`, max `200`). Legacy `?filter=atRisk` is normalized to `all`. |
| **Data loading** | `findMany` uses a **narrow `select`**: project id/slug/name/clientName/status and `projectKeyRoles` with `person.name` only (not full `Project` rows). |
| **Status filter index** | `Project` has `@@index([status])` for Active/Closed filters. |
| **Pagination** | For sorts on **Name / Client / Status**, Prisma `skip` / `take` apply after `count`. For sorts on **PMs / PGM / CAD**, the full filtered set is loaded in memory, sorted in JS, then **sliced** to the current page (same ordering semantics as before pagination; use smaller catalogs or avoid key-role sorts if memory is a concern). |
| **Float “last updated”** | `unstable_cache` on the latest `FloatImportRun` (60s revalidate), key `float-last-import`. |
| **At Risk** | Removed from the UI and API; portfolio risk signals remain on PM/PGM/CAD dashboards (`lib/portfolioMetrics.ts`, dashboard pages). |

---

## Scripts and commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server. |
| `npm run build` | Production build. |
| `npm run start` | Start production server. |
| `npm test` | Run tests (Vitest). |
| `npm run test:unit` | Run library unit tests only (`__tests__/lib`), no database required. |
| `npm run migrate:split-week-actuals` | One-off backfill of `ActualHoursMonthSplit` for split-month weeks (pro-rata by UTC calendar day). Requires `npx prisma migrate deploy` first so the `ActualHoursMonthSplit` table exists. Default is dry-run; pass `--apply` to write. Optional `--project=<id>`. See `scripts/migrate-split-week-actuals.ts`. |
| `npm run db:deploy` | Run `prisma migrate deploy` and `prisma db seed` (e.g. for production). |
| `npx prisma migrate dev` | Apply migrations in development (interactive). |
| `npx prisma db seed` | Run seed script (creates initial admin and roles). |
| `npx prisma migrate deploy` | Apply pending migrations (e.g. in CI/production). |
| `npx tsx scripts/sample-data.ts` | Create sample project, people, assignments, hours, and budget line (for testing). |
| `npx trigger.dev@latest dev` / `deploy` | Optional: run or deploy Trigger.dev tasks (`trigger/`): scheduled Float sync, missing-actuals Slack nudges. Requires Trigger.dev project config and env vars (**`DATABASE_URL`**, **`FLOAT_API_TOKEN`**, **`SLACK_BOT_TOKEN`** as applicable). |

---

## API overview

API routes live under `app/api/`. This is a high-level overview for maintainers.

| Area | Route(s) | Purpose |
|------|----------|---------|
| Auth | `/api/auth/[...nextauth]` | NextAuth sign-in, sign-out, session. |
| Seed | `/api/seed` | POST with Bearer token (SEED_SECRET) to run seed once (e.g. after deploy). |
| Company | `GET /api/company/pto-holidays` | Company-wide PTO and holiday payload for **PTO & Holidays** (`/pto-holidays`): active people plus week-bucketed impacts (~12 months from today). Session required. Implemented in `lib/companyPtoServer.ts`. |
| Projects | `GET/POST /api/projects` | List projects (with filter), create project. **`POST`** creates the project, then—if the name (or optional **`floatProjectName`**) matches a Float project in merged **`FloatImportRun`** history—upserts **`ProjectAssignment`** rows (role resolution via `resolveRoleIdForNewAssignmentFromFloat` / `lib/float/roleWorkbenchMatch.ts`), creates missing **`Person`** rows, and batch-upserts **`FloatScheduledHours`** from `getProjectDataFromAllImports` + `floatScheduledHourRowsFromMergedLists`. Response may include **`backfillFromImport`** (`matched`, `assignmentsCreated`, `floatHoursCreated`, optional `floatHoursNote`). |
| Project | `GET/PATCH/DELETE /api/projects/[id]` | Single project CRUD. **`[id]`** is either the project’s **primary key (CUID)** or its current **slug** (`resolveProject` in `app/api/projects/[id]/route.ts`). Responses include **`account`** when present (**`account.industryGroup`** for inherited industry taxonomy). **`PATCH`** accepts optional **`slackChannelId`** (Slack channel `C…` or null) for **missing-actuals Tue/Wed nudges** (not status health posts). **`PATCH`** and **`DELETE`** revalidate Next.js cache tags **`portfolio-metrics`**, **`projects-list`**, and **`project-detail`** (the project detail page uses `getCachedProjectBySlugOrId` in `lib/projectCache.ts` with a `project-detail` tag). **`PATCH`** accepts optional `cdaReportHoursOnly` (boolean): when `true`, CDA “Overall” status copy and CDA status reports omit budget-dollar columns (hours columns only). See *CDA report hours only* below. **Client note:** `components/ProjectSettingsTab.tsx` calls **`PATCH`**, **backfill-float**, and **sync-plan-from-float** with **`/api/projects/{projectId}`** (CUID) so autosave still resolves the row after a **name** change regenerates the slug; on **`PATCH`** success, if the response **`slug`** differs from the URL segment, the app **`router.replace`**s to `/projects/{newSlug}?tab=settings`. |
| Project | `POST /api/projects/[id]/slack/health-update`, `POST .../slack/resourcing-request`, `POST .../slack/resourcing-request/fulfill` | Slack integrations; see [Slack integration](#slack-integration). |
| Project | `/api/projects/[id]/assignments` | Assignments for a project. |
| Project | `/api/projects/[id]/resourcing` | Single endpoint for Resourcing tab (assignments, planned/actual/float hours, cell comments). |
| Project | `/api/projects/[id]/planned-hours`, `actual-hours`, `float-hours` | Hour entries by project. **`actual-hours`**: `GET` returns `rows` and `monthSplits` (split-week breakdowns). `PATCH` accepts either a single `hours` value or `parts` (`{ monthKey, hours }[]` where **`hours` may be `null`** to remove a month split) for split weeks—see *Split-week actual hours* above. |
| Project | `/api/projects/[id]/cell-comments` | Grid cell comments (Planned/Actual) for resourcing. |
| Project | `/api/projects/[id]/budget` | Budget rollups and status. |
| Project | `/api/projects/[id]/rates` | Role rates for the project. |
| Project | `/api/projects/[id]/revenue-recovery` | Revenue recovery to date. |
| Project | `/api/projects/[id]/cda`, `/api/projects/[id]/cda-milestones` | CDA monthly data and milestones. |
| Project | `/api/projects/[id]/timeline`, `timeline/bars`, `timeline/markers` | Timeline bars and markers. Bars support an optional `color` (6-digit hex, e.g. `#1941FA`) in GET responses and in POST/PATCH bodies; null means default blue. |
| Project | `/api/projects/[id]/status-reports`, `status-reports/[reportId]`, `status-reports/[reportId]/pdf`, **`POST status-reports/[reportId]/refresh-timeline`** | Status reports CRUD and PDF export (PDF may be cached in Vercel Blob). **`POST`** (create) returns **400** if the project has **missing actuals** (completed weeks with planned hours but no actuals)—`projectHasMissingActuals` (`lib/projectActualsStale.ts`). **`POST refresh-timeline`** (session, User/Admin): merges a freshly built **timeline** (from current `TimelineBar` / `TimelineMarker` rows and `report.reportDate` + `snapshot.timelinePreviousMonths`) into the existing JSON **snapshot** only; revalidates tag `status-report-{reportId}` and clears cached PDF. Requires a valid snapshot (`isStatusReportSnapshot` in `lib/statusReportPdfData.ts`); uses `buildStatusReportPdfData(..., { rebuildTimelineFromProject: true })`. Implementation: `app/api/projects/[id]/status-reports/[reportId]/refresh-timeline/route.ts`. |
| Project | `/api/projects/[id]/float-default-roles`, `backfill-float`, `sync-plan-from-float`, `ready-for-float` | Float-related backfill and flags. **Backfill** repopulates a project’s Float scheduled hours from stored import runs (also from Projects list via backfill icon with confirmation). **Sync plan from Float** (`POST sync-plan-from-float`) copies `FloatScheduledHours` into `PlannedHours` for all weeks that have Float data (assigned people), with CSV import fallback only for **completed** weeks missing a DB row; project Edit page with confirmation. |
| Projects | `GET /api/projects/my-pm-slugs` | JSON **`{ slugs: string[] }`** — project **slugs** where the current user is **PM**. Session required. Implemented in `app/api/projects/my-pm-slugs/route.ts`. (No first-party UI depends on this route today; useful for scripts or future features.) |
| People | `GET /api/people`, `/api/people/eligible-key-roles` | List people, people eligible for key roles. |
| Roles | `GET /api/roles` | List roles. |
| Account | `POST /api/account/change-password` | Change password for current user (current password required). |
| Account | **`GET/PATCH /api/account/profile`** | Self-service **Slack user ID** (`User.slackUserId`) and **Person** link (`Person.userId`). **GET** returns `{ slackUserId, person, peopleOptions }` where **`peopleOptions`** lists active people with **`userId` null** or already linked to this user. **PATCH** body: `{ slackUserId?: string \| null, personId?: string \| null }`; clears **`userId`** on the user’s previous person when unlinking or switching. Link writes use **`applyUserPersonLinkInTransaction`** (`lib/userPersonLink.ts`); rejects linking a person already tied to another user. UI: **`app/(app)/account/page.tsx`**. |
| Admin | `GET/POST /api/admin/float-sync` | Float API sync: `GET` returns latest `FloatImportRun`; `POST` pulls tasks, time off, holidays, and reference data from Float and applies the same DB effects as `applyFloatImportDatabaseEffects` (Admin only). |
| Admin | `POST /api/admin/backfill-float-all` | **Admin only.** Restores `FloatScheduledHours` for **all** projects from merged `FloatImportRun` history (`lib/backfillFloatFromImports.ts`), same rules as `POST /api/projects/[id]/backfill-float` per project. Returns JSON with counts (`upsertsTotal`, `projectsWithData`, `projectsSkipped`, `importRunCount`). Revalidates `project-resourcing`. UI: **Admin → Float sync** → **Restore hours from import history (all projects)**. If there are no `FloatImportRun` rows, responds with `ok: false` and an error message (HTTP 200). |
| Admin | `GET /api/admin/float-holidays` | Lists Float public and team holidays for the query window (default like sync); Admin only; requires `FLOAT_API_TOKEN`. |
| Admin | `/api/admin/roles`, `/api/admin/people`, `/api/admin/users` | CRUD for roles, people, app users (Admin only). **`PATCH /api/admin/users/[id]`** accepts optional **`slackUserId`** and **`industryGroupId`** (nullable); **GET** responses include **`industryGroup`** when set. |
| Admin | **`GET /api/admin/industry-groups`**, **`POST /api/admin/industry-groups`**, **`PATCH /api/admin/industry-groups/[id]`** | List/create/update **IndustryGroup** (rename, **`archived`** boolean → `archivedAt`). Responses include **`_count`** of linked accounts/users. |
| Admin | `/api/admin/slack-config`, `/api/admin/slack-config/notify-users`, `/api/admin/slack-config/notify-users/[userId]` | Slack org config and resourcing notify list. |
| Admin | `GET /api/admin/accounts`, `PATCH /api/admin/accounts/[id]` | Float-backed **Account** list; set **`slackChannelId`** and/or **`industryGroupId`** (nullable). **GET** includes **`industryGroup`** when set. |

**Admin Users UI** (`/admin/users`, `app/admin/users/page.tsx`): The user list is a `<table>` inside a card with **`overflow-x-auto`** so narrow viewports can scroll horizontally instead of clipping the **Actions** column. The main content area uses **`max-w-6xl`** so six columns fit more comfortably (**Industry group**, Slack user id, etc.). The **Actions** column uses **`whitespace-nowrap`** and the common **`w-[1%]`** table pattern so the **Edit** control keeps a stable width; name, email, and role cells use **truncation** plus **`title`** attributes for full-string tooltips where helpful. User updates (including optional password hash refresh and **`industryGroupId`**) go to **`PATCH /api/admin/users/[id]`** (`app/api/admin/users/[id]/route.ts`).

**Admin Industry groups** (`/admin/industry-groups`, `app/admin/industry-groups/page.tsx`): Create groups; edit name/archive; quick Archive/Restore; table shows **`_count`** of linked accounts/users. **Admin Accounts** (`app/admin/accounts/page.tsx`): **Industry group** column + selector in edit dialog (includes current value if archived).

All project and admin routes require an authenticated session; admin routes additionally require Admin permission.

**Projects list actions:** The Projects list shows an Actions column (for users with edit or delete permission) with icon buttons: Edit (link to project edit page), Backfill (confirmation dialog then POST to `backfill-float`), and Delete (Admin only; confirmation modal with type-to-confirm before DELETE).

### Resourcing API details

`GET /api/projects/[id]/resourcing` returns all data required for the Resourcing tab in a single response:

- Project start/end dates and resourcing thresholds
- **All project assignments**, each with **`hiddenFromGrid`** (boolean). The Resourcing tab **renders rows** only where **`hiddenFromGrid === false`**, but **column totals** sum hours for **every** assigned person (including hidden).
- Planned hours, actual hours, Float scheduled hours
- **`monthSplits`** — `ActualHoursMonthSplit` rows for split weeks (same week window as other hour data)
- **`ptoHolidayByWeek`** — map of week start key → PTO/holiday entries for **all** assignees (Float column pills / tooltips)
- Ready-for-Float flags
- Grid cell comments (Planned/Actual)

**Range filtering:**

- Optional query params: `fromWeek=YYYY-MM-DD` and `toWeek=YYYY-MM-DD` (week start / Monday in UTC).
- When provided, hour rows and comments are filtered to that week window.
- **Default behavior (no params):** returns the **full project span** from project start week → project end week (or current week when end date is null).

**Caching:**

- The route uses `unstable_cache` with a `project-resourcing:{projectId}` tag so writes to planned/actual/assignments/comments can revalidate the cached response.
- The cache key includes the project id and the `fromWeek/toWeek` window, so different ranges cache independently.

**Resourcing grid UI:** The column for the UTC week where `isCurrentWeek()` is true (`lib/weekUtils.ts`, same Monday 00:00 UTC week boundaries as the rest of the app) gets a subtle inset tint via the `resourcing-current-week` class on `th`/`td`, styled in `app/globals.css` and applied in `components/ResourcingGrids.tsx` for headers, body cells, and total/variance rows.

**Hidden from grid vs column totals:** **`ProjectAssignment.hiddenFromGrid`** hides a person’s **rows** in Planned / Actual / Float (and from **Ready** / resourcing-request UI, PTO tab person lists, and dashboard **`requestOpen`**—see `lib/portfolioMetrics.ts`). Their planned, actual, and float hours **still contribute** to each week’s **column total** and variance footer rows. The client builds **`allPersonIdsForRollup`** from **`assignments`** (all person ids), not from orphan hour rows that lack an assignment. **`sortedAssignments`** filters to **`!hiddenFromGrid`** for row rendering; **`syncPlanFromFloat`** on the Resourcing tab uses the same visible set.

**Weekly Actuals collapse (UI-only):** `ResourcingGrids` holds `actualsCollapsed` in React state (not persisted). When `true`, the middle table renders only its first header row (title + icon-only toggle); the column-header row, `<tbody>`, and `<tfoot>` are omitted. The wrapper that stacks the three grid cards uses `space-y-2` instead of `space-y-6` while collapsed so Planned and Float sit closer vertically. The control is `position: absolute` in the sticky title `<th>` (`ChevronUp` = expanded/collapse action, `ChevronDown` = collapsed/expand action) with `aria-expanded`, `aria-label`, and `title` matching **Hide weekly actuals** / **Show weekly actuals**. Horizontal scrolling still applies to the remaining grids inside the same `overflow-x-auto` container.

**Split-week cells — expansion state and keyboard (UI-only):** `expandedSplitCells` is a `Set<string>` of keys `${personId}|${weekStartKey}` for which the Actual grid renders the **expanded** two-field month split instead of the rolled-up total + expand affordance. **`setSplitCellExpanded`** mutates that set per cell. **Expand all / Collapse all** (header control) rebuilds the set to include every `(assignment × split week)` in the current column range or clears it. No API persistence.

Actual-hour **inputs** use **`data-resourcing-grid="actual"`**, **`data-resourcing-row`**, **`data-resourcing-col`**, and for split halves **`data-resourcing-split-frame="0"`** or **`"1"`**. **`focusActualGridInput(row, col, frame)`** focuses the matching split input or falls back to the single non-split input in that cell. **`handlePlannedGridArrowNav`** / **`handleActualGridArrowNav`** implement vertical navigation; per-cell split/rollup and comment icon buttons use **`tabIndex={-1}`** so **Tab** prefers the numeric fields.

### Status report rendering (HTML + PDF)

The status report preview and exported PDF are generated from the same component (`components/StatusReportView.tsx`). Any layout or typography changes (including fonts) must be made there so HTML preview and PDF export stay identical.

- **Snapshot and PDF data**: `lib/statusReportPdfData.ts` builds `StatusReportPDFData` for view, share, and `GET .../pdf/data`. On create, `POST .../status-reports` persists a JSON **snapshot** (period, `today`, budget, CDA, timeline, `timelinePreviousMonths`, etc.). Reads prefer snapshot fields so project edits do not alter old reports. **`rebuildTimelineFromProject`** in `BuildStatusReportPdfDataOptions` skips `snapshot.timeline` for one build so the timeline block can be rebuilt from live DB bars/markers (used by **`POST .../refresh-timeline`**). UI: `components/StatusReportsTab.tsx` (**Refresh timeline** + confirmation modal); preview refetch via `dataRefreshKey` on `components/StatusReportPreview.tsx`.
- **Status Reports tab (create/edit UX)**: After a successful **Save** (`POST`) or **Update** (`PATCH`), `StatusReportsTab` closes the form, refetches the paginated list (`GET .../status-reports`—**page 1** after create, current page after edit), and scrolls the **Status Reports** header into view (`scrollIntoView` + `scroll-mt-*`) so the user sees the table immediately.
- **Preview scale**: The in-app preview uses a responsive visual scale (CSS transform) to render the 16:9 slide larger for readability/presenting, while still fitting common viewport widths. This is *visual-only* and does not change the underlying layout dimensions of the slide.
- **PDF export (client-side)**: Primary export path is **Download PDF** in `components/StatusReportPreview.tsx` and `components/StatusReportPageContent.tsx`, which calls `captureStatusReportToPdf()` in `lib/statusReportPdfCapture.ts` (html2canvas-pro + jsPDF). The slide (`slideRef`) and optional meeting-notes block (`meetingNotesRef`) are captured separately. A separate server route `GET .../status-reports/[reportId]/pdf` renders `components/pdf/StatusReportDocument.tsx` via `@react-pdf/renderer` (cached in Vercel Blob when configured); the UI falls back to that link only when client capture fails.
- **PDF export scale**: Client-side export captures the DOM at its native layout size for pixel-perfect fidelity, then applies `exportScale` (default **1.5**) by generating a larger PDF page and placing the captured image at that larger size. This keeps the exported PDF matching the on-screen content while making the PDF easier to present at 100% zoom.
- **Meeting notes PDF page**: When `report.meetingNotes` is non-empty, export adds a **second page** after the 16:9 slide. Before capture, the notes element is pinned to **720px** width (same as `NOTES_PAGE_WIDTH_PT`), transforms cleared, and html2canvas receives explicit `width` / `height` / `windowWidth` / `windowHeight` from `offsetWidth` and `scrollHeight`. Page dimensions use `computeNotesPageSize()` (exported from `lib/statusReportPdfCapture.ts`; capped by `MAX_NOTES_PAGE_HEIGHT_PT × exportScale`). Custom `pdf.addPage([pageW, pageH])` must **not** pass `"portrait"` when `pageW > pageH` — jsPDF swaps dimensions and misaligns `addImage`. `StatusReportView` sets `style={{ width: 720, maxWidth: 720 }}` on the meeting-notes wrapper so preview and capture share one box width inside wide modals. Tests: `__tests__/lib/statusReportPdfCapture.test.ts`.
- **Timeline layout (tab and status report)**: The project Timeline tab and the status report timeline (preview and PDF) share the same layout. Month columns are **week-proportional**: column widths and vertical boundary lines are derived from the number of weeks in each month that fall within the range. The helper `getWeeksInMonthsForRange()` in `lib/monthUtils.ts` returns `weeksInMonths` and `monthBoundaryPositions` for a given date range and is used by `TimelineTab.tsx`, `StatusReportView.tsx`, and `StatusReportDocument.tsx`. Bars use full row height with top/bottom padding (no lane stacking); overlapping bars in the same row overlap visually.
- **Timeline bars (status report)**: The status report timeline shows only the “previous months” range (e.g. 1–4 months before the report date). Bars are **clipped** to that visible range via `getVisibleBarSegments()`: only the segment within `[timeline.startDate, timeline.endDate]` is drawn, and position/width are computed from that segment so the layout matches the shortened axis. Row height on the status report is compact (20px) to limit vertical space; the Timeline tab uses a larger row height (52px) for readability.
- **Timeline bar colors**: Each bar can have an optional color (hex string stored in `TimelineBar.color`). The Timeline tab offers a preset palette (Blue, Green, Amber, Teal, Slate, Violet); the same color is shown in the tab, status report preview, and PDF. Bars with no color use the default blue.
- **Meeting notes (HTML)**: Narrative **meeting notes** may contain HTML (e.g. pasted from Teams Copilot). `components/StatusReportView.tsx` renders sanitized HTML via `lib/meetingNotesHtml.ts`. Sanitization uses **`sanitize-html`** with an allowlist of tags and attributes (including safe **`style`** rules) so **server and client** produce the same string without loading **jsdom**. That avoids production **`ERR_REQUIRE_ESM`** failures seen when the stack used **`isomorphic-dompurify`** → **jsdom** → **html-encoding-sniffer** / **`@exodus/bytes`** under Next.js Turbopack SSR. Plain-text notes use line breaks and `TextWithLinks` (bare URLs and `[text](url)`). Unit tests: `__tests__/lib/meetingNotesHtml.test.ts`. Server React-PDF export still uses `bulletLines()` on meeting notes (HTML is not rendered on that fallback path).

### CDA projections (`lib/cdaCalculations.ts`)

The CDA **Budget** sub-tab card (`CDATab`) calls `computeCdaProjections({ contractHoursHigh, rows, currentMonthKey })`.

- **contractHoursHigh** (**H**): Same source as Overall hours “Planned” in the UI — sum of budget line **high** hours when present; else sum of CDA planned months.
- **Surplus at contract end**: `expectedSurplusEnd = roundToQuarter(H - projectedTotalBurn)` where `projectedTotalBurn` sums MTD actuals for `monthKey < currentMonthKey`, **planned** for the current month, and **planned** for all later months. Current-month MTD is **not** used in the projection.
- **Avg hours per future month**: `poolForFutureMonths = (H - burnedPrior) - plannedCurrent`, divided by `futureMonthCount` (rows with `monthKey > currentMonthKey`), `roundToQuarter`; `null` if `futureMonthCount === 0`.
- **Tests**: `__tests__/lib/cdaCalculations.test.ts`.
- The Overall table **Remaining** column remains `H - sum(all monthly MTD actuals)` (includes partial current month) and is separate from these projections.

### CDA report hours only (`cdaReportHoursOnly`)

- **Schema**: `Project.cdaReportHoursOnly` (`Boolean`, default `false`). Migration: `prisma/migrations/*_add_cda_report_hours_only/`.
- **Behavior**: When `true`, the CDA **Overall** row in status copy (`CDATab`), Status Reports tab CDA preview (`StatusReportsTab`), and CDA PDF (`StatusReportDocument`) **hide budget-dollar cells** (planned / actual / remaining dollars). Hours columns and monthly CDA tables are unchanged. The first “burn” donut on CDA reports uses **contract hours complete** instead of **budget burn** when this flag is on (`StatusReportView` / `StatusReportDocument` + `lib/statusReportPdfData.ts`).
- **API**: `PATCH /api/projects/[id]` with JSON `{ "cdaReportHoursOnly": true | false }` (validated in `app/api/projects/[id]/route.ts`). The CDA tab persists the toggle via this field.
- **Snapshots**: On status report create, `cdaReportHoursOnly` is copied into the report snapshot (`app/api/projects/[id]/status-reports/route.ts` / `lib/statusReportPdfData.ts`) so PDF/HTML for that report stay stable if the project flag changes later.

---

## Deployment

- **Build** — The build script runs `prisma migrate deploy` then `next build`, so `DATABASE_URL` must be set for the build environment (e.g. Vercel Production and Preview if you deploy there). Pending migrations are applied at build time; seed does not run during build. Releases that add **Slack** tables (`Account`, `AppConfig`, `ResourcingRequest`, `ActualsNudgeLog`, `User.slackUserId`, etc.) or **IndustryGroup** (`20260514160928_add_industry_group`) require those migrations to run before the new routes/UI are used.
- **Migrations and seed** — After deploy, create the initial admin user via `npm run db:deploy` (with production `DATABASE_URL`) or the one-time seed API (`POST /api/seed` with Bearer token and `SEED_SECRET`; set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in production). Migrations are applied in **folder-name order** (lexicographic); new migrations must use timestamps that sort after any migrations they depend on (e.g. the `add_timeline_bar_color` migration must run after the migration that creates the `TimelineBar` table).

For full steps (Vercel env vars, rate limiting, one-time seed), see the main **README** in the repository.

---

*For end-user workflows and Float sync, see the User Guide.*
