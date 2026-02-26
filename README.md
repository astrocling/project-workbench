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

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` – PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/project_workbench`)
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

**Rate limiting (optional but recommended in production):** Login, seed, and float-import are rate-limited when [Upstash Redis](https://upstash.com) is configured. Set **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** in Vercel (from your [Upstash Console](https://console.upstash.com/redis)). Limits: login 10 attempts per 15 min per IP; seed 5 per hour per IP; float-import 20 per 15 min per user. Without these env vars, rate limiting is skipped (e.g. local dev).

**Database migrations and seed on Vercel**

The Vercel **build** runs only `next build` (no database connection during build), which avoids connection timeouts (e.g. Prisma P1002) in the build environment. Run migrations and seed separately:

1. **Option A – From your machine (recommended):** After the first deploy (or when the schema changes), run once with your production `DATABASE_URL` in `.env`:
   ```bash
   npx prisma migrate deploy && npx prisma db seed
   ```
   Or use the script: `npm run db:deploy`.

2. **Option B – One-time seed via API:** If the database already has tables (e.g. from a previous deploy or manual migrate) but no admin user, use the [One-time seed via API](#one-time-seed-via-api-no-redeploy) below.

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

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** — How to use the app: projects, resourcing, budget, Float import, and admin (Roles, People, Users). Written in standard Markdown for easy copy into Confluence.
- **[Technical Reference](docs/TECHNICAL.md)** — Tech stack, data model, environment variables, week/as-of semantics, permissions, scripts, and API overview. Also Confluence-friendly.

## Float CSV Import

Admin → Float Import. Expected CSV format:

- Columns for person name, role, project
- Weekly columns with ISO-style date headers (e.g. `2025-02-17`)
- Project names must match existing projects
- Unknown roles are recorded and can be added via Admin → Roles
