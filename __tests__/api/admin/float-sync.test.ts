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
/** Same Float region as {@link FLOAT_PERSON_ID}; row omits region_name to test merged people map. */
const FLOAT_PERSON_ID_2 = 99902;
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
    if (path.endsWith("/people")) {
      expect(url.searchParams.get("expand")).toBe("account");
      body = payload.people;
    }
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
          email: "api-sync-person@example.com",
          job_title: "Senior Developer",
          tags: ["react", "node"],
          active: 1,
          department: { department_id: 100, name: "Engineering" },
          account: { access_level: "Member", account_id: 5001 },
          role_id: FLOAT_ROLE_ID,
          region_id: 42,
          region_name: "Test Region",
        },
        {
          people_id: FLOAT_PERSON_ID_2,
          name: "API Sync Person Two",
          email: "person-two@example.com",
          job_title: "Designer",
          tags: [],
          active: 0,
          department: null,
          account: {},
          role_id: FLOAT_ROLE_ID,
          region_id: 42,
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
    await prisma.person.deleteMany({
      where: { externalId: { in: [String(FLOAT_PERSON_ID), String(FLOAT_PERSON_ID_2)] } },
    });
    if (roleId) {
      await prisma.role.deleteMany({ where: { id: roleId } });
    }
  });

  it("stores Float region id and display name from /v3/people", async () => {
    expect(personIdAfterSync).toBeDefined();
    const person = await prisma.person.findUniqueOrThrow({ where: { id: personIdAfterSync! } });
    expect(person.floatRegionId).toBe(42);
    expect(person.floatRegionName).toBe("Test Region");
  });

  it("fills floatRegionName for a person without region fields when another person shares the region_id", async () => {
    const p2 = await prisma.person.findFirst({
      where: { externalId: String(FLOAT_PERSON_ID_2) },
    });
    expect(p2).toBeDefined();
    expect(p2!.floatRegionId).toBe(42);
    expect(p2!.floatRegionName).toBe("Test Region");
  });

  it("stores Float job title, tags, department, scheduling active, email, and access label from /v3/people", async () => {
    expect(personIdAfterSync).toBeDefined();
    const p1 = await prisma.person.findUniqueOrThrow({ where: { id: personIdAfterSync! } });
    expect(p1.email).toBe("api-sync-person@example.com");
    expect(p1.floatJobTitle).toBe("Senior Developer");
    expect(p1.floatDepartmentName).toBe("Engineering");
    expect(p1.floatSchedulingActive).toBe(true);
    expect(p1.floatAccessLabel).toBe("Member");
    expect(p1.floatTags).toEqual(["react", "node"]);

    const p2 = await prisma.person.findFirstOrThrow({
      where: { externalId: String(FLOAT_PERSON_ID_2) },
    });
    expect(p2.email).toBe("person-two@example.com");
    expect(p2.floatJobTitle).toBe("Designer");
    expect(p2.floatDepartmentName).toBeNull();
    expect(p2.floatSchedulingActive).toBe(false);
    expect(p2.floatAccessLabel).toBe("No login");
    expect(p2.floatTags).toBeNull();
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

/** Mon–Fri week in SYNC window; Wednesday is a regional public holiday (nested `region` on holiday row). */
const NESTED_PH_WEEK_MON = "2030-06-03";
const NESTED_PH_WEEK_FRI = "2030-06-07";
const NESTED_PH_HOLIDAY_WED = "2030-06-05";

describe("Float API sync — regional holiday with nested region on public-holiday row", () => {
  const TEST_SLUG_NESTED = "float-sync-nested-ph-region";
  const TEST_PROJECT_NAME_NESTED = "Float Sync Nested PH Region Project";
  const FLOAT_PROJECT_ID_NESTED = 888002;
  const FLOAT_PERSON_ID_NESTED = 99903;

  let projectIdNested: string | undefined;
  let importRunIdNested: string | undefined;
  let personIdNested: string | undefined;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for this integration test. Load .env or set it.");
    }

    await prisma.role.upsert({
      where: { name: TEST_ROLE_NAME },
      create: { name: TEST_ROLE_NAME },
      update: {},
    });

    const project = await prisma.project.upsert({
      where: { slug: TEST_SLUG_NESTED },
      create: {
        slug: TEST_SLUG_NESTED,
        name: TEST_PROJECT_NAME_NESTED,
        clientName: "Test Client",
        startDate: new Date("2030-01-01"),
        endDate: new Date("2030-12-31"),
      },
      update: { name: TEST_PROJECT_NAME_NESTED },
    });
    projectIdNested = project.id;

    const fetchImpl = createMockFloatFetch({
      people: [
        {
          people_id: FLOAT_PERSON_ID_NESTED,
          name: "Nested PH Region Person",
          role_id: FLOAT_ROLE_ID,
          region_id: 42,
          region_name: "Test Region",
        },
      ],
      projects: [
        {
          project_id: FLOAT_PROJECT_ID_NESTED,
          name: TEST_PROJECT_NAME_NESTED,
          client_id: FLOAT_CLIENT_ID,
        },
      ],
      clients: [{ client_id: FLOAT_CLIENT_ID, name: "Acme Corp" }],
      roles: [{ role_id: FLOAT_ROLE_ID, name: TEST_ROLE_NAME }],
      tasks: [
        {
          project_id: FLOAT_PROJECT_ID_NESTED,
          people_id: FLOAT_PERSON_ID_NESTED,
          start_date: NESTED_PH_WEEK_MON,
          end_date: NESTED_PH_WEEK_FRI,
          hours: 1,
          role_id: FLOAT_ROLE_ID,
        },
      ],
      publicHolidays: [
        {
          name: "Nested Region Holiday",
          start_date: NESTED_PH_HOLIDAY_WED,
          end_date: NESTED_PH_HOLIDAY_WED,
          region: { id: 42, name: "Test Region" },
        },
      ],
    });

    const client = new FloatClient({
      token: "test-token-mock-nested-ph",
      baseUrl: "https://api.test",
      fetchImpl,
    });

    const { run } = await executeFloatApiSync(prisma, client, {
      startDate: SYNC_START,
      endDate: SYNC_END,
      uploadedByUserId: null,
    });
    importRunIdNested = run.id;

    const person = await prisma.person.findFirst({
      where: { externalId: String(FLOAT_PERSON_ID_NESTED) },
    });
    personIdNested = person?.id;
  });

  afterAll(async () => {
    if (importRunIdNested) {
      await prisma.floatImportRun.deleteMany({ where: { id: importRunIdNested } });
    }
    if (projectIdNested) {
      await prisma.floatScheduledHours.deleteMany({ where: { projectId: projectIdNested } });
      await prisma.projectAssignment.deleteMany({ where: { projectId: projectIdNested } });
      await prisma.project.deleteMany({ where: { id: projectIdNested } });
    }
    await prisma.person.deleteMany({
      where: { externalId: String(FLOAT_PERSON_ID_NESTED) },
    });
  });

  it("writes FloatScheduledHours excluding nested-region public holiday weekday (4h not 5h)", async () => {
    expect(projectIdNested).toBeDefined();
    expect(personIdNested).toBeDefined();

    const rows = await prisma.floatScheduledHours.findMany({
      where: { projectId: projectIdNested!, personId: personIdNested! },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.hours)).toBe(4);
    expect(rows[0]!.weekStartDate.toISOString().startsWith("2030-06-03")).toBe(true);
  });
});
