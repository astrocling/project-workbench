export type AccountSlackChannelResult =
  | { ok: true; channelId: string }
  | { ok: false; reason: "no_account" | "no_channel"; error: string };

/** Slack channel for status health updates — account channel only. */
export function resolveAccountSlackChannel(project: {
  accountId?: string | null;
  account?: { slackChannelId: string | null } | null;
}): AccountSlackChannelResult {
  const hasAccount = Boolean(project.accountId ?? project.account);
  if (!hasAccount) {
    return {
      ok: false,
      reason: "no_account",
      error:
        "This project has no linked account. Link it via Float sync, then set a Slack channel in Admin → Accounts.",
    };
  }

  const channelId = project.account?.slackChannelId?.trim() || null;
  if (!channelId) {
    return {
      ok: false,
      reason: "no_channel",
      error:
        "No Slack channel configured for this project's account. Set one in Admin → Accounts.",
    };
  }

  return { ok: true, channelId };
}
