/**
 * Integration test: Float API sync (`executeFloatApiSync`) with mocked HTTP.
 * Exercises list endpoints + tasks → same DB path as admin POST /api/admin/float-sync.
 *
 * Run: npm run test -- __tests__/api/admin/float-sync.test.ts
 * Requires DATABASE_URL (e.g. from .env).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { FloatClient } from "@/lib/float/client";
import { executeFloatApiSync } from "@/lib/float/syncFloatImport";
import { FLOAT_LIST_MAX_PER_PAGE, FLOAT_PER_PAGE_PARAM } from "@/lib/float/types";

const TEST_SLUG = "float-sync-api-test";
const TEST_PROJECT_NAME = "Float Sync API Test Project";
/** Unique name so afterAll does not remove a seeded global role. */
const TEST_ROLE_NAME = "Float Sync API Developer";
const FLOAT_PROJECT_ID = 888001;
const FLOAT_PERSON_ID = 99901;
const FLOAT_CLIENT_ID = 1;
const FLOAT_ROLE_ID = 42;

/** Future week (relative to real-world “today”) so Float hours are written (not past-only). */
const SYNC_START = "2030-01-01";
const SYNC_END = "2030-12-31";
/** Single-day task in that window → one week bucket. */
const TASK_DAY = "2030-06-05";

function paginationHeaders(itemCount: number): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Pagination-Total-Count": String(itemCount),
    "X-Pagination-Page-Count": "1",
    "X-Pagination-Current-Page": "1",
    "X-Pagination-Per-Page": String(FLOAT_LIST_MAX_PER_PAGE),
  };
}

function createMockFloatFetch(payload: {
  people: unknown[];
  projects: unknown[];
  clients: unknown[];
  roles: unknown[];
  tasks: unknown[];
  timeOffs?: unknown[];
  publicHolidays?: unknown[];
  teamHolidays?: unknown[];
}): typeof fetch {
  return async (input) => {
    const url = typeof input === "string" ? new URL(input) : new URL((input as Request).url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    let body: unknown[] = [];
    if (path.endsWith("/people")) body = payload.people;
    else if (path.endsWith("/projects")) body = payload.projects;
    else if (path.endsWith("/clients")) body = payload.clients;
    else if (path.endsWith("/roles")) body = payload.roles;
    else if (path.endsWith("/tasks")) body = payload.tasks;
    else if (path.endsWith("/timeoffs")) body = payload.timeOffs ?? [];
    else if (path.endsWith("/public-holidays")) body = payload.publicHolidays ?? [];
    else if (path === "/v3/holidays") body = payload.teamHolidays ?? [];
    else {
      return new Response(`unexpected path: ${path}`, { status: 404 });
    }
    expect(url.searchParams.get("page")).toBeTruthy();
    expect(url.searchParams.get(FLOAT_PER_PAGE_PARAM)).toBeTruthy();
    if (path.endsWith("/tasks") || path.endsWith("/timeoffs") || path.endsWith("/public-holidays")) {
      expect(url.searchParams.get("start_date")).toBe(SYNC_START);
      expect(url.searchParams.get("end_date")).toBe(SYNC_END);
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: new Headers(paginationHeaders(body.length)),
    });
  };
}

describe("Float API sync (mocked HTTP)", () => {
  let projectId: string | undefined;
  let roleId: string | undefined;
  let importRunId: string | undefined;
  let personIdAfterSync: string | undefined;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for this integration test. Load .env or set it.");
    }

    const role = await prisma.role.upsert({
      where: { name: TEST_ROLE_NAME },
      create: { name: TEST_ROLE_NAME },
      update: {},
    });
    roleId = role.id;

    const project = await prisma.project.upsert({
      where: { slug: TEST_SLUG },
      create: {
        slug: TEST_SLUG,
        name: TEST_PROJECT_NAME,
        clientName: "Test Client",
        startDate: new Date("2030-01-01"),
        endDate: new Date("2030-12-31"),
      },
      update: { name: TEST_PROJECT_NAME },
    });
    projectId = project.id;

    const fetchImpl = createMockFloatFetch({
      people: [
        {
          people_id: FLOAT_PERSON_ID,
          name: "API Sync Person",
          role_id: FLOAT_ROLE_ID,
        },
      ],
      projects: [
        {
          project_id: FLOAT_PROJECT_ID,
          name: TEST_PROJECT_NAME,
          client_id: FLOAT_CLIENT_ID,
        },
      ],
      clients: [{ client_id: FLOAT_CLIENT_ID, name: "Acme Corp" }],
      roles: [{ role_id: FLOAT_ROLE_ID, name: TEST_ROLE_NAME }],
      tasks: [
        {
          project_id: FLOAT_PROJECT_ID,
          people_id: FLOAT_PERSON_ID,
          start_date: TASK_DAY,
          end_date: TASK_DAY,
          hours: 8,
          role_id: FLOAT_ROLE_ID,
        },
      ],
    });

    const client = new FloatClient({
      token: "test-token-mock",
      baseUrl: "https://api.test",
      fetchImpl,
    });

    const { run } = await executeFloatApiSync(prisma, client, {
      startDate: SYNC_START,
      endDate: SYNC_END,
      uploadedByUserId: null,
    });
    importRunId = run.id;

    const person = await prisma.person.findFirst({
      where: { externalId: String(FLOAT_PERSON_ID) },
    });
    personIdAfterSync = person?.id;
  });

  afterAll(async () => {
    if (importRunId) {
      await prisma.floatImportRun.deleteMany({ where: { id: importRunId } });
    }
    if (projectId) {
      await prisma.floatScheduledHours.deleteMany({ where: { projectId } });
      await prisma.projectAssignment.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    if (personIdAfterSync) {
      await prisma.person.deleteMany({ where: { id: personIdAfterSync } });
    }
    if (roleId) {
      await prisma.role.deleteMany({ where: { id: roleId } });
    }
  });

  it("writes FloatScheduledHours and links project floatExternalId from mocked Float responses", async () => {
    expect(projectId).toBeDefined();
    expect(personIdAfterSync).toBeDefined();
    expect(importRunId).toBeDefined();

    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId! } });
    expect(project.floatExternalId).toBe(String(FLOAT_PROJECT_ID));

    const rows = await prisma.floatScheduledHours.findMany({
      where: { projectId: projectId!, personId: personIdAfterSync! },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.hours)).toBe(8);
    expect(rows[0]!.weekStartDate.toISOString().startsWith("2030-06-03")).toBe(true);

    const assignment = await prisma.projectAssignment.findUnique({
      where: {
        projectId_personId: { projectId: projectId!, personId: personIdAfterSync! },
      },
    });
    expect(assignment).toBeTruthy();
    expect(assignment!.roleId).toBe(roleId);
  });
});
