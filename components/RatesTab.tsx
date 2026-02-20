"use client";

import { useState, useEffect } from "react";

type Role = { id: string; name: string };
type ProjectRoleRate = { roleId: string; role: Role; billRate: number };

export function RatesTab({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [rates, setRates] = useState<ProjectRoleRate[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/rates`).then((r) => r.json()),
      fetch("/api/roles").then((r) => r.json()),
    ]).then(([r, rolesList]) => {
      setRates(r);
      setRoles(rolesList);
    }).finally(() => setLoading(false));
  }, [projectId]);

  const rateByRole = new Map(rates.map((x) => [x.roleId, x]));

  async function saveRate(roleId: string, value: string) {
    if (!canEdit) return;
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    const res = await fetch(`/api/projects/${projectId}/rates`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId, billRate: num }),
    });
    if (res.ok) {
      const r = await res.json();
      setRates((prev) => prev.filter((x) => x.roleId !== roleId).concat(r));
      setEditing((e) => ({ ...e, [roleId]: "" }));
    }
  }

  if (loading) return <p className="text-black">Loading...</p>;

  return (
    <div>
      <table className="w-full text-sm border max-w-xl">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2">Role</th>
            <th className="text-left p-2">Bill Rate ($)</th>
            {canEdit && <th className="p-2" />}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const existing = rateByRole.get(role.id);
            const val = editing[role.id] ?? (existing ? String(existing.billRate) : "");
            return (
              <tr key={role.id} className="border-t">
                <td className="p-2">{role.name}</td>
                <td className="p-2">
                  {canEdit ? (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={val}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, [role.id]: e.target.value }))
                      }
                      onBlur={() => val && saveRate(role.id, val)}
                      className="border rounded px-2 py-1 w-24"
                    />
                  ) : (
                    existing ? existing.billRate : "—"
                  )}
                </td>
                {canEdit && (
                  <td className="p-2">
                    {val && (
                      <button
                        type="button"
                        onClick={() => saveRate(role.id, val)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Save
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
