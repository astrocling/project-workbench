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
