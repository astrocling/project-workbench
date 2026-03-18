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
| **FloatScheduledHours** | Float-imported scheduled hours by project, person, week (Monday). |
| **PTOHolidayImpact** | PTO/holiday by person and week. |
| **BudgetLine** | Budget line (type: SOW/CO/Other, label, low/high hours and dollars; values may be negative for change orders). |
| **ReadyForFloatUpdate** | Per-project, per-person flag for Float sync. |
| **GridCellComment** | Optional comment on a resourcing grid cell (Planned or Actual) by project, person, week. |
| **StatusReport** | Status report (reportDate, variation: Standard/Milestones/CDA, RAG fields, completed/upcoming/risks/meeting notes, snapshot JSON). |
| **CdaMonth** | CDA monthly planned and MTD actuals by project and month (YYYY-MM). |
| **CdaMilestone** | CDA milestone (phase, dev/UAT/deploy dates, completed). |
| **TimelineBar** | Timeline bar (row, label, start/end date) for a project. |
| **TimelineMarker** | Timeline marker (shape, label, date) on a bar row. |
| **FloatImportRun** | Metadata for each Float import (timestamp, unknown roles, new people, project names, JSON for backfill and client mapping). |

Weeks are always identified by **week start date** (Monday) in UTC. All hour tables use `(projectId, personId, weekStartDate)` (or equivalent for PTO) as the scope.

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
| Project | `/api/projects/[id]/planned-hours`, `actual-hours`, `float-hours` | Hour entries by project. |
| Project | `/api/projects/[id]/cell-comments` | Grid cell comments (Planned/Actual) for resourcing. |
| Project | `/api/projects/[id]/budget` | Budget rollups and status. |
| Project | `/api/projects/[id]/rates` | Role rates for the project. |
| Project | `/api/projects/[id]/revenue-recovery` | Revenue recovery to date. |
| Project | `/api/projects/[id]/cda`, `/api/projects/[id]/cda-milestones` | CDA monthly data and milestones. |
| Project | `/api/projects/[id]/timeline`, `timeline/bars`, `timeline/markers` | Timeline bars and markers. |
| Project | `/api/projects/[id]/status-reports`, `status-reports/[reportId]`, `status-reports/[reportId]/pdf` | Status reports CRUD and PDF export (PDF may be cached in Vercel Blob). |
| Project | `/api/projects/[id]/float-default-roles`, `backfill-float`, `ready-for-float` | Float-related backfill and flags. Backfill is also available from the Projects list via the backfill icon (with confirmation); use it to repopulate a project’s Float scheduled hours from stored import runs (e.g. when the project was created after an import or historical data was missing). |
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
- Ready-for-Float flags
- Grid cell comments (Planned/Actual)

**Range filtering:**

- Optional query params: `fromWeek=YYYY-MM-DD` and `toWeek=YYYY-MM-DD` (week start / Monday in UTC).
- When provided, hour rows and comments are filtered to that week window.
- **Default behavior (no params):** returns the **full project span** from project start week → project end week (or current week when end date is null).

**Caching:**

- The route uses `unstable_cache` with a `project-resourcing:{projectId}` tag so writes to planned/actual/assignments/comments can revalidate the cached response.
- The cache key includes the project id and the `fromWeek/toWeek` window, so different ranges cache independently.

### Status report rendering (HTML + PDF)

The status report preview and exported PDF are generated from the same component (`components/StatusReportView.tsx`). Any layout or typography changes (including fonts) must be made there so HTML preview and PDF export stay identical.

---

## Deployment

- **Build** — The build script runs `prisma migrate deploy` then `next build`, so `DATABASE_URL` must be set for the build environment (e.g. Vercel Production and Preview if you deploy there). Pending migrations are applied at build time; seed does not run during build.
- **Migrations and seed** — After deploy, create the initial admin user via `npm run db:deploy` (with production `DATABASE_URL`) or the one-time seed API (`POST /api/seed` with Bearer token and `SEED_SECRET`; set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in production).

For full steps (Vercel env vars, rate limiting, one-time seed), see the main **README** in the repository.

---

*For end-user workflows and Float CSV format, see the User Guide.*
