"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type User = { id: string; email: string; role: string; createdAt: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Admin" | "Editor" | "Viewer">("Editor");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create user");
      return;
    }
    setUsers((prev) => [...prev, data]);
    setEmail("");
    setPassword("");
  }

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-xl font-semibold">Users</h1>
      </div>
      <main className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded border mb-6">
          <h2 className="font-medium mb-4">Create user</h2>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded mb-4">{error}</p>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "Admin" | "Editor" | "Viewer")}
                className="mt-1 block w-full border rounded px-3 py-2"
              >
                <option value="Admin">Admin</option>
                <option value="Editor">Editor</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>

        <div className="bg-white rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
