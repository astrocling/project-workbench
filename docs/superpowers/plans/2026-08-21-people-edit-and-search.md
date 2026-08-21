# People Edit and Name Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins search the People list by name and edit a person’s name and job title, without changing Float overwrite behavior or Remove / Add back.

**Architecture:** Parse and apply `PATCH /api/admin/people` in a small lib (`lib/adminPeoplePatch.ts`) so Vitest can cover validation and database writes without a UI. The existing admin route stays a thin auth wrapper. The People page adds a client-side name search (tiny helper + filter) and an Edit dialog modeled on Add person.

**Tech Stack:** Next.js App Router, Prisma, Zod 4, Vitest, existing admin People page patterns.

## Global Constraints

- Admin session required: 401 if unauthenticated, 403 if not Admin.
- No Prisma schema migration. `Person.name` is not unique; duplicate names stay allowed.
- PATCH bodies are mutually exclusive: `{ personId, active }` **or** `{ personId, name, jobTitle }`, never mixed.
- Profile edit writes only `Person.name` and `Person.floatJobTitle`.
- Float import continues to overwrite name and job title for linked people. Do not change `syncPeopleFromFloatList`.
- Warn in the Edit dialog only when `externalId` is a non-empty string.
- UI component tests are out of scope. API/lib tests are required.
- Follow TDD: failing test first, then minimal implementation, then commit.

## File map

| File | Responsibility |
| --- | --- |
| `lib/adminPeoplePatch.ts` | Parse PATCH body; apply active or profile update; map missing person to 404. |
| `lib/personNameSearch.ts` | Case-insensitive substring match for the name search box. |
| `app/api/admin/people/route.ts` | Auth; GET/POST unchanged; PATCH calls parse then apply. |
| `app/admin/people/page.tsx` | Search field, Edit action, edit dialog, profile PATCH. |
| `__tests__/lib/adminPeoplePatch.test.ts` | Unit tests for parse. |
| `__tests__/lib/personNameSearch.test.ts` | Unit tests for name search matching. |
| `__tests__/api/admin/people.test.ts` | DB + route tests for apply and PATCH. |

Spec: `docs/superpowers/specs/2026-08-20-people-edit-and-search-design.md`

---

### Task 1: Parse admin people PATCH bodies

**Files:**
- Create: `lib/adminPeoplePatch.ts`
- Test: `__tests__/lib/adminPeoplePatch.test.ts`

**Interfaces:**
- Consumes: Zod
- Produces: `parseAdminPeoplePatch(body: unknown): ParseAdminPeoplePatchResult` and `AdminPeoplePatchData`

```ts
export type AdminPeoplePatchData =
  | { kind: "active"; personId: string; active: boolean }
  | { kind: "profile"; personId: string; name: string; jobTitle: string };

export type ParseAdminPeoplePatchResult =
  | { ok: true; data: AdminPeoplePatchData }
  | { ok: false; error: string };

export function parseAdminPeoplePatch(body: unknown): ParseAdminPeoplePatchResult;
```

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/adminPeoplePatch.test.ts`:

```ts
/**
 * Run: npm run test -- __tests__/lib/adminPeoplePatch.test.ts
 */

import { describe, it, expect } from "vitest";
import { parseAdminPeoplePatch } from "@/lib/adminPeoplePatch";

