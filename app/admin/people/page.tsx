"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

type Person = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  floatRegionId: number | null;
  floatRegionName: string | null;
  floatJobTitle: string | null;
  floatDepartmentName: string | null;
  floatTags: unknown;
  floatSchedulingActive: boolean | null;
  floatAccessLabel: string | null;
};

type SortKey =
  | "name"
  | "email"
  | "floatJobTitle"
  | "tags"
  | "floatRegionId"
  | "floatDepartmentName"
  | "floatSchedulingActive"
  | "floatAccessLabel"
  | "active";

type SortDir = "asc" | "desc";

function tagsDisplay(tags: unknown): string {
  if (Array.isArray(tags) && tags.every((t) => typeof t === "string")) {
    return tags.length ? tags.join(", ") : "—";
  }
  return "—";
}

function yesNo(v: boolean | null): string {
  if (v === null) return "—";
  return v ? "Yes" : "No";
}

function compareNullableBool(a: boolean | null, b: boolean | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return Number(a) - Number(b);
}

function sortPeople(list: Person[], key: SortKey, dir: SortDir): Person[] {
  const m = dir === "asc" ? 1 : -1;
  const next = [...list];
  next.sort((a, b) => {
    switch (key) {
      case "name":
        return m * a.name.localeCompare(b.name);
      case "email":
        return m * (a.email ?? "").localeCompare(b.email ?? "");
      case "floatJobTitle":
        return m * (a.floatJobTitle ?? "").localeCompare(b.floatJobTitle ?? "");
      case "tags":
        return m * tagsDisplay(a.floatTags).localeCompare(tagsDisplay(b.floatTags));
      case "floatRegionId": {
        const av = a.floatRegionId;
        const bv = b.floatRegionId;
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return m * (av - bv);
      }
      case "floatDepartmentName":
        return m * (a.floatDepartmentName ?? "").localeCompare(b.floatDepartmentName ?? "");
      case "floatSchedulingActive":
        return m * compareNullableBool(a.floatSchedulingActive, b.floatSchedulingActive);
      case "floatAccessLabel":
        return m * (a.floatAccessLabel ?? "").localeCompare(b.floatAccessLabel ?? "");
      case "active":
        return m * compareNullableBool(a.active, b.active);
      default:
        return 0;
    }
  });
  return next;
}

