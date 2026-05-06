# Project Workbench

Internal web application to replace an Excel Project Management Workbook for tracking project budget and resourcing.

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- NextAuth.js (email/password)
- Tailwind CSS, TanStack Table, Zod, React Hook Form

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Create or edit **`.env`** in the project root and set:

   - `DATABASE_URL` – PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/project_workbench`)
   - `DIRECT_URL` – Optional; non-pooled URL for Prisma migrations on hosts like Neon (see `docs/TECHNICAL.md`)
   - `NEXTAUTH_URL` – App URL (e.g. `http://localhost:3000`)
   - `NEXTAUTH_SECRET` – Generate with `openssl rand -base64 32`
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` – For initial admin user

3. **Database**

   Ensure PostgreSQL is running, then:

   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with the seed admin credentials.

## Production (Vercel)

In Vercel, set these environment variables for your project (Project → Settings → Environment Variables):

- **`NEXTAUTH_SECRET`** – **Required.** NextAuth uses this to sign cookies and JWTs. Generate one with:
  ```bash
  openssl rand -base64 32
  ```
  Add the output as the value and enable it for **Production** (and Preview if you use preview deployments).
- **`NEXTAUTH_URL`** – Your production URL (e.g. `https://your-app.vercel.app`). Vercel can set this automatically; if not, set it manually.
- **`DATABASE_URL`** – Your production PostgreSQL connection string (set automatically if you use Neon via Vercel’s integration).

**Session:** Sessions expire after 7 days. Users must re-login after that. Permission changes (e.g. revoking admin) take effect on the user’s next login.

**Required for seed in production:** set these so the first admin user is created with your chosen credentials. Default credentials are not allowed in production.

- **`SEED_ADMIN_EMAIL`** – Email for the initial admin (required in production).
- **`SEED_ADMIN_PASSWORD`** – Password for the initial admin (required in production).

Redeploy after adding or changing environment variables.

