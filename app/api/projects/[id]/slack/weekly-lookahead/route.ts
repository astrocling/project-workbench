import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { resolveProjectSlackChannel } from "@/lib/slackChannels";
import { getProjectId } from "@/lib/slug";
import {
  buildWeeklyLookaheadBlocks,
  collectWeeklyPeople,
  getWeekBounds,
  itemsStartingOrEndingInWeek,
  utcDateKey,
  type DatedItemInput,
} from "@/lib/slack/weeklyLookahead";
import type { PlanItemType } from "@/lib/plan/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requesterId = (session.user as { id?: string }).id;
  if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "Slack is not configured" }, { status: 500 });
  }

  const { id: idOrSlug } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { weekStart, weekEnd, weekStartKey, weekEndKey } = getWeekBounds(new Date());

  const [project, plannedRows, floatRows, assignments, planItems, timelineMarkers, timelineBars, poster] =
    await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, slug: true, slackChannelId: true },
      }),
      prisma.plannedHours.findMany({
        where: { projectId, weekStartDate: weekStart, hours: { gt: 0 } },
        select: { personId: true, hours: true },
      }),
      prisma.floatScheduledHours.findMany({
        where: { projectId, weekStartDate: weekStart, hours: { gt: 0 } },
        select: { personId: true, hours: true },
      }),
      prisma.projectAssignment.findMany({
        where: { projectId },
        select: {
          personId: true,
          role: { select: { name: true } },
          person: {
            select: {
              name: true,
              user: { select: { slackUserId: true } },
            },
          },
        },
      }),
      prisma.planItem.findMany({
        where: {
          phase: { plan: { projectId } },
          OR: [
            { startDate: { gte: weekStart, lte: weekEnd } },
            { endDate: { gte: weekStart, lte: weekEnd } },
          ],
        },
        select: {
          type: true,
          label: true,
          startDate: true,
          endDate: true,
          scheduledTime: true,
        },
      }),
      prisma.timelineMarker.findMany({
        where: {
          projectId,
          date: { gte: weekStart, lte: weekEnd },
        },
        select: { label: true, date: true },
      }),
      prisma.timelineBar.findMany({
        where: {
          projectId,
          OR: [
            { startDate: { gte: weekStart, lte: weekEnd } },
            { endDate: { gte: weekStart, lte: weekEnd } },
          ],
        },
        select: { label: true, startDate: true, endDate: true },
      }),
      prisma.user.findUnique({
        where: { id: requesterId },
        select: { slackUserId: true, firstName: true, lastName: true },
      }),
    ]);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!poster) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelResult = resolveProjectSlackChannel(project);
  if (!channelResult.ok) {
    return NextResponse.json({ error: channelResult.error }, { status: 400 });
  }

  const personIds = new Set<string>();
  for (const row of plannedRows) personIds.add(row.personId);
  for (const row of floatRows) personIds.add(row.personId);

  const assignmentByPerson = new Map(assignments.map((a) => [a.personId, a]));

  const extraIds = [...personIds].filter((id) => !assignmentByPerson.has(id));
  const extraPeople =
    extraIds.length > 0
      ? await prisma.person.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, name: true, user: { select: { slackUserId: true } } },
        })
      : [];
  const extraById = new Map(extraPeople.map((p) => [p.id, p]));

  const peopleInfo: Record<
    string,
    { name: string; slackUserId: string | null; roleName: string | null }
  > = {};
  for (const id of personIds) {
    const assignment = assignmentByPerson.get(id);
    if (assignment) {
      peopleInfo[id] = {
        name: assignment.person.name,
        slackUserId: assignment.person.user?.slackUserId ?? null,
        roleName: assignment.role.name,
      };
    } else {
      const extra = extraById.get(id);
      peopleInfo[id] = {
        name: extra?.name ?? "Unknown",
        slackUserId: extra?.user?.slackUserId ?? null,
        roleName: null,
      };
    }
  }

  const people = collectWeeklyPeople({
    planned: plannedRows.map((r) => ({ personId: r.personId, hours: Number(r.hours) })),
    float: floatRows.map((r) => ({ personId: r.personId, hours: Number(r.hours) })),
    people: peopleInfo,
  });

  const datedInputs: DatedItemInput[] = [
    ...planItems.map((item) => ({
      source: "plan" as const,
      type: item.type as PlanItemType,
      label: item.label,
      startDateKey: utcDateKey(item.startDate),
      endDateKey: utcDateKey(item.endDate),
      scheduledTime: item.scheduledTime,
    })),
    ...timelineMarkers.map((m) => ({
      source: "timeline" as const,
      type: "marker" as const,
      label: m.label,
      startDateKey: utcDateKey(m.date),
      endDateKey: utcDateKey(m.date),
    })),
    ...timelineBars.map((b) => ({
      source: "timeline" as const,
      type: "bar" as const,
      label: b.label,
      startDateKey: utcDateKey(b.startDate),
      endDateKey: utcDateKey(b.endDate),
    })),
  ];

  const items = itemsStartingOrEndingInWeek(datedInputs, weekStartKey, weekEndKey);
  const { blocks, fallbackText } = buildWeeklyLookaheadBlocks({
    projectName: project.name,
    projectSlug: project.slug,
    weekStartKey,
    weekEndKey,
    people,
    items,
    poster,
  });

  const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: channelResult.channelId,
      blocks,
      text: fallbackText,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const slackJson = (await slackRes.json()) as { ok?: boolean; error?: string };
  if (!slackJson.ok) {
    return NextResponse.json(
      { error: slackJson.error ?? "Slack API error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
