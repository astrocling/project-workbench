# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Project Workbench is a Next.js 16 (App Router) + TypeScript web app backed by PostgreSQL (Prisma ORM) with NextAuth email/password auth. See `README.md` for full setup steps and `docs/TECHNICAL.md` for architecture details.

### Running services
- **PostgreSQL** must be running (`sudo service postgresql start`). Dev database: `project_workbench`, user: `devuser`, password: `devpass`.
- **Next.js dev server**: `npm run dev` (runs on port 3000). You must export or prefix `DATABASE_URL` if the `.env` file is not being picked up: `DATABASE_URL="postgresql://devuser:devpass@localhost:5432/project_workbench" npm run dev`.

### Key commands
| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Tests | `npm test` |
| Migrations | `npx prisma migrate dev` |
| Seed DB | `npx prisma db seed` |

### Gotchas
- The seed script defaults to `admin@example.com` / `changeme` when `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are not set (non-production only). These env vars in `.env` may not override the defaults if dotenv fails to load — pass them explicitly or verify with a login test.
- `prisma migrate dev` and `prisma db seed` require `DATABASE_URL` to be available. The `prisma.config.ts` imports `dotenv/config`, but if the `.env` file isn't found from the CWD, you may need to set `DATABASE_URL` as an inline env prefix.
- The "New Project" form requires at least one PM (Project Manager). PMs only appear in the dropdown if a `Person` record exists whose name/email matches a `User` with `role = ProjectManager`. For a fresh seed, no Person records exist — create them via Admin > People or run `npx tsx scripts/sample-data.ts`.
- Upstash Redis env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are optional; rate limiting is skipped in local dev without them.
- Lint currently has 14 pre-existing errors (mostly `prefer-const`) and 25 warnings (`no-unused-vars`). These are in the existing codebase.
