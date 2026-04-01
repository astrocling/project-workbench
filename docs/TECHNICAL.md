# Project Workbench — Technical Reference

This document summarizes the technical stack, data model, environment, and APIs for developers and deployers. It is written in standard Markdown for easy copy-paste into Confluence (Markdown macro or paste as Markdown).

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Auth | NextAuth.js (credentials: email/password) |
| UI | Tailwind CSS, TanStack Table, React Hook Form, Zod, Recharts |
| Optional | Upstash Redis (rate limiting in production) |

---

## Data model (overview)

The schema is defined in `prisma/schema.prisma`. Main entities:

| Entity | Purpose |
|--------|---------|
| **User** | App login (email, password hash, permissions: User/Admin, optional position role). |
| **Person** | Resource (name, email, active, optional externalId). Used for assignments and Float import; may be linked to User by email/name for “My Projects”. |
| **Role** | Role type (e.g. Project Manager, FE Developer). Used on assignments and in Float CSV. |
| **Project** | Project (slug, name, client, start/end dates, status, optional single rate, notes, SOW/estimate/float/metric links, resourcing thresholds, cdaEnabled, optional clientSponsor/keyStaffName for status reports). |
| **ProjectAssignment** | Person assigned to a project in a role; optional bill-rate override; optional hiddenFromGrid (hide from Resourcing tab only). |
| **ProjectRoleRate** | Per-role bill rate for a project (rate card). |
| **ProjectKeyRole** | Key role assignment (PM, PGM, CAD) per project and person. |
| **PlannedHours** | Planned hours by project, person, week (Monday). |
| **ActualHours** | Actual hours by project, person, week (Monday); null = missing. |
| **ActualHoursMonthSplit** | When a week spans two calendar months (Mon–Sun UTC), actual hours split by `monthKey` (YYYY-MM) and `(projectId, personId, weekStartDate)`. Hours are quarter-hour increments; the two parts sum to the same total as the parent week. Used for CDA MTD actuals and Resourcing UI. |
| **FloatScheduledHours** | Float-imported scheduled hours by project, person, week (Monday). |
| **PTOHolidayImpact** | PTO/holiday by person and week. |
| **BudgetLine** | Budget line (type: SOW/CO/Other, label, low/high hours and dollars; values may be negative for change orders). |
| **ReadyForFloatUpdate** | Per-project, per-person flag for Float sync. |
| **GridCellComment** | Optional comment on a resourcing grid cell (Planned or Actual) by project, person, week. |
| **StatusReport** | Status report (reportDate, variation: Standard/Milestones/CDA, RAG fields, completed/upcoming/risks/meeting notes, snapshot JSON). |
| **CdaMonth** | CDA monthly planned and MTD actuals by project and month (YYYY-MM). |
| **CdaMilestone** | CDA milestone (phase, dev/UAT/deploy dates, completed). |
| **TimelineBar** | Timeline bar (row, label, start/end date, optional color hex) for a project. |
| **TimelineMarker** | Timeline marker (shape, label, date) on a bar row. |
| **FloatImportRun** | Metadata for each Float import (timestamp, unknown roles, new people, project names, JSON for backfill and client mapping). |

Weeks are always identified by **week start date** (Monday) in UTC. All hour tables use `(projectId, personId, weekStartDate)` (or equivalent for PTO) as the scope.

### Split-week actual hours

When `getMonthKeysForWeek(weekStartDate)` returns two month keys, that week is a **split week**. Implementation notes:

