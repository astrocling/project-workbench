"use client";

import { useState, useEffect } from "react";

type SlackConfigClientProps = {
  botTokenConfigured: boolean;
};

type NotifyRow = {
  id: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    slackUserId: string | null;
  };
};

type AdminUserOption = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

function userLabel(u: { id: string; firstName: string | null; lastName: string | null; email?: string }) {
  const n = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (n) return n;
  if (u.email) return u.email;
  return u.id;
}

export function SlackConfigClient({ botTokenConfigured }: SlackConfigClientProps) {
  const [resourcingChannelId, setResourcingChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [notifyRows, setNotifyRows] = useState<NotifyRow[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUserOption[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyError, setNotifyError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/admin/slack-config").then(async (r) => {
        const text = await r.text();
        if (!text) return { resourcingChannelId: null as string | null };
        try {
          return JSON.parse(text) as { resourcingChannelId?: string | null };
        } catch {
          return { resourcingChannelId: null };
        }
      }),
      fetch("/api/admin/slack-config/notify-users").then(async (r) => {
        const text = await r.text();
        if (!text) return [];
        try {
          return JSON.parse(text) as NotifyRow[];
        } catch {
          return [];
        }
      }),
      fetch("/api/admin/users").then(async (r) => {
        const text = await r.text();
        if (!text) return [];
        try {
          return JSON.parse(text) as AdminUserOption[];
        } catch {
          return [];
        }
      }),
    ])
      .then(([slackData, notifyData, usersData]) => {
        if (!cancelled) {
          setResourcingChannelId(slackData.resourcingChannelId ?? "");
          setNotifyRows(Array.isArray(notifyData) ? notifyData : []);
          setAllUsers(Array.isArray(usersData) ? usersData : []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/slack-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourcingChannelId: resourcingChannelId.trim() || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; resourcingChannelId?: string | null };
      if (!res.ok) {
        setError(data.error ?? "Failed to save configuration.");
        return;
      }
      setResourcingChannelId(data.resourcingChannelId ?? "");
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!addUserId.trim()) return;
    setNotifyError("");
    setNotifyBusy(true);
    try {
      const res = await fetch("/api/admin/slack-config/notify-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as NotifyRow & { error?: string };
      if (!res.ok) {
        setNotifyError(data.error ?? "Failed to add user.");
        return;
      }
      setNotifyRows((prev) => [...prev, data]);
      setAddUserId("");
    } finally {
      setNotifyBusy(false);
    }
  }

  async function handleRemoveNotify(userId: string) {
    setNotifyError("");
    setNotifyBusy(true);
    try {
      const res = await fetch(`/api/admin/slack-config/notify-users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotifyError(data.error ?? "Failed to remove user.");
        return;
      }
      setNotifyRows((prev) => prev.filter((row) => row.userId !== userId));
    } finally {
      setNotifyBusy(false);
    }
  }

  const notifyUserIds = new Set(notifyRows.map((r) => r.userId));
  const addOptions = allUsers.filter((u) => !notifyUserIds.has(u.id));

  if (loading) return <p className="p-6 text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Slack Configuration</h1>
      </div>
      <main className="p-8 max-w-2xl">
        <p className="text-body-md text-surface-600 dark:text-surface-300 mb-6">
          Configure Slack channel IDs for automated notifications. The Workbench bot token is loaded from the
          SLACK_BOT_TOKEN environment variable.
        </p>

        <div className="mb-6">
          {botTokenConfigured ? (
            <span className="inline-flex items-center rounded-md px-3 py-1 text-body-sm font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-700">
              Bot token configured
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md px-3 py-1 text-body-sm font-semibold text-jred-800 dark:text-jred-300 bg-jred-50 dark:bg-jred-900/20 border border-jred-200 dark:border-jred-800">
              Bot token not set
            </span>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark space-y-4"
        >
          {error && (
            <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">
              {error}
            </p>
          )}
          {success && (
            <p className="text-body-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-md">
              Configuration saved successfully.
            </p>
          )}
          <div>
            <label
              htmlFor="resourcingChannelId"
              className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100"
            >
              Resourcing Requests Channel ID
            </label>
            <p className="mt-1 text-body-sm text-surface-600 dark:text-surface-400 mb-2">
              The Slack channel ID (e.g. C0123456789) where resourcing requests will be posted.
            </p>
            <input
              id="resourcingChannelId"
              type="text"
              value={resourcingChannelId}
              onChange={(e) => {
                setResourcingChannelId(e.target.value);
                setSuccess(false);
              }}
              className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              placeholder="C0123456789"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 disabled:opacity-50 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        <section className="mt-8 bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark space-y-4">
          <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100">Always Notify</h2>
          <p className="text-body-sm text-surface-600 dark:text-surface-400">
            These users will be tagged on every resourcing request regardless of project.
          </p>
          {notifyError && (
            <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">
              {notifyError}
            </p>
          )}
          <ul className="divide-y divide-surface-100 dark:divide-dark-border border border-surface-200 dark:border-dark-border rounded-md overflow-hidden">
            {notifyRows.length === 0 ? (
              <li className="px-4 py-3 text-body-sm text-surface-600 dark:text-surface-400">No users added yet.</li>
            ) : (
              notifyRows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-50/50 dark:bg-dark-raised/40"
                >
                  <span className="text-body-sm text-surface-800 dark:text-surface-100 min-w-0 truncate">
                    {userLabel(row.user)}
                  </span>
                  <button
                    type="button"
                    disabled={notifyBusy}
                    onClick={() => handleRemoveNotify(row.userId)}
                    className="shrink-0 text-body-sm text-jred-600 dark:text-jred-400 hover:text-jred-800 dark:hover:text-jred-200 font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
          <form onSubmit={handleAddNotify} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 min-w-0">
              <label htmlFor="addNotifyUser" className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">
                Add user
              </label>
              <select
                id="addNotifyUser"
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                disabled={notifyBusy || addOptions.length === 0}
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400 disabled:opacity-50"
              >
                <option value="">
                  {addOptions.length === 0 ? "— No users available —" : "— Select a user —"}
                </option>
                {addOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={notifyBusy || !addUserId.trim()}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 disabled:opacity-50 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              {notifyBusy ? "Adding…" : "Add"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
