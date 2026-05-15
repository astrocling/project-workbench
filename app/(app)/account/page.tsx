"use client";

import { useEffect, useState } from "react";

type PersonOption = {
  id: string;
  name: string;
  email: string | null;
};

function personOptionLabel(p: PersonOption): string {
  return p.email ? `${p.name} (${p.email})` : p.name;
}

type ProfileResponse = {
  slackUserId: string | null;
  person: PersonOption | null;
  peopleOptions: PersonOption[];
};

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [slackUserId, setSlackUserId] = useState("");
  const [personId, setPersonId] = useState("");
  const [peopleOptions, setPeopleOptions] = useState<PersonOption[]>([]);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    setProfileLoadError("");
    fetch("/api/account/profile")
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as ProfileResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load profile.");
        }
        return data as ProfileResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setSlackUserId(data.slackUserId ?? "");
        setPersonId(data.person?.id ?? "");
        setPeopleOptions(data.peopleOptions ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setProfileLoadError(e instanceof Error ? e.message : "Failed to load profile.");
        }
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess(false);
    setProfileSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slackUserId: slackUserId.trim() || null,
          personId: personId.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ProfileResponse & { error?: string };
      if (!res.ok) {
        setProfileError(data.error ?? "Failed to save profile.");
        return;
      }
      setSlackUserId(data.slackUserId ?? "");
      setPersonId(data.person?.id ?? "");
      setPeopleOptions(data.peopleOptions ?? []);
      setProfileSuccess(true);
    } finally {
      setProfileSaving(false);
    }
  }

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
    <div className="max-w-md space-y-8">
      <div>
        <h2 className="text-display-lg font-bold text-surface-900 dark:text-white mb-2">
          Account
        </h2>
        <p className="text-body-md text-surface-600 dark:text-surface-300">
          Update your Slack ID and Float person link, and change your password below.
        </p>
      </div>

      <section aria-labelledby="profile-heading">
        <h3
          id="profile-heading"
          className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-4"
        >
          Profile
        </h3>
        {profileLoading ? (
          <p className="text-body-sm text-surface-600 dark:text-surface-300">Loading profile…</p>
        ) : profileLoadError ? (
          <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">
            {profileLoadError}
          </p>
        ) : (
          <form
            onSubmit={handleProfileSubmit}
            className="bg-white dark:bg-dark-surface p-6 rounded-xl border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark space-y-4"
          >
            {profileError && (
              <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">
                {profileError}
              </p>
            )}
            {profileSuccess && (
              <p className="text-body-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                Profile saved.
              </p>
            )}
            <div>
              <label
                htmlFor="slackUserId"
                className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100"
              >
                Slack User ID
              </label>
              <input
                id="slackUserId"
                type="text"
                value={slackUserId}
                onChange={(e) => setSlackUserId(e.target.value)}
                placeholder="Leave blank to clear"
                autoComplete="off"
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div>
              <label
                htmlFor="floatPerson"
                className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100"
              >
                Float Person
              </label>
              <p className="mt-1 text-body-sm text-surface-600 dark:text-surface-400 mb-2">
                Link your account to your Float person record for reliable @mentions and key role
                resolution.
              </p>
              <select
                id="floatPerson"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              >
                <option value="">— Not linked —</option>
                {peopleOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personOptionLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 disabled:opacity-60 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              {profileSaving ? "Saving…" : "Save profile"}
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="password-heading">
        <h3
          id="password-heading"
          className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-4"
        >
          Password
        </h3>
        <p className="text-body-md text-surface-600 dark:text-surface-300 mb-4">
          Use at least 6 characters.
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
      </section>
    </div>
  );
}