- **`lib/monthUtils.ts`** — `getMonthKeysForWeek` / related helpers determine which months a week touches (UTC calendar days). **`isPastLastUtcDayOfMonthInWeek`** — used by the Resourcing Actual split cell so the **first** month’s hours become editable after that UTC calendar month ends, while the **second** month still follows completed-week rules (`isCompletedWeek` / not current week).
- **`lib/splitWeekProRata.ts`** — Pro-rates a total hour value across two months by **UTC calendar-day count** within the week (largest-remainder to quarter hours). Used by `scripts/migrate-split-week-actuals.ts` to backfill `ActualHoursMonthSplit` from legacy `ActualHours` rows that only had a single total.
- **`ActualHours`** still stores the **rolled-up total** for the week (same as before). When month splits exist for a `(personId, weekStartDate)`, the Resourcing and CDA logic prefer splits for per-month attribution and skip double-counting that week’s total in month rollups.
- **API `PATCH /api/projects/[id]/actual-hours`** — Either `{ personId, weekStartDate, hours }` (single value, nullable to clear) **or** `{ personId, weekStartDate, parts: [{ monthKey, hours }, { monthKey, hours }] }` with two distinct `monthKey` values matching the week. **GET** returns `{ rows, monthSplits }` for the optional week range query params.
- **`GET /api/projects/[id]/resourcing`** — Includes `monthSplits` alongside planned/actual/float so the Resourcing grid can render split cells.
- **`GET /api/projects/[id]/cda`** — Computes per-month MTD actuals from `ActualHoursMonthSplit` plus `ActualHours` for weeks that fall entirely in one month (weeks with splits are excluded from the single-month path to avoid double count).

Unit tests: `__tests__/lib/splitWeekProRata.test.ts`, `__tests__/lib/monthUtils.test.ts` (where applicable).

### PM / PGM / CAD dashboards

- **`lib/portfolioMetrics.ts`** — Builds per-role portfolio metrics and `projectTableRows` for the dashboard projects table. Each row includes **`recoveryThisWeekPercent`** (revenue recovery % for the most recent completed week only—aligned with `revenueRecovery.thisWeek`) and **`recovery4WeekPercent`** (rolling sum over the previous four completed weeks—aligned with the “Previous 4 weeks” portfolio card). Also: burn, buffer, actuals status, status-report RAG / stale flag, and **`requestOpen`** (true when any `ReadyForFloatUpdate` has `ready: true` for a person on a non–hidden-from-grid assignment—same visibility rule as `GET /api/projects/[id]/resourcing`).
- **`components/DashboardProjectsTable.tsx`** — Renders the sortable table (including the **Request** column). Sort state is driven by URL query params `sort` and `dir` on `/pm-dashboard`, `/pgm-dashboard`, and `/cad-dashboard` (see `app/(app)/*-dashboard/page.tsx`). Valid `sort` keys include `requestOpen`.
- **`PATCH /api/projects/[id]/ready-for-float`** — Updates `ReadyForFloatUpdate`; revalidates `project-resourcing:{id}` and **`portfolio-metrics`** so dashboard `requestOpen` stays in sync.
- **`components/DashboardClientFilter.tsx`** — Optional client filter; invalid `client` query values redirect to the unfiltered dashboard.

### Float import behavior

Implemented in `app/api/admin/float-import/route.ts`:

- **Writes:** Only **current and future** weeks are written to `FloatScheduledHours` (weeks with `weekStartDate > asOf`). Past weeks are never overwritten, so historical float data (e.g. for revenue recovery) is preserved when the Float export covers a limited date range (e.g. one year forward).
- **Cleanup:** After upserting from the CSV, the import deletes **future** `FloatScheduledHours` for any `(projectId, personId)` that appears in the DB for a project in the import but is **not** in the current CSV (person removed from the project in Float). Past weeks for that person are never deleted. Project assignments are not modified.
- **New projects:** When a project is created or backfill-float is run, data comes from stored `FloatImportRun.projectFloatHours` (and `getProjectDataFromAllImports` for project create), which can include all weeks from prior imports; the cleanup step runs only during the float import, not on create or backfill.

An integration test in `__tests__/api/admin/float-import-cleanup.test.ts` asserts that a person omitted from the CSV has their future float hours removed and past weeks retained.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| **DATABASE_URL** | Yes | PostgreSQL connection string. |
| **NEXTAUTH_URL** | Yes | App URL (e.g. `https://your-app.vercel.app` or `http://localhost:3000`). |
| **NEXTAUTH_SECRET** | Yes (production) | Secret for signing cookies/JWTs; at least 32 characters. Generate: `openssl rand -base64 32`. |
| **SEED_ADMIN_EMAIL** | For seed | Email for the initial admin user. Required in production. |
| **SEED_ADMIN_PASSWORD** | For seed | Password for the initial admin user. Required in production. |
| **SEED_SECRET** | Optional | Used for one-time seed via API (Bearer token). |
| **UPSTASH_REDIS_REST_URL** | Optional | Upstash Redis REST URL for rate limiting. |
| **UPSTASH_REDIS_REST_TOKEN** | Optional | Upstash Redis REST token. |
| **BLOB_READ_WRITE_TOKEN** | Optional | Vercel Blob token for caching status report PDFs; if unset, PDFs are generated on demand without cache. |

