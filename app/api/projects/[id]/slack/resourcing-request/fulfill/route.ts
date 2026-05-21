import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
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
import {
  buildHoursByPerson,
  computeResourcingFulfillVariance,
  parseRequestedPeoplePayload,
} from "@/lib/resourcingFulfillVariance";
import { floatClientFromEnv } from "@/lib/float";
import { executeFloatApiSync } from "@/lib/float/syncFloatImport";
import { FloatApiError } from "@/lib/float/types";
import { ResourcingRequestStatus } from "@prisma/client";

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function slackMrkdwnEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatFulfilledTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const yy = pad(d.getUTCFullYear() % 100);
  const hh = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  return `${mm}-${dd}-${yy} ${hh}:${min}Z`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolverId = (session.user as { id?: string }).id;
  if (!resolverId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const projectId = await getProjectId(idOrSlug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const request = await prisma.resourcingRequest.findFirst({
    where: { projectId, status: ResourcingRequestStatus.OPEN },
    orderBy: { createdAt: "desc" },
  });
  if (!request) {
    return NextResponse.json({ error: "No open resourcing request found" }, { status: 404 });
  }

  const resolvedAt = new Date();

  await prisma.resourcingRequest.update({
    where: { id: request.id },
    data: {
      status: ResourcingRequestStatus.FILLED,
      resolvedById: resolverId,
      resolvedAt,
    },
  });

  await prisma.readyForFloatUpdate.updateMany({
    where: { projectId },
    data: { ready: false },
  });

  let client;
  try {
    client = floatClientFromEnv();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Float API is not configured", details: message },
      { status: 503 }
    );
  }

  try {
    await executeFloatApiSync(prisma, client, {
      uploadedByUserId: resolverId,
    });
  } catch (err) {
    if (err instanceof FloatApiError) {
      return NextResponse.json(
        {
          error: "Float API request failed",
          status: err.status,
          details: err.message,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Float sync failed", details: message }, { status: 500 });
  }

  revalidateTag("project-resourcing", "max");
  revalidateTag(`project-resourcing:${projectId}`, "max");
  revalidateTag("portfolio-metrics", "max");

  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  const channelId = request.slackChannelId?.trim();
  const messageTs = request.slackMessageTs?.trim();

  const resolver = await prisma.user.findUnique({
    where: { id: resolverId },
    select: {
      firstName: true,
      lastName: true,
      slackUserId: true,
      email: true,
    },
  });

  const resolverPlain =
    resolver != null
      ? [resolver.firstName, resolver.lastName].filter(Boolean).join(" ").trim() ||
        resolver.email
      : "Unknown";

  const resolverMention =
    resolver?.slackUserId && resolver.slackUserId.trim() !== ""
      ? `<@${resolver.slackUserId.trim()}>`
      : slackMrkdwnEscape(resolverPlain);

  const fulfilledBlockText = `*✅ Marked as fulfilled* by ${resolverMention} on ${formatFulfilledTimestamp(resolvedAt.toISOString())}`;

  if (botToken && channelId && messageTs) {
    await fetch("https://slack.com/api/reactions.add", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: channelId,
        timestamp: messageTs,
        name: "white_check_mark",
      }),
    }).catch(() => {});

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: messageTs,
        text: `✅ Marked as fulfilled by ${resolverPlain}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: fulfilledBlockText,
            },
          },
        ],
        unfurl_links: false,
        unfurl_media: false,
      }),
    }).catch(() => {});
  }

  const projectRow = await prisma.project.findUnique({
    where: { id: projectId },
    select: { endDate: true },
  });

  const parsedPayload = parseRequestedPeoplePayload(request.requestedPeople);
  const snapshotMonday = mondayOnOrBeforeTodayUTC();
  const snapshotStartKey =
    parsedPayload.snapshotStartKey ?? utcDateKey(snapshotMonday);
  const snapshotEndKey =
    parsedPayload.snapshotEndKey ??
    computeSnapshotWindowEndKey(
      snapshotMonday,
      projectRow?.endDate ? new Date(projectRow.endDate) : null
    );

  const [floatRows, plannedRows] = await Promise.all([
    prisma.floatScheduledHours.findMany({
      where: {
        projectId,
        weekStartDate: {
          gte: dateKeyToUtcStart(snapshotStartKey),
          lte: dateKeyToUtcStart(snapshotEndKey),
        },
      },
      select: { personId: true, weekStartDate: true, hours: true },
    }),
    prisma.plannedHours.findMany({
      where: {
        projectId,
        weekStartDate: {
          gte: dateKeyToUtcStart(snapshotStartKey),
          lte: dateKeyToUtcStart(snapshotEndKey),
        },
      },
      select: { personId: true, weekStartDate: true, hours: true },
    }),
  ]);

  const floatCurByPerson = buildHoursByPerson(
    floatRows,
    toDateKey,
    snapshotStartKey,
    snapshotEndKey
  );
  const plannedCurByPerson = buildHoursByPerson(
    plannedRows,
    toDateKey,
    snapshotStartKey,
    snapshotEndKey
  );

  const variance = computeResourcingFulfillVariance(
    parsedPayload.people,
    floatCurByPerson,
    plannedCurByPerson
  );

  if (botToken && channelId && messageTs && variance.hasVariance) {
    const lines: string[] = ["⚠️ *Resourcing variance (post-sync)*"];
    if (variance.notFilled.length > 0) {
      lines.push(
        `*Requested — no Float changes detected:*\n${variance.notFilled.map((n) => `• ${slackMrkdwnEscape(n)}`).join("\n")}`
      );
    }
    if (variance.partiallyFilled.length > 0) {
      lines.push(
        `*Requested — partial week updates:*\n${variance.partiallyFilled.map((n) => `• ${slackMrkdwnEscape(n)}`).join("\n")}`
      );
    }
    if (variance.unexpectedFloatChanges.length > 0) {
      const bullets = variance.unexpectedFloatChanges
        .map(
          (e) =>
            `• ${slackMrkdwnEscape(e.name)}${e.summary ? ` — ${slackMrkdwnEscape(e.summary)}` : ""}`
        )
        .join("\n");
      lines.push(`*Unexpected Float changes (not requested):*\n${bullets}`);
    }

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: messageTs,
        text: "Resourcing variance after request fulfilled",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: lines.join("\n\n"),
            },
          },
        ],
        unfurl_links: false,
        unfurl_media: false,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    variance: {
      notFilled: variance.notFilled,
      partiallyFilled: variance.partiallyFilled,
      unexpectedFloatChanges: variance.unexpectedFloatChanges,
    },
  });
}
