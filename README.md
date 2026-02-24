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

**Optional (recommended):** set these so the first admin user is created with your chosen credentials when the DB is seeded:

- **`SEED_ADMIN_EMAIL`** – Email for the initial admin (default: `admin@example.com`).
- **`SEED_ADMIN_PASSWORD`** – Password for the initial admin (default: `changeme`).

Redeploy after adding or changing environment variables.

**Database migrations and seed on Vercel**

The build script runs **migrations** and **seed** on every deploy, so you don’t need to use the Neon dashboard or run anything locally:

1. On each deploy, Vercel runs `prisma migrate deploy` (creates/updates tables) and `prisma db seed` (creates roles + admin user) using your project’s `DATABASE_URL` (e.g. from the Neon integration).
2. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in Vercel if you want a specific admin; otherwise the seed uses `admin@example.com` / `changeme`. Then log in with those credentials.

**One-time seed via API (no redeploy)**

If the DB was already deployed but never seeded (e.g. you see "Invalid email or password"), you can seed it once without redeploying:

1. In Vercel, add **`SEED_SECRET`** (e.g. generate with `openssl rand -base64 32`) and optionally **`SEED_ADMIN_EMAIL`** / **`SEED_ADMIN_PASSWORD`**.
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

## Float CSV Import

Admin → Float Import. Expected CSV format:

- Columns for person name, role, project
- Weekly columns with ISO-style date headers (e.g. `2025-02-17`)
- Project names must match existing projects
- Unknown roles are recorded and can be added via Admin → Roles
