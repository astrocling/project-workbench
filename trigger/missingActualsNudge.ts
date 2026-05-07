// Missing actuals reminders (prior UTC week): Tue DM PMs, Wed project channel, Thu account channel.
//
// Env: SLACK_BOT_TOKEN, DATABASE_URL (Trigger.dev)
// Schedules sync on `npx trigger.dev@latest dev` / deploy.

import type { ScheduledTaskPayload } from "@trigger.dev/core/v3";
import { logger, schedules } from "@trigger.dev/sdk/v3";

import {
  type KeyRoleContact,
  type MissingActualsProject,
  getMissingActualsProjects,
} from "@/lib/missingActuals";
import { prisma } from "@/lib/prisma";

type NudgeDay = "tuesday" | "wednesday" | "thursday";

function slackMrkdwnEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mentionContact(c: KeyRoleContact): string {
  const sid = c.slackUserId?.trim();
  if (sid) return `<@${sid}>`;
  return `*${slackMrkdwnEscape(c.name)}*`;
}

function formatPmPgmLine(m: MissingActualsProject): string {
  const pmPart =
    m.projectManagers.length > 0
      ? `PM: ${m.projectManagers.map(mentionContact).join(", ")}`
      : "PM: —";
  const pgmPart =
    m.programManagers.length > 0
      ? ` | PGM: ${m.programManagers.map(mentionContact).join(", ")}`
      : "";
  return pmPart + pgmPart;
}

function buildFallbackText(m: MissingActualsProject, headline: string): string {
  const people = m.missingPersonNames.join(", ");
  return `${headline} — ${m.projectName} (${m.weekLabel}). Missing: ${people}`;
}

function buildBlocks(m: MissingActualsProject, headline: string) {
  const baseUrl = process.env.WORKBENCH_BASE_URL ?? "https://pw.theclingans.com";
  const peopleLines = m.missingPersonNames.map((n) => `• ${slackMrkdwnEscape(n)}`).join("\n");
  return [
    {
      type: "section" as const,
      text: {
        type: "mrkdwn" as const,
        text: `*${slackMrkdwnEscape(headline)}*\n*<${baseUrl}/projects/${m.projectSlug}/resourcing|${slackMrkdwnEscape(m.projectName)}>* · _${slackMrkdwnEscape(m.weekLabel)}_`,
      },
    },
    {
      type: "section" as const,
      text: {
        type: "mrkdwn" as const,
        text: `*Still missing actuals*\n${peopleLines}`,
      },
    },
    {
      type: "context" as const,
      elements: [
        {
          type: "mrkdwn" as const,
          text: formatPmPgmLine(m),
        },
      ],
    },
  ];
}

async function slackPostMessage(
  botToken: string,
  channel: string,
  text: string,
  blocks: ReturnType<typeof buildBlocks>
): Promise<void> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!json.ok) {
    throw new Error(json.error ?? "chat.postMessage failed");
  }
}

async function slackOpenDm(botToken: string, slackUserId: string): Promise<string> {
  const res = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ users: slackUserId }),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string; channel?: { id?: string } };
  if (!json.ok || !json.channel?.id) {
    throw new Error(json.error ?? "conversations.open failed");
  }
  return json.channel.id;
}

