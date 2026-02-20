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

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-xl font-semibold">Roles</h1>
      </div>
      <main className="p-6 max-w-2xl">
        {unknownRoles.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded p-4">
            <p className="font-medium text-amber-800">Unknown roles from last Float import</p>
            <p className="text-sm text-amber-700 mt-1">
              Add these to the role catalog:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {unknownRoles.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addRole(name)}
                  className="bg-amber-600 text-white px-3 py-1 rounded text-sm hover:bg-amber-700"
                >
                  Add &quot;{name}&quot;
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded border overflow-hidden">
          <div className="p-4 border-b flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New role name"
              className="border rounded px-3 py-2 flex-1"
            />
            <button
              type="button"
              onClick={() => newName && addRole(newName)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
