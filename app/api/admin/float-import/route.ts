import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { parseFloatWeekHeader, formatWeekKey } from "@/lib/weekUtils";

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
  const role = (session.user as { role?: string }).role;
  if (role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lastRun = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });
  return NextResponse.json(lastRun);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as { role?: string }).role;
    if (role !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
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
  const knownRoles = await prisma.role.findMany();
  const roleNames = new Set(knownRoles.map((r) => r.name));

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

  for (const row of rows) {
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
    if (
      !arr.some((a) => a.personName.toLowerCase() === name.toLowerCase())
    ) {
      arr.push({ personName: name, roleName });
    }
  }

  const projectNames = Array.from(projectNamesSet).sort();
  const projectAssignments = JSON.parse(
    JSON.stringify(Object.fromEntries(projectAssignmentsMap))
  ) as Record<string, Array<{ personName: string; roleName: string }>>;
  const projectFloatHours = JSON.parse(
    JSON.stringify(Object.fromEntries(projectFloatHoursMap))
  ) as Record<string, Array<{ personName: string; roleName: string; weeks: Array<{ weekStart: string; hours: number }> }>>;
  const projectClients = JSON.parse(
    JSON.stringify(Object.fromEntries(projectToClientMap))
  ) as Record<string, string>;

  const peopleByKey = new Map<string, string>();
  const projectsByName = new Map<string, string>();

  const projects = await prisma.project.findMany();
  for (const p of projects) {
    projectsByName.set(p.name.toLowerCase(), p.id);
  }

  for (const row of rows) {
    const name = (row[nameCol] ?? "").trim();
    const roleName = (row[roleCol] ?? "").trim();
    const projectName = (row[projectCol] ?? "").trim();
    if (!name || !projectName) continue;
    if (name.toUpperCase() === "SCHEDULED" || name.toUpperCase() === "CAPACITY") continue;

    if (roleName && !roleNames.has(roleName)) {
      if (!unknownRoles.includes(roleName)) unknownRoles.push(roleName);
    }

    let person = await prisma.person.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (!person) {
      person = await prisma.person.create({
        data: { name },
      });
    }
    peopleByKey.set(`${name}-${projectName}`.toLowerCase(), person.id);

    // Store float hour data for all projects (for backfilling when project is created after import)
    const weeks: Array<{ weekStart: string; hours: number }> = [];
    for (const { key, weekStart } of weekColumns) {
      const val = parseFloat((row[key] ?? "0").replace(/[^0-9.-]/g, "")) || 0;
      const weekStartUTC = toUTCMonday(weekStart);
      weeks.push({ weekStart: formatWeekKey(weekStartUTC), hours: val });
    }
    if (!projectFloatHoursMap.has(projectName)) {
      projectFloatHoursMap.set(projectName, []);
    }
    projectFloatHoursMap.get(projectName)!.push({ personName: name, roleName, weeks });

    const projectId = projectsByName.get(projectName.toLowerCase());
    if (!projectId) continue;

    const role = await prisma.role.findFirst({
      where: { name: { equals: roleName, mode: "insensitive" } },
    });
    if (!role) continue;

    // Ensure assignment exists
    await prisma.projectAssignment.upsert({
      where: {
        projectId_personId: { projectId, personId: person.id },
      },
      create: {
        projectId,
        personId: person.id,
        roleId: role.id,
      },
      update: { roleId: role.id },
    });

    for (const { key, weekStart } of weekColumns) {
      const val = parseFloat((row[key] ?? "0").replace(/[^0-9.-]/g, "")) || 0;
      const weekStartUTC = toUTCMonday(weekStart);
      await prisma.floatScheduledHours.upsert({
        where: {
          projectId_personId_weekStartDate: {
            projectId,
            personId: person.id,
            weekStartDate: weekStartUTC,
          },
        },
        create: {
          projectId,
          personId: person.id,
          weekStartDate: weekStartUTC,
          hours: val,
        },
        update: { hours: val },
      });
    }
  }

  // PTO/holiday: Float CSV format varies. If weekly columns contain "PTO"/"Holiday" text, record impact.
  for (const row of rows) {
    const name = (row[nameCol] ?? "").trim();
    if (!name) continue;
    const person = await prisma.person.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (!person) continue;
    for (const { key, weekStart } of weekColumns) {
      const val = (row[key] ?? "").toString().trim().toLowerCase();
      if (["pto", "holiday", "off", "vacation", "time off"].some((t) => val.includes(t))) {
        const weekStartUTC = toUTCMonday(weekStart);
        await prisma.pTOHolidayImpact.upsert({
          where: {
            personId_weekStartDate: {
              personId: person.id,
              weekStartDate: weekStartUTC,
            },
          },
          create: {
            personId: person.id,
            weekStartDate: weekStartUTC,
            type: "PTO",
          },
          update: {},
        });
      }
    }
  }

  const completedAt = new Date();
  const uploadedByUserId = (session.user as { id?: string }).id ?? null;
  const unknownRolesJson = JSON.stringify(unknownRoles);
  const projectNamesJson = JSON.stringify(projectNames);
  const projectAssignmentsJson = JSON.stringify(projectAssignments);
  const projectFloatHoursJson = JSON.stringify(projectFloatHours);
  const projectClientsJson = JSON.stringify(projectClients);

  const [run] = await prisma.$queryRaw<Array<{ id: string; completedAt: Date }>>`
    INSERT INTO "FloatImportRun" (
      "id", "completedAt", "uploadedByUserId",
      "unknownRoles", "projectNames", "projectAssignments", "projectFloatHours", "projectClients"
    )
    VALUES (
      gen_random_uuid()::text,
      ${completedAt}::timestamptz,
      ${uploadedByUserId},
      ${unknownRolesJson}::jsonb,
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
