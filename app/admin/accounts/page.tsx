"use client";

import { useState, useEffect } from "react";

type AccountRow = {
  id: string;
  name: string;
  floatClientId: number | null;
  slackChannelId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { projects: number };
};

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [slackChannelId, setSlackChannelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    fetch("/api/admin/accounts")
      .then(async (r) => {
        const text = await r.text();
        if (!text) return [];
        try {
          return JSON.parse(text) as AccountRow[];
        } catch {
          return [];
        }
      })
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, []);

  function openEdit(a: AccountRow) {
    setEditing(a);
    setSlackChannelId(a.slackChannelId ?? "");
    setEditError("");
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError("");
    const res = await fetch(`/api/admin/accounts/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slackChannelId: slackChannelId.trim() || null }),
    });
    const text = await res.text();
    let data: { error?: string } & Partial<AccountRow> = {};
    try {
      if (text) data = JSON.parse(text);
    } catch {
      setEditError(res.ok ? "Invalid response" : "Failed to update account");
      setSaving(false);
      return;
    }
    if (!res.ok) {
      setEditError(data.error ?? "Failed to update account");
      setSaving(false);
      return;
    }
    setAccounts((prev) => prev.map((x) => (x.id === editing.id ? (data as AccountRow) : x)));
    setEditing(null);
    setSaving(false);
  }

  if (loading) return <p className="p-6 text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Accounts</h1>
      </div>
      <main className="p-8 max-w-5xl">
        <p className="text-body-md text-surface-600 dark:text-surface-300 mb-6">
          Accounts are synced from Float. Configure Slack channel IDs to enable project health updates.
        </p>

        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-x-auto">
          <table className="w-full min-w-[720px] text-body-sm border-collapse">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  Account Name
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold whitespace-nowrap">
                  Projects
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  Slack Channel ID
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold whitespace-nowrap">
                  Last Updated
                </th>
                <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold whitespace-nowrap w-[1%]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100"
                >
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200 max-w-[14rem] truncate" title={a.name}>
                    {a.name}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200 whitespace-nowrap">{a._count.projects}</td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200 font-mono text-body-sm max-w-[12rem] truncate" title={a.slackChannelId ?? undefined}>
                    {a.slackChannelId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200 whitespace-nowrap">
                    {new Date(a.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap w-[1%]">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !saving && setEditing(null)}
          >
            <div
              className="bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">Edit account</h2>
              <p className="text-body-sm text-surface-600 dark:text-surface-300 mb-4">{editing.name}</p>
              {editError && (
                <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md mb-4">
                  {editError}
                </p>
              )}
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">
                    Slack Channel ID
                  </label>
                  <input
                    type="text"
                    value={slackChannelId}
                    onChange={(e) => setSlackChannelId(e.target.value)}
                    placeholder="C0123456789"
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => !saving && setEditing(null)}
                    className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted text-body-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-dark-raised"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 disabled:opacity-50 text-white font-semibold text-body-sm"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
