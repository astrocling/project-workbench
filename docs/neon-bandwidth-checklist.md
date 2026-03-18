## Neon bandwidth verification checklist (app-level)

This app now reduces database bandwidth by:
- **Windowing Resourcing data**: `GET /api/projects/[id]/resourcing` defaults to a bounded week range and supports `?fromWeek=YYYY-MM-DD&toWeek=YYYY-MM-DD`.
- **Server caching**: resourcing and projects list responses are cached briefly and invalidated via `revalidateTag(...)` on writes.
- **Tighter selects**: Budget / Revenue Recovery load fewer columns from Postgres.

### How to validate in Neon
In Neon’s dashboard, compare **before vs after** (or compare two deploys) while doing the flows below:

#### Projects
- Load **New Project** page (it calls `GET /api/projects`).
- Confirm fewer bytes transferred per request (projects list payload is now minimal + cached).

#### Resourcing (most important)
- Open a project with a long date range and many people.
- Go to **Resourcing** tab.
- Confirm the initial request returns a limited range and Neon bytes transferred drops materially vs “full project history”.
- Click **Load earlier weeks** / **Load later weeks** a couple times.
  - Confirm each click triggers a new range-bounded request (still much smaller than “all weeks forever”).

#### Writes invalidation
- Edit planned hours, actual hours, ready-for-float, or a cell comment.
- Refresh the resourcing tab.
- Confirm you still see the updated values (cache invalidation via `revalidateTag("project-resourcing:<id>")`).

### Handy endpoints to spot-check
- `GET /api/projects/[id]/resourcing` (supports `fromWeek` / `toWeek`)
- `GET /api/projects/[id]/planned-hours?fromWeek=...&toWeek=...`
- `GET /api/projects/[id]/actual-hours?fromWeek=...&toWeek=...`
- `GET /api/projects/[id]/float-hours?fromWeek=...&toWeek=...`

