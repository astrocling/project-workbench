"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type UserRole = "ProjectManager" | "ProgramManager" | "ClientAccountDirector";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  permissions: string;
  role: UserRole | null;
  createdAt: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  ProjectManager: "Project Manager",
  ProgramManager: "Program Manager",
  ClientAccountDirector: "Client Account Director",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [permissions, setPermissions] = useState<"Admin" | "User">("User");
  const [role, setRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", permissions: "User" as "Admin" | "User", role: "" as UserRole | "", password: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (r) => {
        const text = await r.text();
        if (!text) return [];
        try {
          return JSON.parse(text) as User[];
        } catch {
          return [];
        }
      })
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        permissions,
        role: role || undefined,
      }),
    });
    const text = await res.text();
    let data: { error?: string } = {};
    try {
      if (text) data = JSON.parse(text);
    } catch {
      setError(res.ok ? "Invalid response from server" : "Failed to create user");
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Failed to create user");
      return;
    }
    setUsers((prev) => [...prev, data as User]);
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setRole("");
  }

  function openEdit(u: User) {
    setEditingUser(u);
    setEditForm({
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      permissions: u.permissions === "Admin" ? "Admin" : "User",
      role: u.role ?? "",
      password: "",
    });
    setEditError("");
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditSaving(true);
    setEditError("");
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: editForm.firstName || undefined,
        lastName: editForm.lastName || undefined,
        permissions: editForm.permissions,
        role: editForm.role || null,
        password: editForm.password.trim() || undefined,
      }),
    });
    const text = await res.text();
    let data: { error?: string } = {};
    try {
      if (text) data = JSON.parse(text);
    } catch {
      setEditError(res.ok ? "Invalid response" : "Failed to update user");
      setEditSaving(false);
      return;
    }
    if (!res.ok) {
      setEditError(data.error ?? "Failed to update user");
      setEditSaving(false);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? (data as User) : u)));
    setEditingUser(null);
    setEditSaving(false);
  }

  if (loading) return <p className="p-6 text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Users</h1>
      </div>
      <main className="p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark mb-6">
          <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-4">Create user</h2>
          {error && (
            <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md mb-4">{error}</p>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                />
              </div>
              <div>
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Permissions</label>
              <select
                value={permissions}
                onChange={(e) => setPermissions(e.target.value as "Admin" | "User")}
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              >
                <option value="User">User</option>
                <option value="Admin">Super user</option>
              </select>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole | "")}
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              >
                <option value="">—</option>
                {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              Create
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
          <table className="w-full text-body-sm border-collapse">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Name</th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Email</th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Permissions</th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Role</th>
                <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100">
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">{u.email}</td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">{u.permissions === "Admin" ? "Super user" : "User"}</td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-200">
                    {u.role ? ROLE_LABELS[u.role] : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !editSaving && setEditingUser(null)}>
            <div
              className="bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-4">Edit user</h2>
              <p className="text-body-sm text-surface-600 dark:text-surface-300 mb-4">{editingUser.email}</p>
              {editError && (
                <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md mb-4">{editError}</p>
              )}
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">First name</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Last name</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Permissions</label>
                  <select
                    value={editForm.permissions}
                    onChange={(e) => setEditForm((f) => ({ ...f, permissions: e.target.value as "Admin" | "User" }))}
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  >
                    <option value="User">User</option>
                    <option value="Admin">Super user</option>
                  </select>
                </div>
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as UserRole | "" }))}
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  >
                    <option value="">—</option>
                    {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">New password (leave blank to keep)</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    minLength={6}
                    placeholder="Optional"
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => !editSaving && setEditingUser(null)}
                    className="h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted text-body-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-dark-raised"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 disabled:opacity-50 text-white font-semibold text-body-sm"
                  >
                    {editSaving ? "Saving…" : "Save"}
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
