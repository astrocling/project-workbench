"use client";

import { useState, useEffect } from "react";
import { PersonCombobox } from "@/components/PersonCombobox";

type Person = { id: string; name: string; email?: string | null };
type Role = { id: string; name: string };
type Assignment = {
  personId: string;
  person: Person;
  role: Role;
  billRateOverride: number | null;
};

export function AssignmentsTab({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editRoleId, setEditRoleId] = useState("");
  const [editRateOverride, setEditRateOverride] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const [assignmentsRes, peopleRes, rolesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/assignments`),
          fetch("/api/people"),
          fetch("/api/roles"),
        ]);
        const parseJson = async (res: Response, fallback: unknown) => {
          const text = await res.text();
          if (!text) return fallback;
          try {
            return JSON.parse(text);
          } catch {
            return fallback;
          }
        };
        const [a, p, r] = await Promise.all([
          parseJson(assignmentsRes, []),
          parseJson(peopleRes, []),
          parseJson(rolesRes, []),
        ]);
        setAssignments(Array.isArray(a) ? a : []);
        setPeople(Array.isArray(p) ? p : []);
        setRoles(Array.isArray(r) ? r : []);
      } catch {
        setAssignments([]);
        setPeople([]);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  async function addAssignment() {
    if (!selectedPerson || !canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: selectedPerson }),
    });
    if (res.ok) {
      const a = await res.json();
      setAssignments((prev) => [...prev, a]);
      setSelectedPerson("");
    }
  }

  async function removeAssignment(personId: string) {
    if (!canEdit) return;
    const res = await fetch(
      `/api/projects/${projectId}/assignments?personId=${personId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setAssignments((prev) => prev.filter((x) => x.personId !== personId));
      if (editingPersonId === personId) setEditingPersonId(null);
    }
  }

  function startEdit(a: Assignment) {
    setEditingPersonId(a.personId);
    setEditRoleId(a.role.id);
    setEditRateOverride(a.billRateOverride != null ? String(a.billRateOverride) : "");
  }

  function cancelEdit() {
    setEditingPersonId(null);
  }

  async function saveEdit(personId: string) {
    if (!canEdit) return;
    const rateVal = editRateOverride.trim();
    const billRateOverride =
      rateVal === "" ? null : (parseFloat(rateVal) || null);
    const res = await fetch(`/api/projects/${projectId}/assignments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        roleId: editRoleId,
        billRateOverride,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAssignments((prev) =>
        prev.map((x) => (x.personId === personId ? updated : x))
      );
      setEditingPersonId(null);
    }
  }

  const availablePeople = people.filter(
    (p) =>
      p.name.toLowerCase() !== "name" &&
      !assignments.some((a) => a.personId === p.id)
  );

  if (loading) return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex gap-2 items-end flex-wrap">
          <div className="min-w-[200px]">
            <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Person</label>
            <PersonCombobox
              value={selectedPerson}
              onChange={setSelectedPerson}
              options={availablePeople}
              placeholder="Type to search..."
              aria-label="Select person to add"
            />
          </div>
          <button
            type="button"
            onClick={addAssignment}
            disabled={!selectedPerson}
            className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      )}
      <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
        <table className="w-full text-body-sm border-collapse">
          <thead>
            <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
              <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Person</th>
              <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Role</th>
              <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Rate Override</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
        <tbody>
          {assignments.map((a) => {
            const isEditing = canEdit && editingPersonId === a.personId;
            return (
              <tr key={a.personId} className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100">
                <td className="px-4 py-3 font-medium text-surface-800 dark:text-white">{a.person.name}</td>
                <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                  {isEditing ? (
                    <select
                      value={editRoleId}
                      onChange={(e) => setEditRoleId(e.target.value)}
                      className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-full max-w-[180px] focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    a.role.name
                  )}
                </td>
                <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                  {isEditing ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editRateOverride}
                      onChange={(e) => setEditRateOverride(e.target.value)}
                      placeholder="—"
                      className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-24 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                    />
                  ) : (
                    a.billRateOverride ?? "—"
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 space-x-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(a.personId)}
                          className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-body-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAssignment(a.personId)}
                          className="text-body-sm text-jred-700 dark:text-jred-400 hover:text-jred-800 font-medium"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
      {assignments.length === 0 && (
        <p className="text-body-sm text-surface-700 dark:text-surface-200">No assignments. Add people to the project.</p>
      )}
    </div>
  );
}