describe("parseAdminPeoplePatch", () => {
  it("parses active-only bodies", () => {
    const result = parseAdminPeoplePatch({ personId: "p1", active: false });
    expect(result).toEqual({
      ok: true,
      data: { kind: "active", personId: "p1", active: false },
    });
  });

  it("parses profile bodies and trims name and jobTitle", () => {
    const result = parseAdminPeoplePatch({
      personId: "p1",
      name: "  Jane Doe  ",
      jobTitle: "  Solutions Consultant  ",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        kind: "profile",
        personId: "p1",
        name: "Jane Doe",
        jobTitle: "Solutions Consultant",
      },
    });
  });

  it("rejects mixing active with name or jobTitle", () => {
    const mixed = parseAdminPeoplePatch({
      personId: "p1",
      active: true,
      name: "Jane Doe",
      jobTitle: "Solutions Consultant",
    });
    expect(mixed.ok).toBe(false);

    const activeAndName = parseAdminPeoplePatch({
      personId: "p1",
      active: true,
      name: "Jane Doe",
    });
    expect(activeAndName.ok).toBe(false);
  });

  it("rejects empty or whitespace-only name or jobTitle", () => {
    expect(
      parseAdminPeoplePatch({ personId: "p1", name: "", jobTitle: "Role" }).ok
    ).toBe(false);
    expect(
      parseAdminPeoplePatch({ personId: "p1", name: "Jane", jobTitle: "   " }).ok
    ).toBe(false);
    expect(
      parseAdminPeoplePatch({ personId: "p1", name: "   ", jobTitle: "Role" }).ok
    ).toBe(false);
  });

  it("rejects missing personId and incomplete profile", () => {
    expect(parseAdminPeoplePatch({ active: true }).ok).toBe(false);
    expect(parseAdminPeoplePatch({ personId: "p1" }).ok).toBe(false);
    expect(parseAdminPeoplePatch({ personId: "p1", name: "Jane" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- __tests__/lib/adminPeoplePatch.test.ts`

Expected: FAIL — `Cannot find module '@/lib/adminPeoplePatch'` (or `parseAdminPeoplePatch` is not exported).

- [ ] **Step 3: Write minimal parse implementation**

Create `lib/adminPeoplePatch.ts`:

```ts
import { z } from "zod";

export type AdminPeoplePatchData =
  | { kind: "active"; personId: string; active: boolean }
  | { kind: "profile"; personId: string; name: string; jobTitle: string };

export type ParseAdminPeoplePatchResult =
  | { ok: true; data: AdminPeoplePatchData }
  | { ok: false; error: string };

const activePatchSchema = z
  .object({
    personId: z.string().min(1),
    active: z.boolean(),
  })
  .strict();

const profilePatchSchema = z
  .object({
    personId: z.string().min(1),
    name: z.string().trim().min(1),
    jobTitle: z.string().trim().min(1),
  })
  .strict();

const adminPeoplePatchSchema = z.union([activePatchSchema, profilePatchSchema]);

export function parseAdminPeoplePatch(body: unknown): ParseAdminPeoplePatchResult {
  const parsed = adminPeoplePatchSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  if ("active" in parsed.data) {
    return {
      ok: true,
      data: {
        kind: "active",
        personId: parsed.data.personId,
        active: parsed.data.active,
      },
    };
  }
  return {
    ok: true,
    data: {
      kind: "profile",
      personId: parsed.data.personId,
      name: parsed.data.name,
      jobTitle: parsed.data.jobTitle,
    },
  };
}
```

If Zod 4 rejects `.strict()` or `.trim()` on this version, keep the same result type and implement the same rules with a manual `Record` check (still reject mixed keys, trim, and empty strings). Do not loosen the tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- __tests__/lib/adminPeoplePatch.test.ts`

Expected: PASS (all parse cases).

- [ ] **Step 5: Commit**

```bash
git add lib/adminPeoplePatch.ts __tests__/lib/adminPeoplePatch.test.ts
git commit -m "$(cat <<'EOF'
Add admin people PATCH body parsing.

Validates mutually exclusive active vs name/job-title updates before any database write.
EOF
)"
```

---

### Task 2: Apply parsed PATCH to the database

**Files:**
- Modify: `lib/adminPeoplePatch.ts`
- Test: `__tests__/api/admin/people.test.ts`

**Interfaces:**
- Consumes: `AdminPeoplePatchData` from Task 1; `PrismaClient` from `@prisma/client`
- Produces:

```ts
export type ApplyAdminPeoplePatchResult =
  | { ok: true; person: Person }
  | { ok: false; status: 404; error: string };

export async function applyAdminPeoplePatch(
  db: PrismaClient,
  data: AdminPeoplePatchData
): Promise<ApplyAdminPeoplePatchResult>;
```

`Person` is the Prisma model type from `@prisma/client`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/admin/people.test.ts`:

```ts
/**
 * Integration tests for applyAdminPeoplePatch.
 * Run: npm run test -- __tests__/api/admin/people.test.ts
 * Requires DATABASE_URL (loaded via vitest.setup.ts / dotenv).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyAdminPeoplePatch,
  parseAdminPeoplePatch,
} from "@/lib/adminPeoplePatch";

const PREFIX = "admin-people-patch-test-";

async function createTestPerson(nameSuffix: string, extra?: { floatJobTitle?: string; active?: boolean }) {
  return prisma.person.create({
    data: {
      name: `${PREFIX}${nameSuffix}`,
      floatJobTitle: extra?.floatJobTitle ?? "Old Title",
      active: extra?.active ?? true,
    },
  });
}

describe("applyAdminPeoplePatch", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for this integration test.");
    }
  });

  afterAll(async () => {
    await prisma.person.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  it("updates name and floatJobTitle for a profile patch", async () => {
    const person = await createTestPerson("profile-original");
    const parsed = parseAdminPeoplePatch({
      personId: person.id,
      name: `${PREFIX}profile-renamed`,
      jobTitle: "Solutions Consultant",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await applyAdminPeoplePatch(prisma, parsed.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.person.name).toBe(`${PREFIX}profile-renamed`);
    expect(result.person.floatJobTitle).toBe("Solutions Consultant");

    const row = await prisma.person.findUniqueOrThrow({ where: { id: person.id } });
    expect(row.name).toBe(`${PREFIX}profile-renamed`);
    expect(row.floatJobTitle).toBe("Solutions Consultant");
    expect(row.active).toBe(true);
  });

  it("updates active only for an active patch", async () => {
    const person = await createTestPerson("active-original", {
      floatJobTitle: "Keep Title",
      active: true,
    });
    const parsed = parseAdminPeoplePatch({ personId: person.id, active: false });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await applyAdminPeoplePatch(prisma, parsed.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.person.active).toBe(false);

    const row = await prisma.person.findUniqueOrThrow({ where: { id: person.id } });
    expect(row.active).toBe(false);
    expect(row.name).toBe(`${PREFIX}active-original`);
    expect(row.floatJobTitle).toBe("Keep Title");
  });

  it("returns 404 for an unknown personId", async () => {
    const parsed = parseAdminPeoplePatch({
      personId: "clxxxxxxxxxxxxxxxxxxxxxxx",
      name: `${PREFIX}missing`,
      jobTitle: "Role",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await applyAdminPeoplePatch(prisma, parsed.data);
    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "Person not found",
    });
  });

  it("does not write when parse rejects a mixed body", async () => {
    const person = await createTestPerson("mixed-original");
    const before = await prisma.person.findUniqueOrThrow({ where: { id: person.id } });
    const parsed = parseAdminPeoplePatch({
      personId: person.id,
      active: true,
      name: `${PREFIX}should-not-write`,
      jobTitle: "Hacked",
    });
    expect(parsed.ok).toBe(false);
    const after = await prisma.person.findUniqueOrThrow({ where: { id: person.id } });
    expect(after).toEqual(before);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- __tests__/api/admin/people.test.ts`

Expected: FAIL — `applyAdminPeoplePatch` is not exported.

- [ ] **Step 3: Write minimal apply implementation**

Add to `lib/adminPeoplePatch.ts` (keep existing parse exports):

```ts
import { Prisma, type Person, type PrismaClient } from "@prisma/client";

export type ApplyAdminPeoplePatchResult =
  | { ok: true; person: Person }
  | { ok: false; status: 404; error: string };

export async function applyAdminPeoplePatch(
  db: PrismaClient,
  data: AdminPeoplePatchData
): Promise<ApplyAdminPeoplePatchResult> {
  try {
    const person =
      data.kind === "active"
        ? await db.person.update({
            where: { id: data.personId },
            data: { active: data.active },
          })
        : await db.person.update({
            where: { id: data.personId },
            data: { name: data.name, floatJobTitle: data.jobTitle },
          });
    return { ok: true, person };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, status: 404, error: "Person not found" };
    }
    throw e;
  }
}
```

If `@prisma/client` in this repo does not export `PrismaClient` as a type (adapter client), type `db` as `typeof prisma` from `@/lib/prisma` instead, or use `{ person: { update: PrismaClient["person"]["update"] } }` — keep the function signature’s runtime behavior identical.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- __tests__/api/admin/people.test.ts __tests__/lib/adminPeoplePatch.test.ts`

Expected: PASS. If `afterAll` fails because the renamed row no longer starts with `PREFIX`, keep the test names prefixed (they already do). If Prisma 7 uses a different not-found error than `P2025`, map that error to the same `{ ok: false, status: 404, error: "Person not found" }` without changing the test assertion.

- [ ] **Step 5: Commit**

```bash
git add lib/adminPeoplePatch.ts __tests__/api/admin/people.test.ts
git commit -m "$(cat <<'EOF'
Apply admin people PATCH updates in the database.

Writes active or name/job title and returns 404 when the person does not exist.
EOF
)"
```

---

### Task 3: Wire PATCH route (auth + parse + apply)

**Files:**
- Modify: `app/api/admin/people/route.ts` (`PATCH` only; leave GET and POST as they are)
- Modify: `__tests__/api/admin/people.test.ts`

**Interfaces:**
- Consumes: `parseAdminPeoplePatch`, `applyAdminPeoplePatch`
- Produces: `PATCH /api/admin/people` JSON: person on 200; `{ error: string }` on 400/401/403/404

- [ ] **Step 1: Write the failing route tests**

Append to `__tests__/api/admin/people.test.ts`. Add `vi` imports and mock `next-auth` **at the top of the file** (Vitest hoists `vi.mock`):

```ts
import { beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { PATCH } from "@/app/api/admin/people/route";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

const getSession = vi.mocked(getServerSession);

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/people", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

Add a second `describe` (reuse `PREFIX` / create a dedicated person in this describe’s `beforeAll` so it does not depend on Task 2 mutation order):

```ts
describe("PATCH /api/admin/people", () => {
  let routePersonId: string;

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: {
        name: `${PREFIX}route-original`,
        floatJobTitle: "Route Title",
        active: true,
      },
    });
    routePersonId = person.id;
  });

  beforeEach(() => {
    getSession.mockReset();
  });

  it("returns 401 without a session", async () => {
    getSession.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ personId: routePersonId, active: false }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-Admin session", async () => {
    getSession.mockResolvedValue({
      user: { permissions: "User" },
    } as never);
    const res = await PATCH(patchRequest({ personId: routePersonId, active: false }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when active is mixed with name/jobTitle", async () => {
    getSession.mockResolvedValue({
      user: { permissions: "Admin" },
    } as never);
    const res = await PATCH(
      patchRequest({
        personId: routePersonId,
        active: true,
        name: `${PREFIX}mixed`,
        jobTitle: "Nope",
      })
    );
    expect(res.status).toBe(400);
    const row = await prisma.person.findUniqueOrThrow({ where: { id: routePersonId } });
    expect(row.name).toBe(`${PREFIX}route-original`);
  });

  it("returns 404 for an unknown personId", async () => {
    getSession.mockResolvedValue({
      user: { permissions: "Admin" },
    } as never);
    const res = await PATCH(
      patchRequest({
        personId: "clxxxxxxxxxxxxxxxxxxxxxxx",
        name: `${PREFIX}gone`,
        jobTitle: "Role",
      })
    );
    expect(res.status).toBe(404);
  });

  it("updates name and jobTitle for an Admin profile patch", async () => {
    getSession.mockResolvedValue({
      user: { permissions: "Admin" },
    } as never);
    const res = await PATCH(
      patchRequest({
        personId: routePersonId,
        name: `${PREFIX}route-renamed`,
        jobTitle: "Solutions Consultant",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe(`${PREFIX}route-renamed`);
    expect(body.floatJobTitle).toBe("Solutions Consultant");
  });

  it("still toggles active for an Admin active-only patch", async () => {
    getSession.mockResolvedValue({
      user: { permissions: "Admin" },
    } as never);
    const res = await PATCH(patchRequest({ personId: routePersonId, active: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(false);
  });
});
```

Keep the existing Task 2 `afterAll` `deleteMany({ name: { startsWith: PREFIX } })` so both describes clean up.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- __tests__/api/admin/people.test.ts`

Expected: FAIL on the new cases — current `PATCH` uses `patchSchema` that requires `active`, so profile and mixed bodies are 400 in the wrong way, unknown ids may 500, and/or 200 profile update does not happen.

- [ ] **Step 3: Replace PATCH in the route**

In `app/api/admin/people/route.ts`:

1. Add imports:

```ts
import { applyAdminPeoplePatch, parseAdminPeoplePatch } from "@/lib/adminPeoplePatch";
```

2. Remove `const patchSchema = z.object({ personId: z.string().min(1), active: z.boolean() });`

3. Replace `PATCH` with:

```ts
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseAdminPeoplePatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await applyAdminPeoplePatch(prisma, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.person);
}
```

Leave GET and POST (and `addSchema`) unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- __tests__/api/admin/people.test.ts __tests__/lib/adminPeoplePatch.test.ts`

Expected: PASS.

If `NextRequest` construction fails in Vitest’s node environment, build the request with `new Request(...)` and cast to `NextRequest`, or pass `{ json: async () => body }` only if the handler is refactored to accept a `{ json: () => Promise<unknown> }` — prefer keeping `PATCH(req: NextRequest)`.

If `getServerSession` mock does not intercept the route’s import, mock `@/lib/auth.config` as well or use `vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))` plus `vi.mock("next-auth/next", ...)` depending on the next-auth import path already used in the route (`next-auth` today).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/people/route.ts __tests__/api/admin/people.test.ts
git commit -m "$(cat <<'EOF'
Extend admin people PATCH for name and job title.

Keeps Remove/Add back on active-only bodies and rejects mixed updates.
EOF
)"
```

---

### Task 4: Name search helper and filter on the People page

**Files:**
- Create: `lib/personNameSearch.ts`
- Test: `__tests__/lib/personNameSearch.test.ts`
- Modify: `app/admin/people/page.tsx`

**Interfaces:**
- Consumes: none
- Produces: `personNameMatchesSearch(name: string, query: string): boolean`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/personNameSearch.test.ts`:

```ts
/**
 * Run: npm run test -- __tests__/lib/personNameSearch.test.ts
 */

import { describe, it, expect } from "vitest";
import { personNameMatchesSearch } from "@/lib/personNameSearch";

describe("personNameMatchesSearch", () => {
  it("matches all names when the query is empty or whitespace", () => {
    expect(personNameMatchesSearch("Jane Doe", "")).toBe(true);
    expect(personNameMatchesSearch("Jane Doe", "   ")).toBe(true);
  });

  it("matches a case-insensitive substring of the name", () => {
    expect(personNameMatchesSearch("Jane Doe", "jane")).toBe(true);
    expect(personNameMatchesSearch("Jane Doe", "DOE")).toBe(true);
    expect(personNameMatchesSearch("Jane Doe", "ane d")).toBe(true);
  });

  it("does not match when the substring is absent", () => {
    expect(personNameMatchesSearch("Jane Doe", "smith")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- __tests__/lib/personNameSearch.test.ts`

Expected: FAIL — cannot find `@/lib/personNameSearch`.

- [ ] **Step 3: Implement helper and wire the page**

Create `lib/personNameSearch.ts`:

```ts
export function personNameMatchesSearch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}
```

In `app/admin/people/page.tsx`:

1. Import:

```ts
import { personNameMatchesSearch } from "@/lib/personNameSearch";
```

2. Add state next to the other filters (`filterJobTitle`, etc.):

```ts
const [filterName, setFilterName] = useState("");
```

3. In `filteredPeople`, after the existing Workbench-active check (or with the other filters), AND in the name search:

```ts
if (!personNameMatchesSearch(p.name, filterName)) return false;
```

Add `filterName` to the `useMemo` dependency array.

4. In the filter row, after the **Add person** button and before the Job title label, add:

```tsx
<label className="flex items-center gap-2">
  <span className="text-surface-500 dark:text-surface-400 whitespace-nowrap">Search by name</span>
  <input
    type="search"
    value={filterName}
    onChange={(e) => setFilterName(e.target.value)}
    placeholder="Name"
    className="h-9 min-w-[12rem] px-2 rounded-md bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30"
  />
</label>
```

5. `clearFilters` must also `setFilterName("")`.

6. `filtersAreDefault` is true only when the existing defaults hold **and** `filterName === ""`.

Do not change the empty-state copy. It already says: “No people match the current filters. Adjust filters or add someone.”

- [ ] **Step 4: Run tests**

Run: `npm run test -- __tests__/lib/personNameSearch.test.ts`

Expected: PASS.

Manual check (optional in this task): `/admin/people` — type a partial name; list narrows; Clear filters restores the full default-filtered list.

- [ ] **Step 5: Commit**

```bash
git add lib/personNameSearch.ts __tests__/lib/personNameSearch.test.ts app/admin/people/page.tsx
git commit -m "$(cat <<'EOF'
Add name search to admin People.

Filters the loaded list by case-insensitive substring as the admin types.
EOF
)"
```

---

### Task 5: Edit dialog for name and job title

**Files:**
- Modify: `app/admin/people/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/people` with `{ personId, name, jobTitle }`; GET people already include `externalId`
- Produces: Edit action + dialog; row replaced on 200; error stays in the dialog on failure

No new automated UI tests (spec). Verify by running existing tests plus a manual checklist.

- [ ] **Step 1: Extend the client Person type and edit state**

Add `externalId` to the `Person` type:

```ts
type Person = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  externalId: string | null;
  floatRegionId: number | null;
  floatRegionName: string | null;
  floatJobTitle: string | null;
  floatDepartmentName: string | null;
  floatTags: unknown;
  floatSchedulingActive: boolean | null;
  floatAccessLabel: string | null;
};
```

Add state near the add-person state:

```ts
const [editingPerson, setEditingPerson] = useState<Person | null>(null);
const [editName, setEditName] = useState("");
const [editJobTitle, setEditJobTitle] = useState("");
const [editSaving, setEditSaving] = useState(false);
const [editError, setEditError] = useState("");
```

- [ ] **Step 2: Open / close / save helpers**

Mirror Add person:

```ts
const closeEditPersonDialog = useCallback(() => {
  setEditingPerson(null);
  setEditName("");
  setEditJobTitle("");
  setEditSaving(false);
  setEditError("");
}, []);

function openEditPerson(p: Person) {
  setEditingPerson(p);
  setEditName(p.name);
  setEditJobTitle(p.floatJobTitle?.trim() ?? "");
  setEditError("");
}

useEffect(() => {
  if (!editingPerson) return;
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && !editSaving) closeEditPersonDialog();
  }
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [editingPerson, editSaving, closeEditPersonDialog]);

const editJobTitleOptions = useMemo(() => {
  const set = new Set<string>(addJobTitleOptions);
  const current = editingPerson?.floatJobTitle?.trim();
  if (current) set.add(current);
  return [...set].sort((a, b) => a.localeCompare(b));
}, [addJobTitleOptions, editingPerson]);

async function submitEditPerson() {
  if (!editingPerson) return;
  const trimmed = editName.trim();
  const jobTitle = editJobTitle.trim();
  if (!trimmed || !jobTitle || editSaving) return;
  setEditSaving(true);
  setEditError("");
  try {
    const res = await fetch("/api/admin/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId: editingPerson.id,
        name: trimmed,
        jobTitle,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setEditError(data?.error ?? "Failed to update person");
      return;
    }
    const updated = (await res.json()) as Person;
    setPeople((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    closeEditPersonDialog();
  } catch {
    setEditError("Failed to update person");
  } finally {
    setEditSaving(false);
  }
}
```

`closeEditPersonDialog` currently clears `editSaving` immediately; `submitEditPerson`’s `finally` also sets `editSaving` false. That is fine. Do **not** call `closeEditPersonDialog` on failure.

Float warning condition: `Boolean(editingPerson.externalId?.trim())`.

Warning copy (use this exact sentence):

> This person is linked to Float. The next import can overwrite name and job title.

- [ ] **Step 3: Actions column Edit control**

In the Actions `<td>`, put **Edit** before Remove / Add back:

```tsx
<td className="px-4 py-3 whitespace-nowrap">
  <button
    type="button"
    onClick={() => openEditPerson(p)}
    className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium mr-3"
  >
    Edit
  </button>
  {p.active ? (
    <button
      type="button"
      onClick={() => setActive(p.id, false)}
      className="text-body-sm text-jred-700 dark:text-jred-400 hover:text-jred-800 font-medium"
    >
      Remove
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setActive(p.id, true)}
      className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
    >
      Add back
    </button>
  )}
</td>
```

- [ ] **Step 4: Edit dialog markup**

Place after the Add person dialog (same overlay/card classes). Structure:

```tsx
{editingPerson && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-person-dialog-title"
  >
    <div
      className="absolute inset-0 bg-black/50"
      aria-hidden
      onClick={() => !editSaving && closeEditPersonDialog()}
    />
    <div className="relative w-full max-w-md rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl p-5">
      <h3
        id="edit-person-dialog-title"
        className="text-title-md font-semibold text-surface-900 dark:text-white"
      >
        Edit person
      </h3>
      {editingPerson.externalId?.trim() ? (
        <p className="mt-2 text-body-sm text-amber-800 dark:text-amber-400">
          This person is linked to Float. The next import can overwrite name and job title.
        </p>
      ) : null}
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submitEditPerson();
        }}
      >
        <div>
          <label
            htmlFor="edit-person-name"
            className="block text-body-sm font-medium text-surface-700 dark:text-surface-200 mb-1"
          >
            Name
          </label>
          <input
            id="edit-person-name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoComplete="name"
            disabled={editSaving}
            className="w-full h-10 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400 disabled:opacity-50"
            autoFocus
          />
        </div>
        <div>
          <label
            htmlFor="edit-person-job-title"
            className="block text-body-sm font-medium text-surface-700 dark:text-surface-200 mb-1"
          >
            Job title
          </label>
          <select
            id="edit-person-job-title"
            value={editJobTitle}
            onChange={(e) => setEditJobTitle(e.target.value)}
            disabled={editSaving}
            className="w-full h-10 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400 disabled:opacity-50"
          >
            <option value="">Select job title…</option>
            {editJobTitleOptions.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        </div>
        {editError ? (
          <p className="text-body-sm text-jred-700 dark:text-jred-400">{editError}</p>
        ) : null}
        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeEditPersonDialog}
            disabled={editSaving}
            className="px-3 py-1.5 rounded-md text-body-sm font-medium text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-dark-raised hover:bg-surface-200 dark:hover:bg-dark-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!editName.trim() || !editJobTitle.trim() || editSaving}
            className="px-3 py-1.5 rounded-md text-body-sm font-medium text-white bg-jblue-600 hover:bg-jblue-700 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
          >
            {editSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

Do not add email, region, tags, or active to this dialog. Remove / Add back stay in the table.

- [ ] **Step 5: Run tests and manual check, then commit**

Run: `npm run test -- __tests__/lib/adminPeoplePatch.test.ts __tests__/lib/personNameSearch.test.ts __tests__/api/admin/people.test.ts`

Expected: PASS.

Manual checklist:

1. Open `/admin/people`, search a name, confirm other filters still AND with search.
2. Edit a Workbench-only person (no Float id): no amber warning; save name spelling and job title; row updates; dialog closes.
3. Edit a Float-linked person: warning is visible; save still works.
4. Force a failure (optional: stop API / invalid id via DevTools): dialog stays open with error; table unchanged.
5. Remove / Add back still works.

```bash
git add app/admin/people/page.tsx
git commit -m "$(cat <<'EOF'
Add edit dialog for people name and job title.

Admins can fix spellings and starting-point roles, with a Float overwrite warning when linked.
EOF
)"
```

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Search by name, case-insensitive substring, AND with filters | 4 |
| Clear filters clears search | 4 |
| Empty-state copy unchanged | 4 |
| Edit dialog: name + job title, Save disabled until both filled | 5 |
| Include current job title in options | 5 |
| Float warning iff `externalId` | 5 |
| Success replaces row; failure keeps dialog | 5 |
| PATCH mutually exclusive shapes | 1, 3 |
| Profile writes name + `floatJobTitle` | 2, 3 |
| Active-only still works | 2, 3 |
| 401 / 403 / 400 mixed / 404 | 3 |
| Whitespace-empty name/title 400 | 1 |
| No migration, no uniqueness | (none; not added) |
| Float import unchanged | (none; do not edit `syncFloatImport.ts`) |
| API tests | 1–3 |

## Notes for the implementer

- Do not edit `lib/float/syncFloatImport.ts`.
- Do not add a person detail page.
- Work on a feature branch / worktree at execution time (`superpowers:using-git-worktrees`).
- `npm run test:unit` does not run `__tests__/api/**`; always run the people API file explicitly when claiming Task 2/3 done.