async function runTuesday(botToken: string, items: MissingActualsProject[]) {
  for (const m of items) {
    const headline = "Missing actuals";
    const text = buildFallbackText(m, headline);
    const blocks = buildBlocks(m, headline);

    if (m.projectManagers.length === 0) {
      logger.info("Nudge skipped", {
        projectId: m.projectId,
        projectName: m.projectName,
        nudgeDay: 2,
        reason: "no_pm_slack_id",
      });
    }

    for (const pm of m.projectManagers) {
      const sid = pm.slackUserId?.trim();
      if (!sid) continue;
      let dmChannel: string;
      try {
        dmChannel = await slackOpenDm(botToken, sid);
      } catch (e) {
        logger.error("Missing actuals: DM to PM failed", {
          projectId: m.projectId,
          slackUserId: sid,
          error: e instanceof Error ? e.message : String(e),
        });
        continue;
      }
      try {
        await slackPostMessage(botToken, dmChannel, text, blocks);
        try {
          await prisma.actualsNudgeLog.create({
            data: {
              projectId: m.projectId,
              weekStart: m.weekStart,
              nudgeDay: 2,
              channel: "dm",
              slackChannelId: dmChannel,
              recipientSlackUserId: sid,
              missingPersonNames: m.missingPersonNames,
              slackOk: true,
              slackError: null,
            },
          });
        } catch (logErr) {
          logger.warn("Failed to write nudge log", {
            error: logErr instanceof Error ? logErr.message : String(logErr),
          });
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        try {
          await prisma.actualsNudgeLog.create({
            data: {
              projectId: m.projectId,
              weekStart: m.weekStart,
              nudgeDay: 2,
              channel: "dm",
              slackChannelId: dmChannel,
              recipientSlackUserId: sid,
              missingPersonNames: m.missingPersonNames,
              slackOk: false,
              slackError: errMsg,
            },
          });
        } catch (logErr) {
          logger.warn("Failed to write nudge log", {
            error: logErr instanceof Error ? logErr.message : String(logErr),
          });
        }
        logger.error("Missing actuals: DM to PM failed", {
          projectId: m.projectId,
          slackUserId: sid,
          error: errMsg,
        });
      }
    }

    const pmsWithoutSlack = m.projectManagers.filter((pm) => !pm.slackUserId?.trim());
    if (pmsWithoutSlack.length === 0) continue;

    const ch = m.projectSlackChannelId?.trim();
    if (!ch) {
      logger.info("Nudge skipped", {
        projectId: m.projectId,
        projectName: m.projectName,
        nudgeDay: 2,
        reason: "no_project_channel",
      });
      continue;
    }
    try {
      await slackPostMessage(botToken, ch, text, blocks);
      try {
        await prisma.actualsNudgeLog.create({
          data: {
            projectId: m.projectId,
            weekStart: m.weekStart,
            nudgeDay: 2,
            channel: "project",
            slackChannelId: ch,
            recipientSlackUserId: null,
            missingPersonNames: m.missingPersonNames,
            slackOk: true,
            slackError: null,
          },
        });
      } catch (logErr) {
        logger.warn("Failed to write nudge log", {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      try {
        await prisma.actualsNudgeLog.create({
          data: {
            projectId: m.projectId,
            weekStart: m.weekStart,
            nudgeDay: 2,
            channel: "project",
            slackChannelId: ch,
            recipientSlackUserId: null,
            missingPersonNames: m.missingPersonNames,
            slackOk: false,
            slackError: errMsg,
          },
        });
      } catch (logErr) {
        logger.warn("Failed to write nudge log", {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
      logger.error("Missing actuals: project channel fallback failed", {
        projectId: m.projectId,
        error: errMsg,
      });
    }
  }
}

async function runWednesday(botToken: string, items: MissingActualsProject[]) {
  for (const m of items) {
    const ch = m.projectSlackChannelId?.trim();
    if (!ch) {
      logger.info("Nudge skipped", {
        projectId: m.projectId,
        projectName: m.projectName,
        nudgeDay: 3,
        reason: "no_project_channel",
      });
      continue;
    }
    const headline = "Missing actuals";
    const text = buildFallbackText(m, headline);
    const blocks = buildBlocks(m, headline);
    try {
      await slackPostMessage(botToken, ch, text, blocks);
      try {
        await prisma.actualsNudgeLog.create({
          data: {
            projectId: m.projectId,
            weekStart: m.weekStart,
            nudgeDay: 3,
            channel: "project",
            slackChannelId: ch,
            recipientSlackUserId: null,
            missingPersonNames: m.missingPersonNames,
            slackOk: true,
            slackError: null,
          },
        });
      } catch (logErr) {
        logger.warn("Failed to write nudge log", {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      try {
        await prisma.actualsNudgeLog.create({
          data: {
            projectId: m.projectId,
            weekStart: m.weekStart,
            nudgeDay: 3,
            channel: "project",
            slackChannelId: ch,
            recipientSlackUserId: null,
            missingPersonNames: m.missingPersonNames,
            slackOk: false,
            slackError: errMsg,
          },
        });
      } catch (logErr) {
        logger.warn("Failed to write nudge log", {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
      logger.error("Missing actuals: Wed project post failed", {
        projectId: m.projectId,
        error: errMsg,
      });
    }
  }
}

async function runThursday(botToken: string, items: MissingActualsProject[]) {
  for (const m of items) {
    if (!m.accountId || !m.accountSlackChannelId?.trim()) {
      logger.info("Nudge skipped", {
        projectId: m.projectId,
        projectName: m.projectName,
        nudgeDay: 4,
        reason: "no_account_channel",
      });
      continue;
    }
    const ch = m.accountSlackChannelId.trim();
    const headline = "Missing actuals";
    const text = buildFallbackText(m, headline);
    const blocks = buildBlocks(m, headline);
    try {
      await slackPostMessage(botToken, ch, text, blocks);
      try {
        await prisma.actualsNudgeLog.create({
          data: {
            projectId: m.projectId,
            weekStart: m.weekStart,
            nudgeDay: 4,
            channel: "account",
            slackChannelId: ch,
            recipientSlackUserId: null,
            missingPersonNames: m.missingPersonNames,
            slackOk: true,
            slackError: null,
          },
        });
      } catch (logErr) {
        logger.warn("Failed to write nudge log", {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      try {
        await prisma.actualsNudgeLog.create({
          data: {
            projectId: m.projectId,
            weekStart: m.weekStart,
            nudgeDay: 4,
            channel: "account",
            slackChannelId: ch,
            recipientSlackUserId: null,
            missingPersonNames: m.missingPersonNames,
            slackOk: false,
            slackError: errMsg,
          },
        });
      } catch (logErr) {
        logger.warn("Failed to write nudge log", {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
      logger.error("Missing actuals: Thu account post failed", {
        projectId: m.projectId,
        error: errMsg,
      });
    }
  }
}

async function runForDay(day: NudgeDay, payload: ScheduledTaskPayload) {
  logger.info("Missing actuals nudge started", { day, triggeredAt: payload.timestamp });

  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  if (!botToken) {
    logger.warn("Missing actuals nudge: SLACK_BOT_TOKEN is not set; skipping");
    return;
  }

  const items = await getMissingActualsProjects();
  if (items.length === 0) {
    logger.info("Missing actuals nudge: nothing to send", { day });
    return;
  }

  if (day === "tuesday") await runTuesday(botToken, items);
  else if (day === "wednesday") await runWednesday(botToken, items);
  else await runThursday(botToken, items);

  logger.info("Missing actuals nudge finished", { day, projectCount: items.length });
}

/** Tuesday 15:00 UTC — DM each PM (project channel fallback when PM has no slackUserId). */
export const missingActualsNudgeTuesday = schedules.task({
  id: "missing-actuals-nudge-tuesday",
  cron: "0 15 * * 2",
  run: async (payload) => runForDay("tuesday", payload),
});

/** Wednesday 15:00 UTC — project Slack channel. */
export const missingActualsNudgeWednesday = schedules.task({
  id: "missing-actuals-nudge-wednesday",
  cron: "0 15 * * 3",
  run: async (payload) => runForDay("wednesday", payload),
});

/** Thursday 15:00 UTC — account Slack channel (skipped when no account / channel). */
export const missingActualsNudgeThursday = schedules.task({
  id: "missing-actuals-nudge-thursday",
  cron: "0 15 * * 4",
  run: async (payload) => runForDay("thursday", payload),
});
