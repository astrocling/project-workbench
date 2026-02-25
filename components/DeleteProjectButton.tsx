"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
};

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete project "${projectName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete project");
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-body-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={`Delete project ${projectName}`}
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
