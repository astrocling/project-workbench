/**
 * Integration test: `applyFloatImportDatabaseEffects` removes future FloatScheduledHours for people
 * no longer in the merged import snapshot, while leaving past weeks and assignments unchanged.
 *
 * Uses the real database (DATABASE_URL from .env) and the same apply path as admin Float API sync
 * (`executeFloatApiSync` → `applyFloatImportDatabaseEffects`). HTTP is not mocked here; see
 * `float-sync.test.ts` for mocked Float API responses.
 *
 * Run: npm run test -- __tests__/api/admin/float-import-cleanup.test.ts
 * Requires a reachable database (e.g. local Postgres or Neon with network access).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyFloatImportDatabaseEffects } from "@/lib/floatImportApply";
import { formatWeekKey } from "@/lib/weekUtils";

const TEST_SLUG = "float-import-cleanup-test";
const TEST_PROJECT_NAME = "Float Import Cleanup Test";
const TEST_ROLE_NAME = "Float Test Role";
const PERSON_ALICE = "Alice Cleanup Test";
const PERSON_BOB = "Bob Cleanup Test";

// As-of = end of previous week (Sunday 23:59). So 2025-02-10 is past, 2025-02-17 is future.
const AS_OF = new Date("2025-02-16T23:59:59.999Z");
const PAST_WEEK = new Date("2025-02-10T00:00:00.000Z"); // Monday
const FUTURE_WEEK = new Date("2025-02-17T00:00:00.000Z"); // Monday

describe("float import cleanup: remove future hours when person not in merged import", () => {
  let projectId: string | undefined;
  let personAliceId: string | undefined;
  let personBobId: string | undefined;
  let roleId: string | undefined;
  let importRunId: string | undefined;

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
        startDate: new Date("2025-02-01"),
        endDate: new Date("2025-03-31"),
      },
      update: { name: TEST_PROJECT_NAME },
    });
    projectId = project.id;

    let alice = await prisma.person.findFirst({
      where: { name: PERSON_ALICE },
    });
    if (!alice) alice = await prisma.person.create({ data: { name: PERSON_ALICE } });
    personAliceId = alice.id;

    let bob = await prisma.person.findFirst({
      where: { name: PERSON_BOB },
    });
    if (!bob) bob = await prisma.person.create({ data: { name: PERSON_BOB } });
    personBobId = bob.id;

    await prisma.projectAssignment.upsert({
      where: {
        projectId_personId: { projectId, personId: personAliceId },
      },
      create: { projectId, personId: personAliceId, roleId },
      update: {},
    });
    await prisma.projectAssignment.upsert({
      where: {
        projectId_personId: { projectId, personId: personBobId },
      },
      create: { projectId, personId: personBobId, roleId },
      update: {},
    });

    await prisma.floatScheduledHours.upsert({
      where: {
        projectId_personId_weekStartDate: {
          projectId,
          personId: personAliceId,
          weekStartDate: PAST_WEEK,
        },
      },
      create: { projectId, personId: personAliceId, weekStartDate: PAST_WEEK, hours: 5 },
      update: { hours: 5 },
    });
    await prisma.floatScheduledHours.upsert({
      where: {
        projectId_personId_weekStartDate: {
          projectId,
          personId: personAliceId,
          weekStartDate: FUTURE_WEEK,
        },
      },
      create: { projectId, personId: personAliceId, weekStartDate: FUTURE_WEEK, hours: 10 },
      update: { hours: 10 },
    });
    await prisma.floatScheduledHours.upsert({
      where: {
        projectId_personId_weekStartDate: {
          projectId,
          personId: personBobId,
          weekStartDate: FUTURE_WEEK,
        },
      },
      create: { projectId, personId: personBobId, weekStartDate: FUTURE_WEEK, hours: 3 },
      update: { hours: 3 },
    });
  });

  afterAll(async () => {
    if (!projectId || !personAliceId || !personBobId || !roleId) return;
    if (importRunId) {
      await prisma.floatImportRun.deleteMany({ where: { id: importRunId } });
    }
    await prisma.floatScheduledHours.deleteMany({
      where: { projectId },
    });
    await prisma.projectAssignment.deleteMany({
      where: { projectId },
    });
    await prisma.project.deleteMany({
      where: { id: projectId },
    });
    await prisma.person.deleteMany({
      where: { id: { in: [personAliceId, personBobId] } },
    });
    await prisma.role.deleteMany({
      where: { id: roleId },
    });
  });

  it("deletes future FloatScheduledHours for person not in import; keeps past weeks and person in import", async () => {
    if (!projectId || !personAliceId || !personBobId) {
      throw new Error("Test setup did not complete");
    }
    const [knownRoles, persons, projects] = await Promise.all([
      prisma.role.findMany(),
      prisma.person.findMany(),
      prisma.project.findMany(),
    ]);
    const roleById = new Map(knownRoles.map((r) => [r.name.toLowerCase(), r.id]));
    const personByName = new Map(persons.map((p) => [p.name.toLowerCase(), p.id]));
    const projectsByName = new Map(projects.map((p) => [p.name.toLowerCase(), p.id]));

    const weekKey = formatWeekKey(FUTURE_WEEK);
    const mergeKey = `${TEST_PROJECT_NAME}|${PERSON_BOB}`.toLowerCase();
    const mergedFloatByProjectPerson = new Map([
      [
        mergeKey,
        {
          projectName: TEST_PROJECT_NAME,
          personName: PERSON_BOB,
          roleName: TEST_ROLE_NAME,
          weekMap: new Map([[weekKey, 3]]),
        },
      ],
    ]);

    const { run } = await applyFloatImportDatabaseEffects(prisma, {
      asOf: AS_OF,
      uploadedByUserId: null,
      mergedFloatByProjectPerson,
      projectNames: [TEST_PROJECT_NAME],
      projectAssignments: {
        [TEST_PROJECT_NAME]: [{ personName: PERSON_BOB, roleName: TEST_ROLE_NAME }],
      },
      projectToClientMap: {},
      unknownRoles: [],
      newPersonNames: [],
      projectsByName,
      personByName,
      roleById,
    });
    importRunId = run.id;

    const aliceFloat = await prisma.floatScheduledHours.findMany({
      where: { projectId, personId: personAliceId },
      orderBy: { weekStartDate: "asc" },
    });
    const bobFloat = await prisma.floatScheduledHours.findMany({
      where: { projectId, personId: personBobId },
      orderBy: { weekStartDate: "asc" },
    });

    // Alice: past week kept, future week removed
    expect(aliceFloat).toHaveLength(1);
    expect(aliceFloat[0]!.weekStartDate.toISOString().slice(0, 10)).toBe("2025-02-10");
    expect(Number(aliceFloat[0]!.hours)).toBe(5);

    // Bob: future week still there (from import upsert)
    expect(bobFloat).toHaveLength(1);
    expect(bobFloat[0]!.weekStartDate.toISOString().slice(0, 10)).toBe("2025-02-17");
    expect(Number(bobFloat[0]!.hours)).toBe(3);

    // Assignments unchanged (both still assigned)
    const assignments = await prisma.projectAssignment.findMany({
      where: { projectId },
    });
    expect(assignments).toHaveLength(2);
  });
});
