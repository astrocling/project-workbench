# Code Review: Security & Performance Recommendations

This document summarizes major security and performance findings from a review of the Project Workbench codebase (Next.js 16, Prisma, NextAuth, PostgreSQL).

---

## Security Recommendations

### 1. **Seed endpoint: use timing-safe secret comparison**

**Location:** `app/api/seed/route.ts`

The Bearer token is compared with `token !== secret`. A simple string comparison can leak information via timing side channels. Use a constant-time comparison so an attacker cannot guess the secret character-by-character.

**Recommendation:** Use Node’s `crypto.timingSafeEqual` (with equal-length buffers) when comparing the Bearer token to `SEED_SECRET`.

```ts
import { timingSafeEqual } from "crypto";
// Ensure both are same length (e.g. encode to Buffer with same encoding)
// then: timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(secret, "utf8"))
```

If lengths differ, compare a hash (e.g. SHA-256) of both values with `timingSafeEqual` to keep length constant.

---

### 2. **Default seed credentials**

**Location:** `lib/seed.ts`

Production seed falls back to `admin@example.com` / `changeme` when `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are unset. That creates a well-known default admin in production if env is not set.

**Recommendation:**

- In production, require `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (or fail seed with a clear error).
- Document that default credentials must never be used in production and consider failing seed when `NODE_ENV === "production"` and defaults would be used.

---

### 3. **Login open redirect via `callbackUrl`**

**Location:** `app/login/page.tsx`

`callbackUrl` is taken from the query string and passed to `router.push(callbackUrl)`. If an attacker can set `?callbackUrl=https://evil.com`, the user may be sent to an external site after login (open redirect).

**Recommendation:** Validate `callbackUrl` before redirecting:

- Allow only relative paths (e.g. must start with `/` and not `//`).
- Reject absolute URLs or sanitize to same-origin paths. Example: if `callbackUrl` does not start with a single `/`, default to `/projects`.

---

### 4. **No rate limiting**

**Locations:** Login (`/api/auth/[...nextauth]`), API routes

There is no rate limiting on sign-in or on sensitive API routes. This allows:

- Brute-force attacks on passwords.
- DoS via repeated expensive operations (e.g. float import, at-risk, projects list).

**Recommendation:**

- Add rate limiting for login (e.g. per IP and/or per email) using something like `@upstash/ratelimit` or a middleware-based solution.
- Consider rate limiting for expensive or mutating endpoints (e.g. float import, seed if ever exposed).

---

### 5. **Float import: no file size limit**

**Location:** `app/api/admin/float-import/route.ts`

The uploaded file is read with `file.text()` with no size check. A very large CSV can cause high memory use and long processing, impacting stability and other users.

**Recommendation:** Enforce a maximum upload size (e.g. 5–10 MB) before calling `file.text()`. Reject with 413 or 400 and a clear message if exceeded.

---

### 6. **Security headers**

**Location:** `next.config.ts`

No custom security headers are set. Relying only on framework defaults may leave room for clickjacking, MIME sniffing, or XSS depending on content.

**Recommendation:** Add headers in `next.config.ts` (or via middleware) such as:

- `X-Frame-Options: DENY` (or SAMEORIGIN if you need embedding).
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Optionally `Content-Security-Policy` once you know your script/style origins.

---

### 7. **Session / JWT lifetime**

**Location:** `lib/auth.config.ts`

Session `maxAge` is 30 days. Long-lived JWTs increase the impact of token theft and slow the effect of permission changes (e.g. revoking admin).

**Recommendation:** Shorten for sensitive use (e.g. 1–7 days) and rely on refresh or re-login. If you keep 30 days, ensure admin/permission changes are reflected when you next issue tokens (e.g. re-login or refresh flow).

---

### 8. **Admin self-demotion**

**Location:** `app/api/admin/users/[id]/route.ts`

An admin can PATCH any user, including themselves, and can set their own `permissions` to `User`. That could leave the system with no admins or lock out the last admin.

**Recommendation:** When the target user ID is the current user, either forbid changing `permissions` or require a second admin to confirm. Optionally enforce “at least one Admin” in application logic.

---

### 9. **Ensure `NEXTAUTH_SECRET` in production**

**Location:** `lib/auth.config.ts`, README

