import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { parseFloatWeekHeader, formatWeekKey } from "@/lib/weekUtils";
import { floatImportRatelimit, getClientIp } from "@/lib/ratelimit";

/** Chunk size for bulk FloatScheduledHours upserts to avoid huge queries. */
const FLOAT_HOURS_BATCH_SIZE = 500;

/** Max CSV upload size (10 MB) to avoid high memory use and long processing. */
const MAX_FLOAT_CSV_BYTES = 10 * 1024 * 1024;

/** Store week start as Monday 00:00 UTC so DB date matches grid week keys regardless of server timezone. */
function toUTCMonday(weekStart: Date): Date {
  return new Date(
    Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate()
    )
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lastRun = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });
  return NextResponse.json(lastRun);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const permissions = (session.user as { permissions?: string }).permissions;
    if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rateLimitId = (session.user as { id?: string }).id ?? getClientIp(req.headers);
    const { success } = await floatImportRatelimit.limit(rateLimitId);
    if (!success) {
      return NextResponse.json(
        { error: "Too many import requests. Try again later." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.size > MAX_FLOAT_CSV_BYTES) {
    return NextResponse.json(
      {
        error: `File too large. Maximum size is ${MAX_FLOAT_CSV_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 }
    );
  }

  const text = await file.text();
  // Find header row: Float export has metadata lines 1-5
  const lines = text.split(/\r?\n/);
  let headerLineIndex = lines.findIndex((line) => {
    const lower = line.toLowerCase();
    return lower.includes("name") && (lower.includes("project") || lower.includes("client"));
  });
  if (headerLineIndex === -1) headerLineIndex = 0;
  const csvFromHeader = lines.slice(headerLineIndex).join("\n");
  const parsed = Papa.parse<Record<string, string>>(csvFromHeader, { header: true });

  if (parsed.errors.length) {
    return NextResponse.json(
      { error: "CSV parse error", details: parsed.errors },
      { status: 400 }
    );
  }

  const rows = parsed.data.filter((r) => Object.keys(r).some((k) => r[k]?.trim()));
  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows" }, { status: 400 });
  }

  const headers = Object.keys(rows[0] ?? {});
  const weekColumns: { key: string; weekStart: Date }[] = [];
  const unknownRoles: string[] = [];

  // Batch read: roles, persons, projects (one query each)
  const [knownRoles, persons, projects] = await Promise.all([
    prisma.role.findMany(),
    prisma.person.findMany(),
    prisma.project.findMany(),
  ]);
  const roleNames = new Set(knownRoles.map((r: { name: string }) => r.name));
  const roleById = new Map<string, string>(
    knownRoles.map((r: { id: string; name: string }) => [r.name.toLowerCase(), r.id])
  );
  const personByName = new Map<string, string>(
    persons.map((p: { id: string; name: string }) => [p.name.toLowerCase(), p.id])
  );
  const projectsByName = new Map<string, string>(
    projects.map((p: { id: string; name: string }) => [p.name.toLowerCase(), p.id])
  );

  for (const h of headers) {
    const weekStart = parseFloatWeekHeader(h);
    if (weekStart) weekColumns.push({ key: h, weekStart });
  }

  // Expect columns like: person name, role, project, client, ... weekly hours
  const nameCol = headers.find((h) =>
    /^(person|name|resource|employee)/i.test(h)
  ) ?? headers[0];
  const roleCol = headers.find((h) => /^role$/i.test(h)) ?? headers[1];
  // Prefer "Project" for project names so we don't use "Client" column for projects when both exist
  const projectCol = headers.find((h) => /^project$/i.test(h))
    ?? headers.find((h) => /project/i.test(h) && h.toLowerCase() !== "client")
    ?? headers[2];
  const projectColKey = projectCol?.toLowerCase();
  const clientCol =
    headers.find(
      (h) =>
        (/^client$/i.test(h) ||
          /client\s*name/i.test(h) ||
          /^account$/i.test(h) ||
          /^customer$/i.test(h)) &&
        h.toLowerCase() !== projectColKey
    ) ??
    headers.find(
      (h) =>
        (/client|account|customer/i.test(h) && !/project/i.test(h)) &&
        h.toLowerCase() !== projectColKey
    );

  const peopleRows = rows;

  const projectNamesSet = new Set<string>();
  const projectToClientMap = new Map<string, string>();
  const projectAssignmentsMap = new Map<
    string,
    Array<{ personName: string; roleName: string }>
  >();
  const projectFloatHoursMap = new Map<
    string,
    Array<{ personName: string; roleName: string; weeks: Array<{ weekStart: string; hours: number }> }>
  >();
  /** Merged float hours by (projectName, personName) with summed hours per week. */
  const mergedFloatByProjectPerson = new Map<
    string,
    { projectName: string; personName: string; roleName: string; weekMap: Map<string, number> }
  >();

  for (const row of peopleRows) {
    const name = (row[nameCol] ?? "").trim();
    const roleName = (row[roleCol] ?? "").trim();
    const projectName = (row[projectCol] ?? "").trim();
    const clientName = clientCol ? (row[clientCol] ?? "").trim() : "";
    if (!name || !projectName) continue;
    if (name.toUpperCase() === "SCHEDULED" || name.toUpperCase() === "CAPACITY")
      continue;

    projectNamesSet.add(projectName);
    if (clientName && !projectToClientMap.has(projectName)) {
      projectToClientMap.set(projectName, clientName);
    }
    if (!projectAssignmentsMap.has(projectName)) {
      projectAssignmentsMap.set(projectName, []);
    }
    const arr = projectAssignmentsMap.get(projectName)!;
    const existing = arr.find((a) => a.personName.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.roleName = roleName;
    } else {
      arr.push({ personName: name, roleName });
    }
  }

  const projectNames = Array.from(projectNamesSet).sort();
  const projectAssignments = JSON.parse(
    JSON.stringify(Object.fromEntries(projectAssignmentsMap))
  ) as Record<string, Array<{ personName: string; roleName: string }>>;
  // projectFloatHours is built after the loop below that fills projectFloatHoursMap
  const projectClients = JSON.parse(
    JSON.stringify(Object.fromEntries(projectToClientMap))
  ) as Record<string, string>;

  const peopleByKey = new Map<string, string>();
  const newPersonNames: string[] = [];
  /** Collected assignments for batch upsert: key = projectId:personId, value = roleId (last role wins). */
  const assignmentUpdates = new Map<string, { projectId: string; personId: string; roleId: string }>();

  for (const row of peopleRows) {
    const name = (row[nameCol] ?? "").trim();
    const roleName = (row[roleCol] ?? "").trim();
    const projectName = (row[projectCol] ?? "").trim();
    if (!name || !projectName) continue;
    if (name.toUpperCase() === "SCHEDULED" || name.toUpperCase() === "CAPACITY") continue;

    if (roleName && !roleNames.has(roleName)) {
      if (!unknownRoles.includes(roleName)) unknownRoles.push(roleName);
    }

    let personId = personByName.get(name.toLowerCase());
    if (!personId) {
      const person = await prisma.person.create({
        data: { name },
      });
      personId = person.id;
      personByName.set(name.toLowerCase(), personId);
      if (!newPersonNames.includes(name)) newPersonNames.push(name);
    }
    peopleByKey.set(`${name}-${projectName}`.toLowerCase(), personId);

    // Merge float hour data by (project, person): sum hours per week for backfill storage
    const mergeKey = `${projectName}|${name}`.toLowerCase();
    let entry = mergedFloatByProjectPerson.get(mergeKey);
    if (!entry) {
      entry = {
        projectName,
        personName: name,
        roleName,
        weekMap: new Map<string, number>(),
      };
      mergedFloatByProjectPerson.set(mergeKey, entry);
    } else {
      entry.roleName = roleName;
    }
    for (const { key, weekStart } of weekColumns) {
      const val = parseFloat((row[key] ?? "0").replace(/[^0-9.-]/g, "")) || 0;
      const weekStartUTC = toUTCMonday(weekStart);
      const weekKey = formatWeekKey(weekStartUTC);
      entry.weekMap.set(weekKey, (entry.weekMap.get(weekKey) ?? 0) + val);
    }

    const projectId = projectsByName.get(projectName.toLowerCase());
    if (!projectId) continue;

    const roleId = roleById.get(roleName.toLowerCase());
    if (!roleId) continue;

    assignmentUpdates.set(`${projectId}:${personId}`, { projectId, personId, roleId });
  }

  // Batch upsert assignments in one transaction
  if (assignmentUpdates.size > 0) {
    await prisma.$transaction(
      Array.from(assignmentUpdates.values()).map(({ projectId, personId, roleId }) =>
        prisma.projectAssignment.upsert({
          where: {
            projectId_personId: { projectId, personId },
          },
          create: { projectId, personId, roleId },
          update: { roleId },
        })
      )
    );
  }

  // Build projectFloatHoursMap from merged data (one entry per project+person, summed hours)
  for (const entry of mergedFloatByProjectPerson.values()) {
    const weeks = Array.from(entry.weekMap.entries())
      .map(([weekStart, hours]) => ({ weekStart, hours }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    if (weeks.length === 0) continue;
    if (!projectFloatHoursMap.has(entry.projectName)) {
      projectFloatHoursMap.set(entry.projectName, []);
    }
    projectFloatHoursMap.get(entry.projectName)!.push({
      personName: entry.personName,
      roleName: entry.roleName,
      weeks,
    });
  }

  // Collect FloatScheduledHours rows (reuse personByName from first loop)
  const floatHoursRows: { projectId: string; personId: string; weekStartDate: Date; hours: number }[] = [];
  for (const entry of mergedFloatByProjectPerson.values()) {
    const projectId = projectsByName.get(entry.projectName.toLowerCase());
    if (!projectId) continue;
    const personId = personByName.get(entry.personName.toLowerCase());
    if (!personId) continue;
    for (const [weekStart, hours] of entry.weekMap) {
      floatHoursRows.push({
        projectId,
        personId,
        weekStartDate: new Date(weekStart + "T00:00:00.000Z"),
        hours,
      });
    }
  }

  // Bulk upsert FloatScheduledHours in chunks (INSERT ... ON CONFLICT DO UPDATE)
  for (let i = 0; i < floatHoursRows.length; i += FLOAT_HOURS_BATCH_SIZE) {
    const chunk = floatHoursRows.slice(i, i + FLOAT_HOURS_BATCH_SIZE);
    if (chunk.length === 0) continue;
    await prisma.$executeRaw`
      INSERT INTO "FloatScheduledHours" ("projectId", "personId", "weekStartDate", "hours", "createdAt", "updatedAt")
      VALUES ${Prisma.join(
        chunk.map((r) =>
          Prisma.sql`(${Prisma.join([r.projectId, r.personId, r.weekStartDate, r.hours])}, now(), now())`
        )
      )}
      ON CONFLICT ("projectId", "personId", "weekStartDate")
      DO UPDATE SET hours = EXCLUDED.hours, "updatedAt" = now()
    `;
  }

  // Build projectFloatHours after the loop that populated projectFloatHoursMap (used for backfilling new projects)
  const projectFloatHours = JSON.parse(
    JSON.stringify(Object.fromEntries(projectFloatHoursMap))
  ) as Record<string, Array<{ personName: string; roleName: string; weeks: Array<{ weekStart: string; hours: number }> }>>;

  const completedAt = new Date();
  const uploadedByUserId = (session.user as { id?: string }).id ?? null;
  const unknownRolesJson = JSON.stringify(unknownRoles);
  const newPersonNamesJson = JSON.stringify(newPersonNames);
  const projectNamesJson = JSON.stringify(projectNames);
  const projectAssignmentsJson = JSON.stringify(projectAssignments);
  const projectFloatHoursJson = JSON.stringify(projectFloatHours);
  const projectClientsJson = JSON.stringify(projectClients);

  const [run] = await prisma.$queryRaw<Array<{ id: string; completedAt: Date }>>`
    INSERT INTO "FloatImportRun" (
      "id", "completedAt", "uploadedByUserId",
      "unknownRoles", "newPersonNames", "projectNames", "projectAssignments", "projectFloatHours", "projectClients"
    )
    VALUES (
      gen_random_uuid()::text,
      ${completedAt}::timestamptz,
      ${uploadedByUserId},
      ${unknownRolesJson}::jsonb,
      ${newPersonNamesJson}::jsonb,
      ${projectNamesJson}::jsonb,
      ${projectAssignmentsJson}::jsonb,
      ${projectFloatHoursJson}::jsonb,
      ${projectClientsJson}::jsonb
    )
    RETURNING id, "completedAt" as "completedAt"
  `;

  return NextResponse.json({
    ok: true,
    run: {
      id: run?.id ?? "",
      completedAt: run?.completedAt ?? completedAt,
      unknownRoles,
    },
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Import failed", details: message },
      { status: 500 }
    );
  }
}
