"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function FloatImportPage() {
  const [lastRun, setLastRun] = useState<{
    id: string;
    completedAt: string;
    unknownRoles: string[];
    uploadedByUserId?: string | null;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/admin/float-import")
      .then((r) => r.json())
      .then(setLastRun)
      .catch(() => setLastRun(null));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("Select a CSV file");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/float-import", {
      method: "POST",
      body: formData,
    });
    setUploading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error ?? "Upload failed";
      setError(data.details ? `${msg}: ${data.details}` : msg);
      return;
    }
    setSuccess("Import completed successfully.");
    setLastRun(data.run ?? lastRun);
  }

  return (
    <>
      <div className="px-6 pt-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Float Import</h1>
      </div>

      <main className="p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark">
          <p className="text-body-sm text-surface-700 dark:text-surface-200">
            Upload a Float CSV export. Expected columns: person name, role, project, and weekly date columns (e.g. 2025-02-17).
          </p>
          {error && (
            <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">{error}</p>
          )}
          {success && (
            <p className="text-body-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-md">{success}</p>
          )}
          <div>
            <input type="file" accept=".csv" className="block" />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Importing…" : "Upload CSV"}
          </button>
        </form>

        <div className="mt-6 bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark">
          <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">Last import</h2>
          {lastRun ? (
            <div className="text-body-sm text-surface-700 dark:text-surface-200 space-y-1">
              <p>Completed: {new Date(lastRun.completedAt).toLocaleString()}</p>
              {(lastRun.unknownRoles as string[])?.length > 0 && (
                <p className="text-amber-600 dark:text-amber-400">
                  Unknown roles (add in Roles): {(lastRun.unknownRoles as string[]).join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-surface-700 dark:text-surface-200">No import has been run yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
