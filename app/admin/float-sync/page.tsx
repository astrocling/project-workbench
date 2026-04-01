"use client";

import { useState, useEffect, useCallback } from "react";

type LastRun = {
  id: string;
  completedAt: string;
  unknownRoles: unknown;
  uploadedByUserId?: string | null;
} | null;

function unknownRolesList(run: LastRun): string[] {
  const u = run?.unknownRoles;
  if (Array.isArray(u) && u.every((x) => typeof x === "string")) return u as string[];
  return [];
}

export default function FloatSyncPage() {
  const [lastRun, setLastRun] = useState<LastRun>(null);
  const [loadingRun, setLoadingRun] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshLastRun = useCallback(() => {
    setLoadingRun(true);
    fetch("/api/admin/float-sync")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data && typeof data === "object" && "error" in data) setLastRun(null);
        else setLastRun(data);
      })
      .catch(() => setLastRun(null))
      .finally(() => setLoadingRun(false));
  }, []);

  useEffect(() => {
    refreshLastRun();
  }, [refreshLastRun]);

  async function handleSync() {
    setError("");
    setSuccess("");
    setSyncing(true);
    const res = await fetch("/api/admin/float-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setSyncing(false);

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : "Sync failed";
      const details = typeof data.details === "string" ? data.details : undefined;
      setError(details ? `${msg}: ${details}` : msg);
      return;
    }
    setSuccess("Sync completed successfully.");
    const run = data.run;
    if (run && typeof run === "object" && "completedAt" in run) {
      setLastRun(run as NonNullable<LastRun>);
    } else {
      refreshLastRun();
    }
  }

  const unknown = unknownRolesList(lastRun);

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Float sync</h1>
      </div>

      <main className="p-8 max-w-2xl">
        <div className="space-y-4 bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark">
          <p className="text-body-sm text-surface-700 dark:text-surface-200">
            Pull scheduled allocations from Float using the API. The server uses{" "}
            <code className="text-body-xs bg-surface-100 dark:bg-dark-muted px-1 rounded">FLOAT_API_TOKEN</code>{" "}
            and a default date window (about 12 months before and after today, UTC). Optional{" "}
            <code className="text-body-xs bg-surface-100 dark:bg-dark-muted px-1 rounded">FLOAT_API_USER_AGENT_EMAIL</code>{" "}
            is sent in the User-Agent string.
          </p>
          {error && (
            <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">{error}</p>
          )}
          {success && (
            <p className="text-body-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-md">{success}</p>
          )}
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? "Syncing…" : "Sync from Float"}
          </button>
        </div>

        <div className="mt-6 bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark">
          <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">Last sync</h2>
          {loadingRun ? (
            <p className="text-surface-700 dark:text-surface-200">Loading…</p>
          ) : lastRun ? (
            <div className="text-body-sm text-surface-700 dark:text-surface-200 space-y-1">
              <p>Completed: {new Date(lastRun.completedAt).toLocaleString()}</p>
              {unknown.length > 0 && (
                <p className="text-amber-600 dark:text-amber-400">
                  Unknown roles (add in Roles): {unknown.join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-surface-700 dark:text-surface-200">No sync has been run yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
