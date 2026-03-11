"use client";

import { useState } from "react";

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to change password.");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-display-lg font-bold text-surface-900 dark:text-white mb-2">
        Account
      </h2>
      <p className="text-body-md text-surface-600 dark:text-surface-300 mb-6">
        Change your password. Use at least 6 characters.
      </p>
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-dark-surface p-6 rounded-xl border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark space-y-4"
      >
        {error && (
          <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">
            {error}
          </p>
        )}
        {success && (
          <p className="text-body-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            Password updated successfully.
          </p>
        )}
        <div>
          <label
            htmlFor="currentPassword"
            className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100"
          >
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
        </div>
        <div>
          <label
            htmlFor="newPassword"
            className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100"
          >
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100"
          >
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 disabled:opacity-60 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
        >
          {submitting ? "Updating…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