function SortableTh({
  label,
  sortColumn,
  sortKey,
  sortDir,
  onToggle,
  className = "",
}: {
  label: string;
  sortColumn: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggle: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === sortColumn;
  const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      scope="col"
      className={`text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => onToggle(sortColumn)}
        className="inline-flex items-center gap-1 -mx-1 px-1 rounded hover:bg-surface-100 dark:hover:bg-dark-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-500/40"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span className="font-normal tabular-nums w-4 text-surface-400 dark:text-surface-500">{arrow}</span>
      </button>
    </th>
  );
}

export default function AdminPeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [newPersonNames, setNewPersonNames] = useState<string[]>([]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterJobTitle, setFilterJobTitle] = useState<string>("");
  const [filterRegionId, setFilterRegionId] = useState<string>("");
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  /** Workbench column (Yes/No): all | yes | no */
  const [filterWorkbenchActive, setFilterWorkbenchActive] = useState<"all" | "yes" | "no">("yes");
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

  const closeAddPersonDialog = useCallback(() => {
    setShowAddPerson(false);
    setNewName("");
    setAddingPerson(false);
  }, []);

  useEffect(() => {
    if (!showAddPerson) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAddPersonDialog();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddPerson, closeAddPersonDialog]);

  async function submitAddPerson() {
    const trimmed = newName.trim();
    if (!trimmed || addingPerson) return;
    setAddingPerson(true);
    try {
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
        closeAddPersonDialog();
      }
    } finally {
      setAddingPerson(false);
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

  const jobTitleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      if (p.floatJobTitle?.trim()) set.add(p.floatJobTitle.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [people]);

  const regionIdOptions = useMemo(() => {
    const ids = new Set<number>();
    for (const p of people) {
      if (p.floatRegionId !== null) ids.add(p.floatRegionId);
    }
    return [...ids].sort((a, b) => a - b);
  }, [people]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      if (p.floatDepartmentName?.trim()) set.add(p.floatDepartmentName.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [people]);

  const filteredPeople = useMemo(() => {
    return people.filter((p) => {
      if (filterWorkbenchActive === "yes" && !p.active) return false;
      if (filterWorkbenchActive === "no" && p.active) return false;
      if (filterJobTitle) {
        const j = p.floatJobTitle?.trim() ?? "";
        if (j !== filterJobTitle) return false;
      }
      if (filterRegionId) {
        if (filterRegionId === "__none__") {
          if (p.floatRegionId !== null) return false;
        } else if (String(p.floatRegionId) !== filterRegionId) {
          return false;
        }
      }
      if (filterDepartment) {
        const d = p.floatDepartmentName?.trim() ?? "";
        if (filterDepartment === "__none__") {
          if (d !== "") return false;
        } else if (d !== filterDepartment) {
          return false;
        }
      }
      return true;
    });
  }, [people, filterWorkbenchActive, filterJobTitle, filterRegionId, filterDepartment]);

  const visiblePeople = useMemo(
    () => sortPeople(filteredPeople, sortKey, sortDir),
    [filteredPeople, sortKey, sortDir]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setFilterJobTitle("");
    setFilterRegionId("");
    setFilterDepartment("");
    setFilterWorkbenchActive("yes");
  }

  const filtersAreDefault =
    filterJobTitle === "" &&
    filterRegionId === "" &&
    filterDepartment === "" &&
    filterWorkbenchActive === "yes";

  if (loading) return <p className="p-6 text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">People</h1>
      </div>
      <main className="p-8 max-w-[100rem]">
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
          <div className="p-4 border-b border-surface-200 dark:border-dark-border flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={() => {
                setNewName("");
                setShowAddPerson(true);
              }}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              Add person
            </button>
            <div className="flex flex-wrap gap-3 items-center text-body-sm text-surface-700 dark:text-surface-200">
              <label className="flex items-center gap-2">
                <span className="text-surface-500 dark:text-surface-400 whitespace-nowrap">Job title</span>
                <select
                  value={filterJobTitle}
                  onChange={(e) => setFilterJobTitle(e.target.value)}
                  className="h-9 min-w-[10rem] px-2 rounded-md bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30"
                >
                  <option value="">All</option>
                  {jobTitleOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-surface-500 dark:text-surface-400 whitespace-nowrap">Region ID</span>
                <select
                  value={filterRegionId}
                  onChange={(e) => setFilterRegionId(e.target.value)}
                  className="h-9 min-w-[8rem] px-2 rounded-md bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30"
                >
                  <option value="">All</option>
                  <option value="__none__">— (none)</option>
                  {regionIdOptions.map((id) => (
                    <option key={id} value={String(id)}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-surface-500 dark:text-surface-400 whitespace-nowrap">Department</span>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="h-9 min-w-[10rem] px-2 rounded-md bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30"
                >
                  <option value="">All</option>
                  <option value="__none__">— (none)</option>
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-surface-500 dark:text-surface-400 whitespace-nowrap">Active</span>
                <select
                  value={filterWorkbenchActive}
                  onChange={(e) =>
                    setFilterWorkbenchActive(e.target.value as "all" | "yes" | "no")
                  }
                  className="h-9 min-w-[9rem] px-2 rounded-md bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30"
                  title="Workbench: whether the person is active in Workbench (Yes) or removed (No)"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <button
                type="button"
                onClick={clearFilters}
                disabled={filtersAreDefault}
                className="h-9 px-3 rounded-md text-body-sm font-medium border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-dark-border/50 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-500/40"
              >
                Clear filters
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                  <SortableTh
                    label="Name"
                    sortColumn="name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortableTh
                    label="Email"
                    sortColumn="email"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortableTh
                    label="Job title"
                    sortColumn="floatJobTitle"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortableTh
                    label="Tags"
                    sortColumn="tags"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortableTh
                    label="Region ID"
                    sortColumn="floatRegionId"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                    className="whitespace-nowrap"
                  />
                  <SortableTh
                    label="Department"
                    sortColumn="floatDepartmentName"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortableTh
                    label="Float active"
                    sortColumn="floatSchedulingActive"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                    className="whitespace-nowrap"
                  />
                  <SortableTh
                    label="Access"
                    sortColumn="floatAccessLabel"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortableTh
                    label="Workbench"
                    sortColumn="active"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                    className="whitespace-nowrap"
                  />
                  <th className="px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePeople.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100 ${!p.active ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3 text-surface-700 dark:text-surface-200 whitespace-nowrap">{p.name}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{p.email ?? "—"}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{p.floatJobTitle ?? "—"}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300 max-w-[12rem]">
                      {tagsDisplay(p.floatTags)}
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300 align-top">
                      <span className="font-mono tabular-nums">{p.floatRegionId ?? "—"}</span>
                      {p.floatRegionName?.trim() ? (
                        <span className="block text-body-sm text-surface-500 dark:text-surface-400 mt-0.5 max-w-[10rem] truncate" title={p.floatRegionName.trim()}>
                          {p.floatRegionName.trim()}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{p.floatDepartmentName ?? "—"}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300 whitespace-nowrap">
                      {yesNo(p.floatSchedulingActive)}
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300 max-w-[10rem]">
                      {p.floatAccessLabel ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300 whitespace-nowrap">
                      {yesNo(p.active)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
          </div>
          {visiblePeople.length === 0 && (
            <p className="px-4 py-6 text-body-sm text-surface-500 dark:text-surface-400">
              No people match the current filters. Adjust filters or add someone.
            </p>
          )}
        </div>
      </main>

      {showAddPerson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-person-dialog-title"
          aria-describedby="add-person-dialog-desc"
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={() => !addingPerson && closeAddPersonDialog()}
          />
          <div className="relative w-full max-w-md rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl p-5">
            <h3
              id="add-person-dialog-title"
              className="text-title-md font-semibold text-surface-900 dark:text-white"
            >
              Add person
            </h3>
            <p
              id="add-person-dialog-desc"
              className="mt-2 text-body-sm text-surface-600 dark:text-surface-300"
            >
              Enter a name to add someone to the Workbench people list. They can be matched to Float data on the next
              import if the name lines up.
            </p>
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitAddPerson();
              }}
            >
              <label htmlFor="add-person-name" className="sr-only">
                Name
              </label>
              <input
                id="add-person-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                disabled={addingPerson}
                className="w-full h-10 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400 disabled:opacity-50"
                autoFocus
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAddPersonDialog}
                  disabled={addingPerson}
                  className="px-3 py-1.5 rounded-md text-body-sm font-medium text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-dark-raised hover:bg-surface-200 dark:hover:bg-dark-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || addingPerson}
                  className="px-3 py-1.5 rounded-md text-body-sm font-medium text-white bg-jblue-600 hover:bg-jblue-700 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                >
                  {addingPerson ? "Adding…" : "Add person"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
