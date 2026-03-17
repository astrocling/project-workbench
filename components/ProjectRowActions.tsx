"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";

type ProjectRowActionsProps = {
  projectId: string;
  slug: string;
  projectName: string;
  canEdit: boolean;
  canDelete: boolean;
};

const iconClass =
  "p-1.5 rounded-md text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-dark-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none";

export function ProjectRowActions({
  projectId,
  slug,
  projectName,
  canEdit,
  canDelete,
}: ProjectRowActionsProps) {
  const router = useRouter();
  const [backfilling, setBackfilling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBackfillConfirm, setShowBackfillConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const closeDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false);
    setDeleteConfirmInput("");
  }, []);

  const closeBackfillConfirm = useCallback(() => setShowBackfillConfirm(false), []);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeDeleteConfirm();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showDeleteConfirm, closeDeleteConfirm]);

  useEffect(() => {
    if (!showBackfillConfirm) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeBackfillConfirm();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showBackfillConfirm, closeBackfillConfirm]);

  async function runBackfill() {
    setBackfilling(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/backfill-float`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? data.detail ?? "Backfill failed");
        return;
      }
      closeBackfillConfirm();
      router.refresh();
    } finally {
      setBackfilling(false);
    }
  }

  function openDeleteConfirm() {
    setDeleteConfirmInput("");
    setShowDeleteConfirm(true);
  }

  async function submitDelete() {
    if (deleteConfirmInput.trim() !== projectName) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete project");
        return;
      }
      closeDeleteConfirm();
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const deleteConfirmMatches = deleteConfirmInput.trim() === projectName;

  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex items-center gap-0.5">
      {canEdit && (
        <>
          <Link
            href={`/projects/${slug}/edit`}
            className={iconClass}
            aria-label={`Edit ${projectName}`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setShowBackfillConfirm(true)}
            disabled={backfilling}
            className={iconClass}
            aria-label={`Backfill float data for ${projectName}`}
            title="Backfill float data"
          >
            <RefreshCw
              className={`h-4 w-4 ${backfilling ? "animate-spin" : ""}`}
              aria-hidden
            />
          </button>
        </>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={openDeleteConfirm}
          disabled={deleting}
          className={`${iconClass} hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30`}
          aria-label={`Delete ${projectName}`}
          title="Delete project"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}

      {showBackfillConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="backfill-dialog-title"
          aria-describedby="backfill-dialog-desc"
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={closeBackfillConfirm}
          />
          <div className="relative w-full max-w-md rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl p-5">
            <h3 id="backfill-dialog-title" className="text-title-md font-semibold text-surface-900 dark:text-white">
              Backfill float data
            </h3>
            <p id="backfill-dialog-desc" className="mt-2 text-body-sm text-surface-600 dark:text-surface-300">
              This will update <strong className="text-surface-900 dark:text-white">{projectName}</strong>’s
              scheduled hours from Float import data. Existing float hours for this project may be overwritten.
            </p>
            <p className="mt-3 text-body-sm text-surface-500 dark:text-surface-400 italic">
              This isn’t a common action. If you aren’t doing this on purpose (e.g. the project was created after an
              import), it’s best to cancel.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBackfillConfirm}
                disabled={backfilling}
                className="px-3 py-1.5 rounded-md text-body-sm font-medium text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-dark-raised hover:bg-surface-200 dark:hover:bg-dark-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runBackfill}
                disabled={backfilling}
                className="px-3 py-1.5 rounded-md text-body-sm font-medium text-white bg-jblue-600 hover:bg-jblue-700 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                {backfilling ? "Backfilling…" : "Run backfill"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={closeDeleteConfirm}
          />
          <div className="relative w-full max-w-md rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl p-5">
            <h3 id="delete-dialog-title" className="text-title-md font-semibold text-surface-900 dark:text-white">
              Delete project
            </h3>
            <p id="delete-dialog-desc" className="mt-2 text-body-sm text-surface-600 dark:text-surface-300">
              This will permanently delete <strong className="text-surface-900 dark:text-white">{projectName}</strong> and
              all its data (assignments, budget, status reports, etc.). This cannot be undone.
            </p>
            <p className="mt-3 text-body-sm text-surface-600 dark:text-surface-300">
              Type the project name to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder={projectName}
              className="mt-1.5 w-full rounded-md border border-surface-300 dark:border-dark-border bg-white dark:bg-dark-raised px-3 py-2 text-body-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-400 focus:border-transparent"
              aria-label="Type project name to confirm deletion"
              autoComplete="off"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="px-3 py-1.5 rounded-md text-body-sm font-medium text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-dark-raised hover:bg-surface-200 dark:hover:bg-dark-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDelete}
                disabled={!deleteConfirmMatches || deleting}
                className="px-3 py-1.5 rounded-md text-body-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