**Rate limiting (optional but recommended in production):** Login, seed, and admin Float sync are rate-limited when [Upstash Redis](https://upstash.com) is configured. Set **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** in Vercel (from your [Upstash Console](https://console.upstash.com/redis)). Limits: login 10 attempts per 15 min per IP; seed 5 per hour per IP; Float sync 20 per 15 min per user. Without these env vars, rate limiting is skipped (e.g. local dev).

**Database migrations and seed on Vercel**

The Vercel **build** runs `prisma migrate deploy` then `next build`, so pending migrations are applied automatically on every deploy (Preview and Production). Ensure `DATABASE_URL` is set in Vercel for the environments that build (Production and Preview if you use preview deployments).

**Seed** does not run during build. To create the initial admin user:

1. **Option A – From your machine:** With the same `DATABASE_URL` in `.env`, run once:
   ```bash
   npx prisma db seed
   ```
   Or use the script: `npm run db:deploy` (runs migrate deploy + seed).

2. **Option B – One-time seed via API:** If the database already has tables but no admin user, use the [One-time seed via API](#one-time-seed-via-api-no-redeploy) below.

3. Set **`SEED_ADMIN_EMAIL`** and **`SEED_ADMIN_PASSWORD`** in Vercel for production; they are required when seeding (default credentials are not used in production).

**One-time seed via API (no redeploy)**

If the DB was already deployed but never seeded (e.g. you see "Invalid email or password"), you can seed it once without redeploying:

1. In Vercel, add **`SEED_SECRET`** (e.g. generate with `openssl rand -base64 32`) and **`SEED_ADMIN_EMAIL`** / **`SEED_ADMIN_PASSWORD`** (required in production).
2. Trigger the seed (use your real app URL and secret):
   ```bash
   curl -X POST "https://your-app.vercel.app/api/seed" -H "Authorization: Bearer YOUR_SEED_SECRET"
   ```
3. Log in with the seeded admin credentials. You can remove `SEED_SECRET` from Vercel after seeding if you like.

## Tests

```bash
npm test
```

## Sample Data

```bash
npx tsx scripts/sample-data.ts
```

Creates a sample project with people, assignments, planned/actual hours, and budget line.

## Production release (maintainers)

1. **Version** — Bump `version` in `package.json`, update [CHANGELOG.md](CHANGELOG.md) with a dated section, and run `npm install` (or `npm install --package-lock-only`) so `package-lock.json` matches.
2. **Verify** — `npm test` (requires `DATABASE_URL` for Float integration tests) and `npm run build` against a database that will receive migrations (Vercel’s build runs `prisma migrate deploy` automatically).
3. **Deploy** — Merge to your production branch; confirm [environment variables](docs/TECHNICAL.md#environment-variables) in Vercel (or your host), especially `DATABASE_URL`, `NEXTAUTH_SECRET`, and Float tokens if you use sync.
4. **Tag (optional)** — `git tag v1.0.7 && git push origin v1.0.7` after the release commit lands.

## Documentation

- **Release notes** — [CHANGELOG.md](CHANGELOG.md). The app version in `package.json` is shown in the footer (`lib/version.ts`).

### Versioning

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). **1.0.0** is the first major release: the app is intended for production use, and **documented** configuration (environment variables), HTTP APIs, and user-visible behavior should be considered stable. Breaking changes to those surfaces are expected to coincide with a new **major** version. Experimental or explicitly labeled features may evolve without a major bump; see [docs/TECHNICAL.md](docs/TECHNICAL.md).

- **[User Guide](docs/USER_GUIDE.md)** — How to use the app: projects, PM/PGM/CAD dashboards (including 1-wk vs 4-wk recovery columns and upcoming PTO/holidays), resourcing (split-week actuals with keyboard navigation and bulk expand/collapse, Float PTO/holiday hints, collapsible Weekly Actuals to compare Planned vs Float), project **PTO** tab and company **PTO & Holidays** page, budget, Float sync, and admin (Roles, People, Users). Written in standard Markdown for easy copy into Confluence.
- **[Technical Reference](docs/TECHNICAL.md)** — Tech stack, data model, environment variables, week/as-of semantics, split-week actual hours (`ActualHoursMonthSplit`), PTO/holiday persistence and UI, optional **Trigger.dev** scheduled Float sync, permissions, **Projects list page** (filters, pagination, query params, Prisma `select`), scripts (including `migrate:split-week-actuals`), and API overview (e.g. **`/api/projects/[id]`** accepts project **id or slug**; status report meeting-notes HTML uses **sanitize-html**). Also Confluence-friendly.

## Float sync (Admin)

Admins pull scheduled hours from the **Float API** at **Admin → Float sync** (`/admin/float-sync`). Set **`FLOAT_API_TOKEN`** (and optionally **`FLOAT_API_USER_AGENT_EMAIL`**) in the environment. The app matches Float projects to Workbench projects by Float project id (`floatExternalId`) or by name, syncs people from Float, and upserts incomplete-week **`FloatScheduledHours`** from the merged snapshot; **future** rows are cleared when someone is **removed** from a project in Float. API sync intentionally does **not** bulk-delete every future float hour before upsert (see [docs/TECHNICAL.md](docs/TECHNICAL.md) *Float sync behavior*). **Completed** past weeks are not overwritten. Sync also writes **time off** and **holiday** data used by PTO/holiday features (see User Guide and Technical Reference). **Time off** is applied to scheduled-hour rollups using Float’s **`people_ids`** / **`people_id`** fields so **Float** grid totals stay aligned with PTO after sync.

**New project:** If Float import history exists, creating a project whose name matches Float (or a selected Float project on the New project form) can **auto-populate assignments and `FloatScheduledHours`** from merged `FloatImportRun` data—see User Guide (*Creating a new project*).

**Project assignment roles** prefer each person’s Float **job title** (shown under **Admin → People**) mapped to Workbench roles, then Float **scheduling** roles from tasks; unmapped labels no longer force a single global fallback for everyone—see [docs/TECHNICAL.md](docs/TECHNICAL.md) (*Float sync behavior*). Saving a role in **Settings → Assignments** locks that row so Float sync does not overwrite it.

**Restore hours from import history (all projects)** on the same admin page runs a one-shot backfill of `FloatScheduledHours` for every project from stored sync snapshots (same merge as per-project **Backfill**). Use when you need to repopulate float hours broadly after a bad sync; requires prior successful Float syncs so import history exists.

## Optional: Trigger.dev (scheduled Float sync)

The repo can run **scheduled** Float API → database sync via [Trigger.dev](https://trigger.dev) (`trigger/floatSync.ts`, `trigger.config.ts`), using the same `executeFloatApiSync` path as the admin API. Configure the Trigger.dev project and set worker env vars (**`DATABASE_URL`**, **`FLOAT_API_TOKEN`**, optional **`FLOAT_API_USER_AGENT_EMAIL`**). Details: [docs/TECHNICAL.md](docs/TECHNICAL.md) (*Scheduled Float sync (Trigger.dev)*). This does not replace manual admin sync for Next.js cache revalidation of resourcing tags.