NextAuth requires a strong secret in production. README already documents this; the app does not enforce it at runtime.

**Recommendation:** In production, assert `NEXTAUTH_SECRET` is set and long enough (e.g. ≥ 32 bytes). Fail fast at startup or when handling auth if it’s missing.

---

## Performance Recommendations

### 1. **Float import: N+1 and per-row DB work**

**Location:** `app/api/admin/float-import/route.ts`

The handler does many sequential DB calls inside loops:

- For each CSV row: `prisma.person.findFirst`, then optionally `prisma.person.create`, then `prisma.role.findFirst`, then `prisma.projectAssignment.upsert`.
- Later, for each merged entry: `prisma.person.findFirst` again, then for each week `prisma.floatScheduledHours.upsert`.

For large CSVs this becomes thousands of round-trips and can be slow and DB-heavy.

**Recommendation:**

- **Batch reads:** Load once: all persons by name (or a reasonable subset), all roles by name, all projects by name. Build in-memory maps (e.g. `Map<lowercaseName, id>`) and use them inside the loop instead of `findFirst` per row.
- **Batch writes:** Collect assignments and float hours in arrays, then use `createMany` / bulk upserts or a transaction with multiple `upsert` in one go. For `FloatScheduledHours`, consider a single transaction with batched upserts (e.g. in chunks of 100–500) instead of one upsert per week per person.

---

### 2. **Project creation backfill loop**

**Location:** `app/api/projects/route.ts` (POST)

When backfilling from float import data, the code does per-assignment and per–float-entry work: `prisma.person.findFirst` / `create`, then `prisma.projectAssignment.upsert` and `prisma.floatScheduledHours.upsert` in nested loops. Same N+1 pattern as float import.

**Recommendation:** Preload persons and roles into maps by name; batch assignment and float hour upserts (e.g. collect in arrays, then run in a single transaction or in chunks) instead of one DB call per row/week.

---

### 3. **GET /api/projects: unbounded list**

**Location:** `app/api/projects/route.ts`

GET loads all projects with `include` (projectKeyRoles, etc.) and no limit. As the number of projects grows, response size and query cost increase.

**Recommendation:** For large deployments, add optional pagination (e.g. `?page=1&limit=50`) or at least a cap (e.g. `take: 500`). Keep the current behavior as default for small datasets, and document when to enable pagination.

---

### 4. **At-risk and heavy project queries**

**Location:** `app/api/projects/at-risk/route.ts`

The at-risk endpoint loads all active projects with rich includes (assignments, planned/actual hours, budget lines, rates, key roles). For many projects this can be a heavy query and a large payload.

**Recommendation:**

- Ensure DB indexes match the query (e.g. `status`, date ranges, foreign keys used in filters).
- Consider caching the at-risk response for a short TTL (e.g. 1–5 minutes) if data does not need to be real-time.
- If the list grows large, support filtering or pagination (e.g. by date range or limit).

---

### 5. **Prisma query logging in development**

**Location:** `lib/prisma.ts`

In development, Prisma logs every query (`["query", "error", "warn"]`). That’s useful for debugging but can be noisy and slow with many operations (e.g. float import).

**Recommendation:** Keep current behavior by default; consider an env flag (e.g. `LOG_QUERIES=1`) to enable query logging only when needed, or reduce to `["error", "warn"]` in dev by default.

---

## Summary

| Priority | Category   | Item                                      |
|----------|------------|-------------------------------------------|
| High     | Security   | Timing-safe seed secret comparison        |
| High     | Security   | Validate login `callbackUrl` (open redirect) |
| High     | Security   | Rate limiting (login + critical APIs)     |
| High     | Performance| Batch DB operations in float import        |
| Medium   | Security   | No default seed credentials in production  |
| Medium   | Security   | File size limit on float CSV upload        |
| Medium   | Security   | Security headers (X-Frame-Options, etc.)  |
| Medium   | Performance| Batch project creation backfill            |
| Medium   | Performance| Pagination or cap on GET /api/projects    |
| Lower    | Security   | Shorter session maxAge; enforce NEXTAUTH_SECRET |
| Lower    | Security   | Prevent last-admin demotion                |
| Lower    | Performance| Indexing and optional caching for at-risk  |

Implementing the high-priority items will materially improve security and scalability; the rest can be scheduled as the product and deployment grow.
