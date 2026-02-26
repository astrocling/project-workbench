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
| **Person** | Resource (name, email, active). Used for assignments and Float import; may be linked to User by email/name for “My projects”. |
| **Role** | Role type (e.g. Project Manager, FE Developer). Used on assignments and in Float CSV. |
| **Project** | Project (slug, name, client, start/end dates, status, optional single rate, notes, SOW/estimate/float/metric links, resourcing thresholds). |
| **ProjectAssignment** | Person assigned to a project in a role; optional bill-rate override. |
| **ProjectRoleRate** | Per-role bill rate for a project (rate card). |
| **ProjectKeyRole** | Key role assignment (PM, PGM, CAD) per project and person. |
| **PlannedHours** | Planned hours by project, person, week (Monday). |
| **ActualHours** | Actual hours by project, person, week (Monday); null = missing. |
| **FloatScheduledHours** | Float-imported scheduled hours by project, person, week (Monday). |
| **PTOHolidayImpact** | PTO/holiday by person and week. |
| **BudgetLine** | Budget line (type: SOW/CO/Other, label, low/high hours and dollars). |
| **ReadyForFloatUpdate** | Per-project, per-person flag for Float sync. |
| **FloatImportRun** | Metadata for each Float import (timestamp, unknown roles, new people, project names, JSON for backfill and client mapping). |

Weeks are always identified by **week start date** (Monday) in UTC. All hour tables use `(projectId, personId, weekStartDate)` (or equivalent for PTO) as the scope.

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

Defined in `lib/auth.ts`:

| Permission | Capabilities |
|------------|--------------|
| **User** | View and edit projects (assignments, hours, budget, rates, key roles). Cannot access Admin. |
| **Admin** | Everything User can do, plus: Admin area (Float Import, Roles, People, Users), delete projects. |

Session permission is read from the current user’s `permissions` field (User or Admin). “My projects” filter uses the user’s optional position role (PM, PGM, CAD) and matches projects where that person is a key role.

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
| Project | `/api/projects/[id]/planned-hours`, `actual-hours`, `float-hours` | Hour entries by project. |
| Project | `/api/projects/[id]/budget` | Budget rollups and status. |
| Project | `/api/projects/[id]/rates` | Role rates for the project. |
| Project | `/api/projects/[id]/revenue-recovery` | Revenue recovery to date. |
| Project | `/api/projects/[id]/float-default-roles`, `backfill-float`, `ready-for-float` | Float-related backfill and flags. |
| People | `GET /api/people`, `/api/people/eligible-key-roles` | List people, people eligible for key roles. |
| Roles | `GET /api/roles` | List roles. |
| Admin | `GET/POST /api/admin/float-import` | Float CSV import (Admin only). |
| Admin | `/api/admin/roles`, `/api/admin/people`, `/api/admin/users` | CRUD for roles, people, app users (Admin only). |

All project and admin routes require an authenticated session; admin routes additionally require Admin permission.

---

## Deployment

- **Build** — Vercel (or similar) runs `next build`; no database connection during build.
- **Migrations and seed** — Run separately after deploy: `npm run db:deploy` with production `DATABASE_URL`, or use the one-time seed API with `SEED_SECRET` and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

For full steps (Vercel env vars, rate limiting, one-time seed), see the main **README** in the repository.

---

*For end-user workflows and Float CSV format, see the User Guide.*
