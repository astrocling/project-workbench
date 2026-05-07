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

function formatFilledTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const yy = pad(d.getUTCFullYear() % 100);
  const hh = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  return `${mm}-${dd}-${yy} ${hh}:${min}Z`;
}

type NormalizedSnapshotPerson = {
  personId: string;
  name: string;
  requested: boolean;
  hoursSnapshot: { weekStartDate: string; hours: number }[];
};

function normalizeRequestedPeople(raw: unknown): NormalizedSnapshotPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedSnapshotPerson[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const personId = o.personId != null ? String(o.personId) : "";
    const name = o.name != null ? String(o.name) : "";
    if (!personId) continue;
    const requested = o.requested === false ? false : true;
    const snapRaw = o.hoursSnapshot;
    const hoursSnapshot: { weekStartDate: string; hours: number }[] = [];
    if (Array.isArray(snapRaw)) {
      for (const row of snapRaw) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const weekStartDate =
          typeof r.weekStartDate === "string"
            ? r.weekStartDate.slice(0, 10)
            : String(r.weekStartDate ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) continue;
        const hours = Number(r.hours);
        if (!Number.isFinite(hours)) continue;
        hoursSnapshot.push({ weekStartDate, hours });
      }
      hoursSnapshot.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
    }
    out.push({ personId, name: name || personId, requested, hoursSnapshot });
  }
  return out;
}

function snapshotMapFromHoursSnapshot(
  rows: { weekStartDate: string; hours: number }[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.weekStartDate.slice(0, 10), r.hours);
  }
  return m;
}

function weekVarianceStats(snap: Map<string, number>, cur: Map<string, number>) {
  const keys = new Set([...snap.keys(), ...cur.keys()]);
  let matchingWeeks = 0;
  let differingWeeks = 0;
  for (const k of keys) {
    const va = snap.get(k) ?? 0;
    const vb = cur.get(k) ?? 0;
    if (Math.abs(va - vb) <= 1e-9) matchingWeeks += 1;
    else differingWeeks += 1;
  }
  const equal = differingWeeks === 0;
  return { equal, matchingWeeks, differingWeeks };
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

  const filledBlockText = `*✅ Marked as filled* by ${resolverMention} on ${formatFilledTimestamp(resolvedAt.toISOString())}`;

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
        text: `✅ Marked as filled by ${resolverPlain}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: filledBlockText,
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

  const snapshotMonday = mondayOnOrBeforeTodayUTC();
  const snapshotStartKey = utcDateKey(snapshotMonday);
  const snapshotEndKey = computeSnapshotWindowEndKey(
    snapshotMonday,
    projectRow?.endDate ? new Date(projectRow.endDate) : null
  );

  const normalizedPeople = normalizeRequestedPeople(request.requestedPeople);

  const currentRows = await prisma.floatScheduledHours.findMany({
    where: {
      projectId,
      weekStartDate: {
        gte: dateKeyToUtcStart(snapshotStartKey),
        lte: dateKeyToUtcStart(snapshotEndKey),
      },
    },
    select: { personId: true, weekStartDate: true, hours: true },
  });

  const currentFiltered = currentRows.filter((r) => {
    const k = toDateKey(r.weekStartDate);
    return k >= snapshotStartKey && k <= snapshotEndKey;
  });

  const currentByPerson = new Map<string, Map<string, number>>();
  for (const r of currentFiltered) {
    const inner = currentByPerson.get(r.personId) ?? new Map<string, number>();
    inner.set(toDateKey(r.weekStartDate), Number(r.hours));
    currentByPerson.set(r.personId, inner);
  }

  const notFilled: string[] = [];
  const partiallyFilled: string[] = [];
  const unexpectedChanges: string[] = [];

  for (const p of normalizedPeople) {
    const snapMap = snapshotMapFromHoursSnapshot(p.hoursSnapshot);
    const curMap = currentByPerson.get(p.personId) ?? new Map<string, number>();
    const stats = weekVarianceStats(snapMap, curMap);

    if (p.requested) {
      if (stats.equal) {
        notFilled.push(p.name);
      } else if (stats.matchingWeeks > 0 && stats.differingWeeks > 0) {
        partiallyFilled.push(p.name);
      }
    } else if (!stats.equal) {
      unexpectedChanges.push(p.name);
    }
  }

  const hasVariance =
    notFilled.length > 0 || partiallyFilled.length > 0 || unexpectedChanges.length > 0;

  if (botToken && channelId && messageTs && hasVariance) {
    const lines: string[] = ["⚠️ *Resourcing variance (post-sync)*"];
    if (notFilled.length > 0) {
      lines.push(
        `*Requested — no Float changes detected:*\n${notFilled.map((n) => `• ${slackMrkdwnEscape(n)}`).join("\n")}`
      );
    }
    if (partiallyFilled.length > 0) {
      lines.push(
        `*Requested — partial week updates:*\n${partiallyFilled.map((n) => `• ${slackMrkdwnEscape(n)}`).join("\n")}`
      );
    }
    if (unexpectedChanges.length > 0) {
      lines.push(
        `*Unexpected Float changes (not requested):*\n${unexpectedChanges.map((n) => `• ${slackMrkdwnEscape(n)}`).join("\n")}`
      );
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
        text: "Resourcing variance after fulfill",
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
      notFilled,
      partiallyFilled,
      unexpectedChanges,
    },
  });
}
