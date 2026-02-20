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
        <h1 className="text-xl font-semibold">Float Import</h1>
      </div>

      <main className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded border">
          <p className="text-sm text-black">
            Upload a Float CSV export. Expected columns: person name, role, project, and weekly date columns (e.g. 2025-02-17).
          </p>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 p-2 rounded">{success}</p>
          )}
          <div>
            <input type="file" accept=".csv" className="block" />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Importing…" : "Upload CSV"}
          </button>
        </form>

        <div className="mt-6 bg-white p-6 rounded border">
          <h2 className="font-medium mb-2">Last import</h2>
          {lastRun ? (
            <div className="text-sm text-black space-y-1">
              <p>Completed: {new Date(lastRun.completedAt).toLocaleString()}</p>
              {(lastRun.unknownRoles as string[])?.length > 0 && (
                <p className="text-amber-700">
                  Unknown roles (add in Roles): {(lastRun.unknownRoles as string[]).join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-black">No import has been run yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
