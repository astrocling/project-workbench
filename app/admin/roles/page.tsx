"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Role = { id: string; name: string };

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [unknownRoles, setUnknownRoles] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles ?? []);
        setUnknownRoles(d.unknownRoles ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function addRole(name: string) {
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const r = await res.json();
      setRoles((prev) => [...prev, r]);
      setUnknownRoles((prev) => prev.filter((x) => x !== name));
      setNewName("");
    }
  }

  if (loading) return <p className="p-6 text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Roles</h1>
      </div>
      <main className="p-8 max-w-2xl">
        {unknownRoles.length > 0 && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600 rounded-lg p-4">
            <p className="font-semibold text-amber-800 dark:text-amber-400">Unknown roles from last Float import</p>
            <p className="text-body-sm text-amber-700 dark:text-amber-400 mt-1">
              Add these to the role catalog:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {unknownRoles.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addRole(name)}
                  className="h-8 px-3 rounded-md bg-amber-600 text-white text-body-sm font-semibold hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  Add &quot;{name}&quot;
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
          <div className="p-4 border-b border-surface-200 dark:border-dark-border flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New role name"
              className="flex-1 h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
            />
            <button
              type="button"
              onClick={() => newName && addRole(newName)}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              Add
            </button>
          </div>
          <table className="w-full text-body-sm border-collapse">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100">
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">{r.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
