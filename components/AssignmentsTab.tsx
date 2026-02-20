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
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/assignments`).then((r) => r.json()),
      fetch("/api/people").then((r) => r.json()),
      fetch("/api/roles").then((r) => r.json()),
    ]).then(([a, p, r]) => {
      setAssignments(a);
      setPeople(p);
      setRoles(r);
      if (r.length) setSelectedRole(r[0].id);
    }).finally(() => setLoading(false));
  }, [projectId]);

  async function addAssignment() {
    if (!selectedPerson || !selectedRole || !canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: selectedPerson, roleId: selectedRole }),
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
    }
  }

  const availablePeople = people.filter(
    (p) => !assignments.some((a) => a.personId === p.id)
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
          <div>
            <label className="block text-sm text-black">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="mt-1 border rounded px-2 py-1"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
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
          {assignments.map((a) => (
            <tr key={a.personId} className="border-t">
              <td className="p-2">{a.person.name}</td>
              <td className="p-2">{a.role.name}</td>
              <td className="p-2">{a.billRateOverride ?? "—"}</td>
              {canEdit && (
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => removeAssignment(a.personId)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {assignments.length === 0 && (
        <p className="text-black">No assignments. Add people to the project.</p>
      )}
    </div>
  );
}
