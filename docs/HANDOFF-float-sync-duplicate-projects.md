# Handoff: Float sync / empty Float Actuals (Stanford OHS/SPCS)

**Status:** DB has float data on `-2` slug (2026-06-09 diagnostic); user may still see empty UI if Vercel uses a different DB, cache, or wrong slug.  
**Last updated:** 2026-06-09  
**App version (repo):** `1.2.3`

---

## 2026-06-09 diagnostic (`.env` → Neon prod pooler)

Ran `npx tsx scripts/debug-backfill-match.ts stanford-ohs-spcs-2025-2026-2` and `debug-float-person-overlap.ts`:

| Check | Result |
|-------|--------|
| Survivor slug `-2` id | `cmoht2x5v000004i0tctt1kab` |
| `floatExternalId` on survivor | **null** |
| Duplicate linked project | **Still exists** — `cmmjo6v2f…` slug `stanford-ohs-spcs-2025-2026`, `floatExternalId: 10381784` |
| `futureFloatHourCount` on `-2` | **45** (454 total) |
| `assignmentCount` on `-2` | 6 |
| Future float visible in UI filter | **45/45** (no person mismatch) |
| Sync targets (`floatProjectId=10381784`) | **Both** duplicate ids |
| Latest `FloatImportRun` | 2026-06-08T20:22:28Z — Stanford OHS/SPCS 2025/2026 has **6 people** |

**Conclusion:** On this database, sync **did write** and the resourcing API filter would **not** hide the data. Empty/sparse UI is **not** explained by “zero DB rows” or assignment mismatch on this Neon instance.

**Prod UI vs this DB (2026-06-09 screenshot on `pw.theclingans.com`, v1.2.3):** Float Actuals grid shows **6/08 = 43.75** (matches this DB) but **6/15 = 2.50** (this DB has **46.25**) and **6/22+ all zeros** (this DB has data through **2026-08-31**). Simulated resourcing payload from this DB returns **252** float rows including **12 future weeks**. **Prod app is therefore not reading the same DB state as local `.env`**, or scheduled Trigger sync (old deploy) is overwriting `-2` after Admin sync.

**Verify prod DB:** `DATABASE_URL="<from Vercel production>" npx tsx scripts/debug-resourcing-payload.ts stanford-ohs-spcs-2025-2026-2 --skip-backfill`

**Also deploy Trigger.dev** after app deploy (`npx trigger.dev@latest deploy`) — hourly `float-sync-*` tasks use the Trigger worker code, not Vercel; stale Trigger code skips duplicate mirroring.

Likely causes: (1) **Vercel `DATABASE_URL` ≠ local `.env`**, (2) **Trigger.dev not redeployed** to v1.2.3, (3) duplicate linked project still present on prod, (4) resourcing cache until Admin sync / per-project revalidate.

**Script fix:** `debug-backfill-match.ts` now loads `dotenv`, avoids `unstable_cache` in scripts, and prints sync targets for `floatProjectId=10381784` plus UI visibility stats.

---

## User-visible problem

- Project **Stanford OHS/SPCS 2025/2026** shows **no future (or no) hours** in the **Float Actuals** grid on Resourcing.
- **Admin → Float sync** and **Backfill** have been run multiple times; user reports **no change after production deploy**.
- **Planned** and **Actual** grids have data on the project the team actually uses.

---

## Current production state (user actions)

1. There were **two Workbench projects** with the same display name:
   - One with **`floatExternalId`** set (Float-linked) — had more complete Float hours in DB during local debug.
   - One **without** `floatExternalId` (slug likely `…-2`) — had **all Actual hours** and some Float data.
2. User **deleted the other project** (the linked one, per conversation) and kept the **`-2` slug** project (where actuals live).
3. After deploy of fix + sync: **still no Float hours** visible on the surviving project.

**Expectation after delete:** Next sync should `resolveDbProject` by name, set `floatExternalId` on the survivor, and write `FloatScheduledHours` + upsert `ProjectAssignment` there. **This did not visibly work in prod.**

---

## What local debug proved (session `942700`, pre-fix)

Logs showed Float sync **was working end-to-end** against the same DB shape:

| Check | Result |
|-------|--------|
| Float API tasks for Stanford | 194 tasks, 881 future hour rows aggregated |
| Float project id | `10381784` — name `Stanford OHS/SPCS 2025/2026` |
| Linked WB project | `cmmjo6v2f…` — `floatExternalId: "10381784"` |
| Duplicate WB project | `cmoht2x5v…` — `floatExternalId: null`, same name |
| Resolution | Hours queued to linked id; post-write **future rows existed** on linked id |

**Root cause class (confirmed):** duplicate same-name projects + resolution/cleanup targeting different ids. UI filters `floatHours` to **assignments on that project id** (`app/api/projects/[id]/resourcing/route.ts`).

**Not the issue locally:** aggregation, Float API empty, repeat-task expansion.

---

## Code changes shipped (v1.2.2 + v1.2.3)

### v1.2.2 (`lib/floatImportApply.ts`)

- `resolveFloatImportTargetProjectIds()` — mirror `FloatScheduledHours` + `ProjectAssignment` to **primary + same-name siblings with `floatExternalId: null`**.
- `projectIdsInImport` built from resolved target ids (not `projectsByName` map alone).

