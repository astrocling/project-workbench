"use client";

import { useEffect, useState } from "react";

type IndustryGroupRow = {
  id: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { accounts: number; users: number };
};

export default function AdminIndustryGroupsPage() {
  const [groups, setGroups] = useState<IndustryGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [editing, setEditing] = useState<IndustryGroupRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editArchived, setEditArchived] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/admin/industry-groups")
      .then(async (r) => {
        const text = await r.text();
        if (!text) return [];
        try {
          return JSON.parse(text) as IndustryGroupRow[];
        } catch {
          return [];
        }
      })
      .then(setGroups)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const res = await fetch("/api/admin/industry-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const text = await res.text();
    let data: { error?: string } & Partial<IndustryGroupRow> = {};
    try {
      if (text) data = JSON.parse(text);
    } catch {
      setAddError(res.ok ? "Invalid response" : "Failed to add");
      setAdding(false);
      return;
    }
    if (!res.ok) {
      setAddError(data.error ?? "Failed to add");
      setAdding(false);
      return;
    }
    setGroups((prev) => [...prev, data as IndustryGroupRow].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setAdding(false);
  }

  function openEdit(g: IndustryGroupRow) {
    setEditing(g);
    setEditName(g.name);
    setEditArchived(!!g.archivedAt);
    setSaveError("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setSaveError("");
    const name = editName.trim();
    if (!name) {
      setSaveError("Name is required");
      setSaving(false);
      return;
    }
    const body: { name?: string; archived?: boolean } = {};
    if (name !== editing.name) body.name = name;
    const wasArchived = !!editing.archivedAt;
    if (editArchived !== wasArchived) body.archived = editArchived;
    if (Object.keys(body).length === 0) {
      setEditing(null);
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/admin/industry-groups/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: { error?: string } & Partial<IndustryGroupRow> = {};
    try {
      if (text) data = JSON.parse(text);
    } catch {
      setSaveError(res.ok ? "Invalid response" : "Failed to save");
      setSaving(false);
      return;
    }
    if (!res.ok) {
      setSaveError(data.error ?? "Failed to save");
      setSaving(false);
      return;
    }
    setGroups((prev) =>
      prev.map((x) => (x.id === editing.id ? ({ ...x, ...data } as IndustryGroupRow) : x)).sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditing(null);
    setSaving(false);
  }

  async function quickArchive(id: string, archived: boolean) {
    const res = await fetch(`/api/admin/industry-groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as IndustryGroupRow;
    setGroups((prev) => prev.map((x) => (x.id === id ? updated : x)).sort((a, b) => a.name.localeCompare(b.name)));
  }

  if (loading) return <p className="p-6 text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Industry groups</h1>
      </div>
      <main className="p-8 max-w-4xl">
        <p className="text-body-md text-surface-600 dark:text-surface-300 mb-6">
          Assign industry groups to client accounts and users. All projects linked to an account inherit that
          account&apos;s group.
        </p>

        <form onSubmit={handleAdd} className="bg-white dark:bg-dark-surface p-4 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark mb-6 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">New group name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Financial Services"
              className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 disabled:opacity-50 text-white font-semibold text-body-sm"
          >
            {adding ? "Adding…" : "Add"}
          </button>
          {addError && <p className="w-full text-body-sm text-jred-700 dark:text-jred-400">{addError}</p>}
        </form>

        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-x-auto">
          <table className="w-full min-w-[640px] text-body-sm border-collapse">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold whitespace-nowrap">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold whitespace-nowrap">
                  Accounts
                </th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold whitespace-nowrap">
                  Users
                </th>
                <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold whitespace-nowrap w-[1%]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100"
                >
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200 font-medium">{g.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {g.archivedAt ? (
                      <span className="inline-flex items-center rounded-md bg-surface-200 dark:bg-dark-muted px-2 py-0.5 text-label-sm text-surface-600 dark:text-surface-300">
                        Archived
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-label-sm text-emerald-800 dark:text-emerald-300">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">{g._count.accounts}</td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">{g._count.users}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(g)}
                      className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
                    >
                      Edit
                    </button>
                    {g.archivedAt ? (
                      <button
                        type="button"
                        onClick={() => quickArchive(g.id, false)}
                        className="text-body-sm text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white font-medium"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => quickArchive(g.id, true)}
                        className="text-body-sm text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white font-medium"
                      >
                        Archive
                      </button>
                    )}
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
              <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">Edit industry group</h2>
              {saveError && (
                <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md mb-4">{saveError}</p>
              )}
              <form onSubmit={saveEdit} className="space-y-4">
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editArchived}
                    onChange={(e) => setEditArchived(e.target.checked)}
                    className="rounded border-surface-300 dark:border-dark-muted"
                  />
                  <span className="text-body-sm text-surface-800 dark:text-surface-100">Archived</span>
                </label>
                <p className="text-body-sm text-surface-500 dark:text-surface-400">
                  Archived groups stay on existing accounts and users; new assignments must use an active group.
                </p>
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
