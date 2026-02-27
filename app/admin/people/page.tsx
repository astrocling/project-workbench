"use client";

import { useState, useEffect } from "react";

type Person = { id: string; name: string; email: string | null; active: boolean };

export default function AdminPeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [newPersonNames, setNewPersonNames] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/admin/people")
      .then((r) => r.json())
      .then((d) => {
        setPeople(d.people ?? []);
        setNewPersonNames(d.newPersonNames ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function addPerson(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch("/api/admin/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      const p = await res.json();
      setPeople((prev) => {
        const idx = prev.findIndex((x) => x.id === p.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = p;
          return next;
        }
        return [...prev, p].sort((a, b) => a.name.localeCompare(b.name));
      });
      setNewName("");
    }
  }

  async function setActive(personId: string, active: boolean) {
    const res = await fetch("/api/admin/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPeople((prev) =>
        prev.map((x) => (x.id === personId ? { ...x, active: updated.active } : x))
      );
    }
  }

  const visiblePeople = showInactive
    ? people
    : people.filter((p) => p.active);

  if (loading) return <p className="p-6 text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">People</h1>
      </div>
      <main className="p-8 max-w-2xl">
        {newPersonNames.length > 0 && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600 rounded-lg p-4">
            <p className="font-semibold text-amber-800 dark:text-amber-400">New from last Float import</p>
            <p className="text-body-sm text-amber-700 dark:text-amber-400 mt-1">
              These people were added to the list during the most recent import:
            </p>
            <p className="text-body-sm text-surface-700 dark:text-surface-200 mt-2">
              {newPersonNames.join(", ")}
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
          <div className="p-4 border-b border-surface-200 dark:border-dark-border flex flex-wrap gap-2 items-center">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New person name"
              className="flex-1 min-w-[160px] h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
            />
            <button
              type="button"
              onClick={() => newName.trim() && addPerson(newName)}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              Add
            </button>
            <label className="flex items-center gap-2 text-body-sm text-surface-700 dark:text-surface-200">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-surface-300 dark:border-dark-muted"
              />
              Show removed
            </label>
          </div>
          <table className="w-full text-body-sm border-collapse">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Name</th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Email</th>
                <th className="px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeople.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100 ${!p.active ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">{p.name}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{p.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {p.active ? (
                      <button
                        type="button"
                        onClick={() => setActive(p.id, false)}
                        className="text-body-sm text-jred-700 dark:text-jred-400 hover:text-jred-800 font-medium"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActive(p.id, true)}
                        className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
                      >
                        Add back
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visiblePeople.length === 0 && (
            <p className="px-4 py-6 text-body-sm text-surface-500 dark:text-surface-400">
              {showInactive ? "No people (active or removed)." : "No active people. Add someone or show removed."}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
