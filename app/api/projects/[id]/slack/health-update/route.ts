import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { resolveAccountSlackChannel } from "@/lib/slackChannels";
import { getProjectId } from "@/lib/slug";
import { projectStatusReportsUrl } from "@/lib/workbenchUrls";
import { isStatusReportSnapshot } from "@/lib/statusReportPdfData";
import { z } from "zod";

const postSchema = z.object({
  note: z.string().max(500).optional(),
});

function slackMrkdwnEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ragEmoji(rag: string | null | undefined): string {
  if (rag == null) return "⚪";
  if (rag === "Red") return "🔴";
  if (rag === "Amber") return "🟡";
  if (rag === "Green") return "🟢";
  return "⚪";
}

function formatUsdNoDecimals(n: number): string {
  return Math.round(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatHoursDisplay(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const s = rounded.toFixed(2).replace(/\.?0+$/, "");
  return s;
}

function formatReportPeriodFallback(reportDate: Date): string {
  return reportDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMilestoneDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pmMentionText(user: {
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      accountId: true,
      account: { select: { slackChannelId: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const channelResult = resolveAccountSlackChannel(project);
  if (!channelResult.ok) {
    return NextResponse.json({ error: channelResult.error }, { status: 400 });
  }
  const channelId = channelResult.channelId;

  const report = await prisma.statusReport.findFirst({
    where: { projectId },
    orderBy: { reportDate: "desc" },
  });
  if (!report) {
    return NextResponse.json({ error: "No status reports found" }, { status: 400 });
  }

  const snapshot = isStatusReportSnapshot(report.snapshot) ? report.snapshot : null;
  const budget = snapshot?.budget ?? null;

  const todayUtc = new Date().toISOString().slice(0, 10);
  let nextMilestone: { label: string; date: string } | null = null;
  const markers = snapshot?.timeline?.markers;
  if (markers && markers.length > 0) {
    const sorted = [...markers].sort((a, b) => a.date.localeCompare(b.date));
    const hit = sorted.find((m) => m.date >= todayUtc);
    if (hit) nextMilestone = { label: hit.label, date: hit.date };
  }

  const ragOverall = report.ragOverall;
  const ragScope = report.ragScope;
  const ragSchedule = report.ragSchedule;
  const ragBudget = report.ragBudget;

  const ragParts: string[] = [];
  if (ragOverall != null) ragParts.push(`${ragEmoji(ragOverall)} *Overall*`);
  if (ragScope != null) ragParts.push(`${ragEmoji(ragScope)} *Scope*`);
  if (ragSchedule != null) ragParts.push(`${ragEmoji(ragSchedule)} *Schedule*`);
  if (ragBudget != null) ragParts.push(`${ragEmoji(ragBudget)} *Budget*`);

  const blocks: Record<string, unknown>[] = [];

  const headerPrefix = "📊 Project Status Report — ";
  const maxHeader = 150;
  const budgetForName = maxHeader - headerPrefix.length;
  const truncatedName =
    project.name.length > budgetForName
      ? `${project.name.slice(0, Math.max(0, budgetForName - 1))}…`
      : project.name;
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `${headerPrefix}${truncatedName}`, emoji: true },
  });

  if (ragParts.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: ragParts.join("\n"),
      },
    });
  }

  if (budget) {
    const burn =
      budget.burnPercentHigh != null
        ? ` (${budget.burnPercentHigh.toFixed(1)}% burned)`
        : "";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Hours:* ${formatHoursDisplay(budget.actualHours)} actual · ` +
          `${formatHoursDisplay(budget.budgetedHoursHigh)} budgeted · ` +
          `${formatHoursDisplay(budget.remainingHoursHigh)} remaining\n` +
          `*Budget:* $${formatUsdNoDecimals(budget.spentDollars)} spent of ` +
          `$${formatUsdNoDecimals(budget.estBudgetHigh)}` +
          burn,
      },
    });
  }

  if (nextMilestone) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Next milestone:* ${slackMrkdwnEscape(nextMilestone.label)} — ${formatMilestoneDate(nextMilestone.date)}`,
      },
    });
  }

  if (note) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Note:* ${slackMrkdwnEscape(note)}`,
      },
    });
  }

  const poster = await prisma.user.findUnique({
    where: { id: requesterId },
    select: {
      slackUserId: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!poster) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keyRoles = await prisma.projectKeyRole.findMany({
    where: { projectId },
    include: {
      person: {
        select: { name: true, user: { select: { slackUserId: true } } },
      },
    },
  });

  const mentionForRole = (type: string) =>
    keyRoles
      .filter((kr) => kr.type === type)
      .map((kr) =>
        kr.person.user?.slackUserId
          ? `<@${kr.person.user.slackUserId}>`
          : slackMrkdwnEscape(kr.person.name)
      )
      .join(" ");

  const pmMention = mentionForRole("PM");
  const pgmMention = mentionForRole("PGM");
  const cadMention = mentionForRole("CAD");

  const roleMentions = [pmMention, pgmMention, cadMention].filter(Boolean).join(" ");

  const reportUrl = projectStatusReportsUrl(project.slug);
  const pmPosterMention = pmMentionText(poster);
  const posterLine =
    roleMentions.length > 0
      ? `${roleMentions}\nPosted by ${pmPosterMention} · <${reportUrl}|View full report →>`
      : `Posted by ${pmPosterMention} · <${reportUrl}|View full report →>`;
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: posterLine,
    },
  });

  const periodLine =
    snapshot?.period ??
    formatReportPeriodFallback(
      report.reportDate instanceof Date ? report.reportDate : new Date(report.reportDate)
    );
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Report period: ${slackMrkdwnEscape(periodLine)}`,
      },
    ],
  });

  const fallbackText = `Project health update — ${project.name}`;

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

  const slackJson = (await slackRes.json()) as { ok?: boolean; error?: string };
  if (!slackJson.ok) {
    return NextResponse.json(
      { error: slackJson.error ?? "Slack API error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
