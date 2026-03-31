/**
 * Backfill ActualHoursMonthSplit for weeks that span two months but only have ActualHours total.
 *
 * Uses calendar-day pro-rata in UTC (same week definition as getMonthKeysForWeek).
 *
 * Usage:
 *   npx tsx scripts/migrate-split-week-actuals.ts                    # dry-run (default)
 *   npx tsx scripts/migrate-split-week-actuals.ts --project=<id>     # dry-run one project
 *   npx tsx scripts/migrate-split-week-actuals.ts --apply            # write to DB
 *   npx tsx scripts/migrate-split-week-actuals.ts --apply --project=<id>
 *
 * Requires DATABASE_URL (e.g. from .env via dotenv).
 * Requires schema migrations applied so `ActualHoursMonthSplit` exists:
 *   npx prisma migrate deploy
 *
 * Testing:
 * - Run `npm test` — unit tests cover pro-rata math (no database).
 * - Dry-run against any DB: safe reads + logs only.
 * - Use --project to validate one project after switching DATABASE_URL to a clone or production.
 * - Before --apply on production: take a backup (e.g. pg_dump) or run against a staging clone first.
 */

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getMonthKeysForWeek } from "../lib/monthUtils";
import { allocateProRataHoursForSplitWeek, isQuarterHour } from "../lib/splitWeekProRata";

const APPLY = process.argv.includes("--apply");
const projectArg = process.argv.find((a) => a.startsWith("--project="));
const PROJECT_ID_FILTER = projectArg ? projectArg.slice("--project=".length).trim() : null;

function hoursNum(h: unknown): number {
  if (h == null) return NaN;
  if (typeof h === "number") return h;
  if (typeof h === "object" && h !== null && "toString" in h) return Number(h);
  return Number(h);
}

function splitWeekKey(projectId: string, personId: string, weekStartDate: Date): string {
  return `${projectId}|${personId}|${weekStartDate.toISOString().slice(0, 10)}`;
}

async function main() {
  const rows = await prisma.actualHours.findMany({
    where: {
      hours: { not: null },
      ...(PROJECT_ID_FILTER ? { projectId: PROJECT_ID_FILTER } : {}),
    },
    select: {
      projectId: true,
      personId: true,
      weekStartDate: true,
      hours: true,
    },
  });

  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const allSplits =
    projectIds.length === 0
      ? []
      : await prisma.actualHoursMonthSplit.findMany({
          where: { projectId: { in: projectIds } },
        });

  const splitsByKey = new Map<string, typeof allSplits>();
  for (const s of allSplits) {
    const k = splitWeekKey(s.projectId, s.personId, s.weekStartDate);
    const list = splitsByKey.get(k);
    if (list) list.push(s);
    else splitsByKey.set(k, [s]);
  }

  let wouldMigrate = 0;
  let skippedSingleMonth = 0;
  let skippedAlreadyOk = 0;

  type Op = {
    projectId: string;
    personId: string;
    weekStartDate: Date;
    totalHours: number;
    parts: { monthKey: string; hours: number }[];
  };
  const ops: Op[] = [];

  for (const row of rows) {
    const totalHours = hoursNum(row.hours);
    if (!Number.isFinite(totalHours)) continue;

    const keys = getMonthKeysForWeek(row.weekStartDate);
    if (keys.length !== 2) {
      skippedSingleMonth++;
      continue;
    }

    const splits = splitsByKey.get(splitWeekKey(row.projectId, row.personId, row.weekStartDate)) ?? [];

    const splitSum = splits.reduce((s, x) => s + hoursNum(x.hours), 0);
    if (splits.length === 2) {
      const sumOk = Math.abs(splitSum - totalHours) < 1e-6;
      const quartersOk = splits.every((s) => isQuarterHour(hoursNum(s.hours)));
      if (sumOk && quartersOk) {
        skippedAlreadyOk++;
        continue;
      }
    }

    const parts = allocateProRataHoursForSplitWeek(totalHours, row.weekStartDate);
    if (!parts) continue;

    wouldMigrate++;
    ops.push({
      projectId: row.projectId,
      personId: row.personId,
      weekStartDate: row.weekStartDate,
      totalHours,
      parts,
    });
  }

  console.log(
    JSON.stringify(
      {
        dryRun: !APPLY,
        projectFilter: PROJECT_ID_FILTER,
        totalActualHoursRows: rows.length,
        wouldMigrate,
        skippedSingleMonth,
        skippedAlreadyOk,
      },
      null,
      2
    )
  );

  for (const op of ops.slice(0, 50)) {
    const wk = op.weekStartDate.toISOString().slice(0, 10);
    console.log(
      `[${op.projectId.slice(0, 8)}…] ${op.personId.slice(0, 8)}… ${wk} total=${op.totalHours} ->`,
      op.parts.map((p) => `${p.monthKey}:${p.hours}`).join(", ")
    );
  }
  if (ops.length > 50) {
    console.log(`… and ${ops.length - 50} more rows`);
  }

  if (!APPLY) {
    console.log("\nDry run only. Pass --apply to write ActualHoursMonthSplit rows.");
    return;
  }

  let written = 0;
  for (const op of ops) {
    await prisma.$transaction([
      prisma.actualHoursMonthSplit.deleteMany({
        where: {
          projectId: op.projectId,
          personId: op.personId,
          weekStartDate: op.weekStartDate,
        },
      }),
      prisma.actualHoursMonthSplit.createMany({
        data: op.parts.map((p) => ({
          projectId: op.projectId,
          personId: op.personId,
          weekStartDate: op.weekStartDate,
          monthKey: p.monthKey,
          hours: p.hours,
        })),
      }),
    ]);
    written++;
  }

  console.log(`Applied: ${written} week rows updated with month splits.`);
}

main()
  .catch((e) => {
    const missingSplitTable =
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2021" &&
      (e.meta?.modelName === "ActualHoursMonthSplit" ||
        String(e.message).includes("ActualHoursMonthSplit"));
    if (missingSplitTable) {
      console.error(`
The table ActualHoursMonthSplit does not exist in this database.

Apply migrations first (creates the table), then re-run this script:

  npx prisma migrate deploy

If you cloned production data into a dev DB, run migrate deploy against that
DATABASE_URL so the schema matches this app version.
`);
      process.exit(1);
    }
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
