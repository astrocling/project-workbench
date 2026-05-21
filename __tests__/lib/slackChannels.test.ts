import { describe, expect, it } from "vitest";
import { resolveAccountSlackChannel } from "@/lib/slackChannels";

describe("resolveAccountSlackChannel", () => {
  it("returns account channel when set", () => {
    const result = resolveAccountSlackChannel({
      accountId: "acc-1",
      account: { slackChannelId: " C0123456789 " },
    });
    expect(result).toEqual({ ok: true, channelId: "C0123456789" });
  });

  it("ignores project-level channel (account only)", () => {
    const result = resolveAccountSlackChannel({
      accountId: "acc-1",
      account: { slackChannelId: "C9999999999" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.channelId).toBe("C9999999999");
    }
  });

  it("returns no_account when project has no linked account", () => {
    const result = resolveAccountSlackChannel({
      accountId: null,
      account: null,
    });
    expect(result).toEqual({
      ok: false,
      reason: "no_account",
      error: expect.stringContaining("no linked account"),
    });
  });

  it("returns no_channel when account has no slackChannelId", () => {
    const result = resolveAccountSlackChannel({
      accountId: "acc-1",
      account: { slackChannelId: null },
    });
    expect(result).toEqual({
      ok: false,
      reason: "no_channel",
      error: expect.stringContaining("Admin → Accounts"),
    });
  });

  it("returns no_channel when account slackChannelId is blank", () => {
    const result = resolveAccountSlackChannel({
      accountId: "acc-1",
      account: { slackChannelId: "   " },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_channel");
    }
  });

  it("accepts account relation without accountId when account is present", () => {
    const result = resolveAccountSlackChannel({
      account: { slackChannelId: "C0123456789" },
    });
    expect(result).toEqual({ ok: true, channelId: "C0123456789" });
  });
});
