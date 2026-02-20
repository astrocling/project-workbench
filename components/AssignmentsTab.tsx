"use client";

import { useState, useEffect } from "react";

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
    Promise.all([
      fetch(`/api/projects/${projectId}/assignments`).then((r) => r.json()),
      fetch("/api/people").then((r) => r.json()),
      fetch("/api/roles").then((r) => r.json()),
    ]).then(([a, p, r]) => {
      setAssignments(a);
      setPeople(p);
      setRoles(r);
    }).finally(() => setLoading(false));
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

  if (loading) return <p className="text-black">Loading...</p>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-sm text-black">Person</label>
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="mt-1 border rounded px-2 py-1"
            >
              <option value="">Select...</option>
              {availablePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addAssignment}
            disabled={!selectedPerson}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2">Person</th>
            <th className="text-left p-2">Role</th>
            <th className="text-left p-2">Rate Override</th>
            {canEdit && <th className="p-2" />}
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => {
            const isEditing = canEdit && editingPersonId === a.personId;
            return (
              <tr key={a.personId} className="border-t">
                <td className="p-2">{a.person.name}</td>
                <td className="p-2">
                  {isEditing ? (
                    <select
                      value={editRoleId}
                      onChange={(e) => setEditRoleId(e.target.value)}
                      className="border rounded px-2 py-1 w-full max-w-[180px]"
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
                <td className="p-2">
                  {isEditing ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editRateOverride}
                      onChange={(e) => setEditRateOverride(e.target.value)}
                      placeholder="—"
                      className="border rounded px-2 py-1 w-24"
                    />
                  ) : (
                    a.billRateOverride ?? "—"
                  )}
                </td>
                {canEdit && (
                  <td className="p-2 space-x-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(a.personId)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-gray-600 hover:underline text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAssignment(a.personId)}
                          className="text-red-600 hover:underline text-sm"
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
      {assignments.length === 0 && (
        <p className="text-black">No assignments. Add people to the project.</p>
      )}
    </div>
  );
}