When Upstash is set, rate limits apply: login (per IP), seed (per IP), float-import (per user). Without them, rate limiting is skipped (e.g. local dev).

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
| **User** | View and edit projects (assignments, hours, budget, rates, key roles). Cannot access Admin. |
| **Admin** | Everything User can do, plus: Admin area (Float Import, Roles, People, Users), delete projects. |

Session permission is read from the current user’s `permissions` field (User or Admin). “My Projects” filter uses the user’s optional position role (PM, PGM, CAD) and matches projects where that person is a key role.

In production, `NEXTAUTH_SECRET` must be set and at least 32 characters; the app fails fast at startup if not.

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

---

## API overview

API routes live under `app/api/`. This is a high-level overview for maintainers.

| Area | Route(s) | Purpose |
|------|----------|---------|
| Auth | `/api/auth/[...nextauth]` | NextAuth sign-in, sign-out, session. |
| Seed | `/api/seed` | POST with Bearer token (SEED_SECRET) to run seed once (e.g. after deploy). |
| Projects | `GET/POST /api/projects` | List projects (with filter), create project. |
| Projects | `GET /api/projects/at-risk` | List projects that are at risk (over/under resourced). |
| Project | `GET/PATCH/DELETE /api/projects/[id]` | Single project CRUD. |
| Project | `/api/projects/[id]/assignments` | Assignments for a project. |
| Project | `/api/projects/[id]/resourcing` | Single endpoint for Resourcing tab (assignments, planned/actual/float hours, cell comments). |
| Project | `/api/projects/[id]/planned-hours`, `actual-hours`, `float-hours` | Hour entries by project. **`actual-hours`**: `GET` returns `rows` and `monthSplits` (split-week breakdowns). `PATCH` accepts either a single `hours` value or `parts` (two `{ monthKey, hours }`) for split weeks—see *Split-week actual hours* above. |
| Project | `/api/projects/[id]/cell-comments` | Grid cell comments (Planned/Actual) for resourcing. |
| Project | `/api/projects/[id]/budget` | Budget rollups and status. |
| Project | `/api/projects/[id]/rates` | Role rates for the project. |
| Project | `/api/projects/[id]/revenue-recovery` | Revenue recovery to date. |
| Project | `/api/projects/[id]/cda`, `/api/projects/[id]/cda-milestones` | CDA monthly data and milestones. |
| Project | `/api/projects/[id]/timeline`, `timeline/bars`, `timeline/markers` | Timeline bars and markers. Bars support an optional `color` (6-digit hex, e.g. `#1941FA`) in GET responses and in POST/PATCH bodies; null means default blue. |
| Project | `/api/projects/[id]/status-reports`, `status-reports/[reportId]`, `status-reports/[reportId]/pdf` | Status reports CRUD and PDF export (PDF may be cached in Vercel Blob). |
| Project | `/api/projects/[id]/float-default-roles`, `backfill-float`, `sync-plan-from-float`, `ready-for-float` | Float-related backfill and flags. **Backfill** repopulates a project’s Float scheduled hours from stored import runs (also from Projects list via backfill icon with confirmation). **Sync plan from Float** (`POST sync-plan-from-float`) copies Float into the Project Plan (PlannedHours) for past weeks only so the plan grid and revenue recovery forecast are populated; uses FloatScheduledHours and stored import runs; available from the project Edit page with confirmation. |
| Projects | `GET /api/projects/my-pm-slugs` | Project slugs where current user is PM (e.g. for sidebar). |
| People | `GET /api/people`, `/api/people/eligible-key-roles` | List people, people eligible for key roles. |
| Roles | `GET /api/roles` | List roles. |
| Account | `POST /api/account/change-password` | Change password for current user (current password required). |
| Admin | `GET/POST /api/admin/float-import` | Float CSV import (Admin only). |
| Admin | `/api/admin/roles`, `/api/admin/people`, `/api/admin/users` | CRUD for roles, people, app users (Admin only). |

