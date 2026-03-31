import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { formatWeekKey, getWeekStartDate } from "@/lib/weekUtils";

/**
 * Single GET that returns all data needed for the Resourcing tab:
 * project (dates, thresholds), assignments, plannedHours, actualHours,
 * floatHours, readyForFloat, cellComments. Replaces 7 separate API calls.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fromWeekParam = req.nextUrl.searchParams.get("fromWeek");
  const toWeekParam = req.nextUrl.searchParams.get("toWeek");

  const toDateKey = (d: Date | string): string =>
    typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);

  const getCachedResourcing = unstable_cache(
    async (projectId: string, fromWeek: string, toWeek: string) => {
      const from = new Date(fromWeek + "T00:00:00.000Z");
      const to = new Date(toWeek + "T00:00:00.000Z");
      const [project, floatRows, readyForFloatRows, commentRows, monthSplitRows] = await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          select: {
            startDate: true,
            endDate: true,
            actualsLowThresholdPercent: true,
            actualsHighThresholdPercent: true,
            assignments: {
              where: { hiddenFromGrid: false },
              select: {
                personId: true,
                person: { select: { name: true } },
                role: { select: { name: true } },
              },
            },
            plannedHours: {
              where: { weekStartDate: { gte: from, lte: to } },
              select: {
                projectId: true,
                personId: true,
                weekStartDate: true,
                hours: true,
              },
            },
            actualHours: {
              where: { weekStartDate: { gte: from, lte: to } },
              select: {
                projectId: true,
                personId: true,
                weekStartDate: true,
                hours: true,
              },
            },
          },
        }),
        prisma.floatScheduledHours.findMany({
          where: { projectId: projectId, weekStartDate: { gte: from, lte: to } },
          select: { projectId: true, personId: true, weekStartDate: true, hours: true },
        }),
        prisma.readyForFloatUpdate.findMany({
          where: { projectId: projectId },
          select: { projectId: true, personId: true, ready: true },
        }),
        prisma.gridCellComment.findMany({
          where: { projectId: projectId, weekStartDate: { gte: from, lte: to } },
          select: { projectId: true, personId: true, weekStartDate: true, gridType: true, comment: true },
        }),
        prisma.actualHoursMonthSplit.findMany({
          where: { projectId: projectId, weekStartDate: { gte: from, lte: to } },
          select: {
            projectId: true,
            personId: true,
            weekStartDate: true,
            monthKey: true,
            hours: true,
          },
        }),
      ]);

      if (!project) return null;

      const visiblePersonIds = new Set(project.assignments.map((a) => a.personId));

      return {
        range: { fromWeek, toWeek },
        project: {
          startDate: project.startDate,
          endDate: project.endDate,
          actualsLowThresholdPercent: project.actualsLowThresholdPercent ?? null,
          actualsHighThresholdPercent: project.actualsHighThresholdPercent ?? null,
        },
        assignments: project.assignments,
        plannedHours: project.plannedHours.map((r) => ({
          projectId: r.projectId,
          personId: r.personId,
          weekStartDate: toDateKey(r.weekStartDate),
          hours: Number(r.hours),
        })),
        actualHours: project.actualHours.map((r) => ({
          projectId: r.projectId,
          personId: r.personId,
          weekStartDate: toDateKey(r.weekStartDate),
          hours: r.hours != null ? Number(r.hours) : null,
        })),
        monthSplits: monthSplitRows
          .filter((r) => visiblePersonIds.has(r.personId))
          .map((r) => ({
            projectId: r.projectId,
            personId: r.personId,
            weekStartDate: toDateKey(r.weekStartDate),
            monthKey: r.monthKey,
            hours: Number(r.hours),
          })),
        floatHours: floatRows
          .filter((r) => visiblePersonIds.has(r.personId))
          .map((r) => ({
            projectId: r.projectId,
            personId: r.personId,
            weekStartDate: formatWeekKey(r.weekStartDate),
            hours: Number(r.hours),
          })),
        readyForFloat: readyForFloatRows.filter((r) => visiblePersonIds.has(r.personId)),
        cellComments: commentRows
          .filter((r) => visiblePersonIds.has(r.personId))
          .map((r) => ({
            projectId: r.projectId,
            personId: r.personId,
            weekStartDate: toDateKey(r.weekStartDate),
            gridType: r.gridType,
            comment: r.comment,
          })),
      };
    },
    ["project-resourcing"],
    { revalidate: 60, tags: [`project-resourcing:${id}`] }
  );

  // Default range: full project span.
  // (A bounded window required extra user clicks to see all weeks.)
  const meta = await prisma.project.findUnique({
    where: { id },
    select: { startDate: true, endDate: true },
  });
  if (!meta) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projectStartWeek = getWeekStartDate(new Date(meta.startDate));
  const projectEndWeek = getWeekStartDate(new Date(meta.endDate ?? new Date()));
  const clamp = (d: Date) =>
    d < projectStartWeek ? new Date(projectStartWeek) : d > projectEndWeek ? new Date(projectEndWeek) : d;

  const defaultFrom = clamp(projectStartWeek);
  const defaultTo = clamp(projectEndWeek);

  const normalizedFrom = getWeekStartDate(
    fromWeekParam ? new Date(fromWeekParam + "T00:00:00.000Z") : defaultFrom
  );
  const normalizedTo = getWeekStartDate(
    toWeekParam ? new Date(toWeekParam + "T00:00:00.000Z") : defaultTo
  );

  const fromWeek = toDateKey(normalizedFrom);
  const toWeek = toDateKey(normalizedTo);

  const data = await getCachedResourcing(id, fromWeek, toWeek);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("debugSize") === "1") {
    try {
      const bytes = Buffer.byteLength(JSON.stringify(data), "utf8");
      // eslint-disable-next-line no-console
      console.info(`[resourcing] response_bytes=${bytes} projectId=${id} from=${fromWeek} to=${toWeek}`);
    } catch {
      // ignore
    }
  }

  return NextResponse.json(data);
}
