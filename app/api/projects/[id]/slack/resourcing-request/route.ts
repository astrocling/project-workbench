import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import {
  computeSnapshotWindowEndKey,
  dateKeyToUtcStart,
  mondayOnOrBeforeTodayUTC,
  utcDateKey,
} from "@/lib/resourcingSnapshotWindow";
import { KeyRoleType, ResourcingRequestStatus } from "@prisma/client";
import { z } from "zod";
import { projectResourcingUrl } from "@/lib/workbenchUrls";

const postSchema = z.object({
  note: z.string().max(500).optional(),
});

function slackMrkdwnEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plainNameForFallback(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email;
}

function requesterBoldMrkdwn(user: {
  slackUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  if (user.slackUserId && user.slackUserId.trim() !== "") {
    return `*<@${user.slackUserId.trim()}>*`;
  }
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return `*${slackMrkdwnEscape(name || user.email)}*`;
}

function formatSlackContextZ(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const yy = pad(d.getUTCFullYear() % 100);
  const hh = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  return `${mm}-${dd}-${yy} ${hh}:${min}Z`;
}

function keyRoleMention(person: {
  name: string;
  user: { slackUserId: string | null } | null;
}): string {
  const sid = person.user?.slackUserId?.trim();
  if (sid) return `<@${sid}>`;
  return slackMrkdwnEscape(person.name);
}

function notifyUserMention(user: {
  slackUserId: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  const sid = user.slackUserId?.trim();
  if (sid) return `<@${sid}>`;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return slackMrkdwnEscape(name || "Unknown");
}

export async function POST(
  req: NextRequest,
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const note =
    parsed.data.note != null && parsed.data.note.trim() !== ""
      ? parsed.data.note.trim()
      : undefined;

  const [project, readyRows, appConfig, requester, notifyRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        endDate: true,
        floatLink: true,
        projectKeyRoles: {
          where: { type: { in: [KeyRoleType.PM, KeyRoleType.PGM] } },
          select: {
            type: true,
            person: {
              select: {
                name: true,
                user: { select: { slackUserId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.readyForFloatUpdate.findMany({
      where: { projectId, ready: true },
      include: { person: { select: { id: true, name: true } } },
    }),
    prisma.appConfig.findUnique({ where: { id: "singleton" } }),
    prisma.user.findUnique({
      where: { id: requesterId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        slackUserId: true,
      },
    }),
    prisma.resourcingNotifyUser.findMany({
      include: {
        user: {
          select: { slackUserId: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!requester) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (readyRows.length === 0) {
    return NextResponse.json({ error: "No people marked ready for changes" }, { status: 400 });
  }

  const channelId = appConfig?.resourcingChannelId?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "Slack resourcing channel not configured" }, { status: 400 });
  }

  const pmPeople = project.projectKeyRoles
    .filter((kr) => kr.type === KeyRoleType.PM)
    .map((kr) => kr.person);
  const pgmPeople = project.projectKeyRoles
    .filter((kr) => kr.type === KeyRoleType.PGM)
    .map((kr) => kr.person);

  const requesterPlain = plainNameForFallback(requester);
  const resourcingUrl = projectResourcingUrl(project.slug);
  const projectLinkLabel = slackMrkdwnEscape(project.name);
  const floatLinkTrimmed = project.floatLink?.trim();
  const floatMrkdwn =
    floatLinkTrimmed && floatLinkTrimmed !== ""
      ? ` | *<${floatLinkTrimmed}|View in Float →>*`
      : " | _Float not linked_";
  const peopleBullets = readyRows
    .map((r) => `• ${slackMrkdwnEscape(r.person.name)}`)
    .join("\n");

  const prefix = ":arrows_counterclockwise: Resourcing Request — ";
  const maxHeader = 150;
  const budget = maxHeader - prefix.length;
  const truncatedName =
    project.name.length > budget ? `${project.name.slice(0, Math.max(0, budget - 1))}…` : project.name;
  const headerPlain = `${prefix}${truncatedName}`;

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: headerPlain, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${requesterBoldMrkdwn(requester)} has requested changes on *<${resourcingUrl}|${projectLinkLabel}>*${floatMrkdwn}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*People:*\n${peopleBullets}`,
      },
    },
  ];

  if (note) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Note:* ${slackMrkdwnEscape(note)}`,
      },
    });
  }

  const pgmAndNotifyParts = [
    ...pgmPeople.map((p) => keyRoleMention(p)),
    ...notifyRows.map((row) => notifyUserMention(row.user)),
  ];
  if (pgmAndNotifyParts.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: pgmAndNotifyParts.join(" ") },
    });
  }

  const tsIso = new Date().toISOString();
  const contextDate = formatSlackContextZ(tsIso);
  const contextText =
    pmPeople.length > 0
      ? `PM: ${pmPeople.map((p) => keyRoleMention(p)).join(", ")} | ${contextDate}`
      : contextDate;
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: contextText,
      },
    ],
  });

  const fallbackText = `${requesterPlain} has requested resourcing changes on ${project.name}`;

  const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: channelId,
      blocks,
      text: fallbackText,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const slackJson = (await slackRes.json()) as { ok?: boolean; error?: string; ts?: string; channel?: string };
  if (!slackJson.ok) {
    return NextResponse.json(
      { error: slackJson.error ?? "Slack API error" },
      { status: 500 }
    );
  }

  const slackMessageTs = slackJson.ts;
  const slackChannelFromApi = slackJson.channel;
  if (!slackMessageTs || !slackChannelFromApi) {
    return NextResponse.json({ error: "Slack response missing message metadata" }, { status: 500 });
  }

  const snapshotMonday = mondayOnOrBeforeTodayUTC();
  const snapshotStartKey = utcDateKey(snapshotMonday);
  const snapshotEndKey = computeSnapshotWindowEndKey(
    snapshotMonday,
    project.endDate ? new Date(project.endDate) : null
  );

  const hoursRows = await prisma.floatScheduledHours.findMany({
    where: {
      projectId,
      weekStartDate: {
        gte: dateKeyToUtcStart(snapshotStartKey),
        lte: dateKeyToUtcStart(snapshotEndKey),
      },
    },
    select: { personId: true, weekStartDate: true, hours: true },
  });

  const readyIds = new Set(readyRows.map((r) => r.person.id));

  const filteredHours = hoursRows.filter((r) => {
    const k = r.weekStartDate.toISOString().split("T")[0]!;
    return k >= snapshotStartKey && k <= snapshotEndKey;
  });

  const byPerson = new Map<string, { weekStartDate: string; hours: number }[]>();
  for (const r of filteredHours) {
    const weekKey = r.weekStartDate.toISOString().split("T")[0]!;
    const hours = Number(r.hours);
    const list = byPerson.get(r.personId) ?? [];
    list.push({ weekStartDate: weekKey, hours });
    byPerson.set(r.personId, list);
  }
  for (const [, list] of byPerson) {
    list.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  }

  const floatPersonIds = new Set(byPerson.keys());
  const nameByPersonId = new Map<string, string>();
  for (const r of readyRows) {
    nameByPersonId.set(r.person.id, r.person.name);
  }
  const extraIds = [...floatPersonIds].filter((id) => !nameByPersonId.has(id));
  if (extraIds.length > 0) {
    const people = await prisma.person.findMany({
      where: { id: { in: extraIds } },
      select: { id: true, name: true },
    });
    for (const p of people) {
      nameByPersonId.set(p.id, p.name);
    }
  }

  const requestedPeople: Array<{
    personId: string;
    name: string;
    requested: boolean;
    hoursSnapshot: { weekStartDate: string; hours: number }[];
  }> = [];

  for (const personId of floatPersonIds) {
    requestedPeople.push({
      personId,
      name: nameByPersonId.get(personId) ?? personId,
      requested: readyIds.has(personId),
      hoursSnapshot: byPerson.get(personId) ?? [],
    });
  }
  for (const r of readyRows) {
    if (!floatPersonIds.has(r.person.id)) {
      requestedPeople.push({
        personId: r.person.id,
        name: r.person.name,
        requested: true,
        hoursSnapshot: [],
      });
    }
  }

  const resourcingRequest = await prisma.resourcingRequest.create({
    data: {
      projectId,
      requestedById: requesterId,
      note: note ?? null,
      requestedPeople,
      slackMessageTs,
      slackChannelId: slackChannelFromApi,
      status: ResourcingRequestStatus.OPEN,
    },
  });

  return NextResponse.json({ success: true, requestId: resourcingRequest.id });
}