All project and admin routes require an authenticated session; admin routes additionally require Admin permission.

**Projects list actions:** The Projects list shows an Actions column (for users with edit or delete permission) with icon buttons: Edit (link to project edit page), Backfill (confirmation dialog then POST to `backfill-float`), and Delete (Admin only; confirmation modal with type-to-confirm before DELETE).

### Resourcing API details

`GET /api/projects/[id]/resourcing` returns all data required for the Resourcing tab in a single response:

- Project start/end dates and resourcing thresholds
- Visible assignments (excludes `hiddenFromGrid`)
- Planned hours, actual hours, Float scheduled hours
- **`monthSplits`** — `ActualHoursMonthSplit` rows for split weeks (same week window as other hour data)
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

### Status report rendering (HTML + PDF)

The status report preview and exported PDF are generated from the same component (`components/StatusReportView.tsx`). Any layout or typography changes (including fonts) must be made there so HTML preview and PDF export stay identical.

- **Preview scale**: The in-app preview uses a responsive visual scale (CSS transform) to render the 16:9 slide larger for readability/presenting, while still fitting common viewport widths. This is *visual-only* and does not change the underlying layout dimensions of the slide.
- **PDF export scale**: Client-side export (`lib/statusReportPdfCapture.ts`) captures the DOM at its native layout size for pixel-perfect fidelity, then applies `exportScale` by generating a larger PDF page and placing the captured image at that larger size. This keeps the exported PDF matching the on-screen content while making the PDF easier to present at 100% zoom.
- **Timeline layout (tab and status report)**: The project Timeline tab and the status report timeline (preview and PDF) share the same layout. Month columns are **week-proportional**: column widths and vertical boundary lines are derived from the number of weeks in each month that fall within the range. The helper `getWeeksInMonthsForRange()` in `lib/monthUtils.ts` returns `weeksInMonths` and `monthBoundaryPositions` for a given date range and is used by `TimelineTab.tsx`, `StatusReportView.tsx`, and `StatusReportDocument.tsx`. Bars use full row height with top/bottom padding (no lane stacking); overlapping bars in the same row overlap visually.
- **Timeline bars (status report)**: The status report timeline shows only the “previous months” range (e.g. 1–4 months before the report date). Bars are **clipped** to that visible range via `getVisibleBarSegments()`: only the segment within `[timeline.startDate, timeline.endDate]` is drawn, and position/width are computed from that segment so the layout matches the shortened axis. Row height on the status report is compact (20px) to limit vertical space; the Timeline tab uses a larger row height (52px) for readability.
- **Timeline bar colors**: Each bar can have an optional color (hex string stored in `TimelineBar.color`). The Timeline tab offers a preset palette (Blue, Green, Amber, Teal, Slate, Violet); the same color is shown in the tab, status report preview, and PDF. Bars with no color use the default blue.

---

## Deployment

- **Build** — The build script runs `prisma migrate deploy` then `next build`, so `DATABASE_URL` must be set for the build environment (e.g. Vercel Production and Preview if you deploy there). Pending migrations are applied at build time; seed does not run during build.
- **Migrations and seed** — After deploy, create the initial admin user via `npm run db:deploy` (with production `DATABASE_URL`) or the one-time seed API (`POST /api/seed` with Bearer token and `SEED_SECRET`; set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in production). Migrations are applied in **folder-name order** (lexicographic); new migrations must use timestamps that sort after any migrations they depend on (e.g. the `add_timeline_bar_color` migration must run after the migration that creates the `TimelineBar` table).

For full steps (Vercel env vars, rate limiting, one-time seed), see the main **README** in the repository.

---

*For end-user workflows and Float CSV format, see the User Guide.*