### v1.2.3

- `normalizeProjectNameForLookup()` — treat **`/`** like `-` / spaces (`lib/floatImportUtils.ts`).
- `resolveProjectIdForMergedFloatEntry()` — prefer **`floatExternalId`** match when duplicates share name; trust link when Workbench renamed; avoid wrong duplicate winning by array order.
- `scripts/debug-backfill-match.ts` — prints duplicates, sync target ids, float/assignment counts.
- Docs: `CHANGELOG.md`, `USER_GUIDE.md`, `TECHNICAL.md`.

**Tests:** `__tests__/lib/resolveProjectIdForMergedFloatEntry.test.ts` (9 tests).

---

## Why prod might still show nothing (hypotheses for fresh session)

1. **Deploy not actually running new code** — verify footer version `1.2.3`, Vercel deployment commit SHA.
2. **Wrong project slug** — user on `-2` but sync still resolving to deleted id (orphan cache unlikely; DB should be clean).
3. **Survivor not linked after delete** — `floatExternalId` still `null`; name mismatch prevents `resolveDbProject` (check exact Workbench name vs Float name in Admin/Float).
4. **Assignments missing on survivor for Float people** — grid filters `floatHours` by `assignmentPersonIds`; if Float people ≠ assigned people, grid shows empty even with DB rows.
5. **Orphan cleanup** — if sync resolves project but assignment upsert fails (`roleId` null), hours written then deleted by orphan SQL in `applyFloatImportDatabaseEffects` (lines ~496–505).
6. **Resourcing cache** — `unstable_cache` 60s on `GET …/resourcing`; Trigger-only sync does **not** `revalidateTag`. User must run **Admin → Float sync** or hard-refresh.
7. **Week range clamp** — `project.endDate` may clamp future weeks out of visible range (less likely if “no float at all”).
8. **Delete removed linked project** — if survivor never gets `floatExternalId`, resolution path is name-only; punctuation/year token mismatch still possible.

---

## First commands for fresh context

```bash
# Against production DATABASE_URL
npx tsx scripts/debug-backfill-match.ts stanford-ohs-spcs-2025-2026-2

# Check for remaining duplicates
# (script lists projects with same name insensitive)

# SQL-style checks via prisma script or studio:
# - Project: id, name, slug, floatExternalId, endDate
# - COUNT FloatScheduledHours WHERE projectId = ? AND weekStartDate > asOf
# - COUNT ProjectAssignment WHERE projectId = ?
# - Latest FloatImportRun completedAt + projectFloatHours JSON keys for Stanford
```

**Interpret `debug-backfill-match` output:**

- `Sync target project ids` should include the `-2` project id **after** v1.2.3 sync.
- `futureFloatHourCount` > 0 but UI empty → assignment filter or cache.
- `futureFloatHourCount` = 0 after sync → resolution or orphan cleanup; add instrumentation to `applyFloatImportDatabaseEffects` for that project id.

---

## Key files

| Area | Path |
|------|------|
| Sync orchestration | `lib/float/syncFloatImport.ts` (`executeFloatApiSync`, `resolveDbProject`) |
| DB apply | `lib/floatImportApply.ts` (`applyFloatImportDatabaseEffects`, resolvers) |
| Name normalize | `lib/floatImportUtils.ts` (`normalizeProjectNameForLookup`) |
| Resourcing API | `app/api/projects/[id]/resourcing/route.ts` (floatHours ∩ assignments) |
| Admin sync | `app/api/admin/float-sync/route.ts` (revalidates `project-resourcing`) |
| Diagnostic | `scripts/debug-backfill-match.ts` |
| Tests | `__tests__/lib/resolveProjectIdForMergedFloatEntry.test.ts` |

---

## Float / Workbench identifiers (from debug, may differ after delete)

| Entity | Value |
|--------|--------|
| Float `project_id` | `10381784` |
| Float name | `Stanford OHS/SPCS 2025/2026` |
| Former linked WB id | `cmmjo6v2f000004lbtwyns64h` (**deleted by user**) |
| Former duplicate WB id | `cmoht2x5v000004i0tctt1kab` |
| Survivor | slug `…-2` (confirm id in prod) |

---

## Suggested next steps (priority)

1. Run `debug-backfill-match.ts` on **survivor slug** with prod `DATABASE_URL` — paste output into new session.
2. Confirm **v1.2.3** live; run **Admin → Float sync**; confirm `floatExternalId` on survivor in DB.
3. If DB has `FloatScheduledHours` but UI empty → compare `personId` on float rows vs `ProjectAssignment` on survivor.
4. If DB has zero future float rows after sync → instrument `resolveProjectIdForMergedFloatEntry` + post-write counts for survivor id; check orphan delete.
5. Long-term: one canonical project per Float project; avoid duplicate names on create.

---

## Release tags

- Use **`v1.2.3`** (not `v1.1.2` — tag exists from older release).
- No migrations in this fix series.

---

## Related docs

- `CHANGELOG.md` — `[1.2.2]`, `[1.2.3]`
- `docs/USER_GUIDE.md` — Float sync, duplicate names, troubleshooting row
- `docs/TECHNICAL.md` — Float sync behavior section
