# People edit and name search

Date: 2026-08-20

## Problem

Admin People (`/admin/people`) lists people and supports add plus Workbench active/inactive. Admins cannot correct name spellings or change job title (the starting-point role). There is also no way to find someone by typing their name. Job title / region / department / active filters already exist.

Some people are Workbench-only on purpose (not in Float). Job title is a starting point; project-level role override remains the source of truth on assignments.

## Goals

- Search the people list by name.
- Edit a person’s name and job title from the same page.
- Keep Float import as the source that can overwrite name and job title for linked people. Local edits are allowed; warn when that overwrite can happen.
- Leave Remove / Add back unchanged.

## Non-goals

- Editing email, region, department, tags, Float active, or Workbench active from the edit dialog.
- Persisting Workbench name/title against later Float import.
- Unique names.
- Server-side search or pagination.
- A person detail page.
- UI component tests (optional; API tests are required).

## Page behavior

File: `app/admin/people/page.tsx`.

### Name search

- Add a **Search by name** text field in the existing filter row (with Job title, Region ID, Department, Active).
- Filter the already-loaded list as the user types.
- Match is case-insensitive substring of `Person.name` (trim the query; empty query means no name filter).
- Combine with existing filters (AND).
- **Clear filters** also clears the search field.
- When no rows match, keep the existing empty copy: “No people match the current filters. Adjust filters or add someone.”

### Edit

- Add an **Edit** control in the Actions column, next to Remove / Add back.
- Opens a modal dialog modeled on Add person:
  - **Name**: text input, prefilled with current name.
  - **Job title**: select. Options are Role names plus distinct job titles already on people, plus this person’s current `floatJobTitle` if it is set and missing from that set. Prefill with current `floatJobTitle` when set; otherwise the empty “Select job title…” value. If job title is missing, Save stays disabled until the user picks one.
  - Save is disabled until both name and job title are non-empty after trim.
  - Cancel / overlay click / Escape close the dialog when not saving (same as Add person).
- If the person has a Float id (`externalId` is a non-empty string), show a short warning that the next Float import can overwrite name and job title. Workbench-only people (no `externalId`) get no warning.
- On success, replace that row in local state with the returned person. Do not reload the full list unless that is simpler and equivalent.
- On failure, keep the dialog open and show a short error. Do not update the table.

## API

File: `app/api/admin/people/route.ts`. Existing GET and POST unchanged. Admin session required (401 if unauthenticated, 403 if not Admin).

### `PATCH /api/admin/people`

Two mutually exclusive shapes. `personId` is always required.

**Active toggle** (existing Remove / Add back):

```json
{ "personId": "<id>", "active": true }
```

**Profile edit** (Edit dialog):

```json
{ "personId": "<id>", "name": "Jane Doe", "jobTitle": "Solutions Consultant" }
```

Rules:

- If `active` is present together with `name` or `jobTitle`, respond 400. Do not apply a partial update.
- Profile edit requires both `name` and `jobTitle`. After trim, both must be non-empty; otherwise 400.
- Profile edit writes `Person.name` and `Person.floatJobTitle` only.
- Active toggle writes `Person.active` only.
- Success: 200 and the full person record (same shape as today’s PATCH response).
- Unknown `personId`: 404 (Prisma record not found).
- Invalid JSON / schema: 400.

`Person.name` is not unique. Duplicate names remain allowed. No schema migration.

## Data flow

1. Page loads people via `GET /api/admin/people` and role names via `GET /api/admin/roles` (unchanged).
2. Search and dropdown filters run in memory on that list.
3. Edit save calls `PATCH` with `personId`, `name`, and `jobTitle`.
4. Remove / Add back continues to call `PATCH` with `personId` and `active`.

Float import (`syncPeopleFromFloatList`) continues to overwrite `name` and `floatJobTitle` for people matched by Float id. No change to import.

## Error handling

| Case | Behavior |
| --- | --- |
| No session | 401 |
| Session but not Admin | 403 |
| Mixed `active` with name/title | 400, dialog error, table unchanged |
| Empty name or job title after trim | 400, dialog error, Save stays disabled on the client as well |
| Unknown person | 404, dialog error, table unchanged |
| Network or other non-OK | Dialog error, table unchanged |

## Testing

Required: Vitest coverage for `PATCH /api/admin/people` in `__tests__/api/admin/people.test.ts` (or equivalent next to other admin API tests).

Cases:

- Profile edit updates `name` and `floatJobTitle` in the database and in the JSON body.
- Empty name or job title (including whitespace-only) returns 400 and does not change the row.
- Body with `active` plus `name` and/or `jobTitle` returns 400 and does not change the row.
- `active`-only body still updates `active` (Remove / Add back).
- No session → 401.
- Non-Admin session → 403.
- Unknown `personId` → 404.

Auth may be mocked. Prefer calling the route handler with a `NextRequest` if that matches how other HTTP tests are added; otherwise extract parse-and-update into a small function and test that plus a thin route wrapper.

UI tests are out of scope.

## Files likely to change

- `app/admin/people/page.tsx` — search field, Edit action, edit dialog, PATCH profile save.
- `app/api/admin/people/route.ts` — extend PATCH schema and update logic.
- `__tests__/api/admin/people.test.ts` — new.
