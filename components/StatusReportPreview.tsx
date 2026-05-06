"use client";

import { useState, useEffect, useRef } from "react";
import { StatusReportView } from "@/components/StatusReportView";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";
import {
  captureStatusReportToPdf,
  sanitizeForFilename,
} from "@/lib/statusReportPdfCapture";

export function StatusReportPreview({
  projectId,
  projectSlug,
  reportId,
  onClose,
  /** Increment to refetch PDF data (e.g. after timeline snapshot refresh). */
  dataRefreshKey = 0,
}: {
  projectId: string;
  /** Slug or id for PDF download URL (API accepts both). */
  projectSlug: string;
  reportId: string;
  onClose: () => void;
  dataRefreshKey?: number;
}) {
  const [data, setData] = useState<StatusReportPDFData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const mounted = useRef(true);
  const slideRef = useRef<HTMLDivElement>(null);
  const meetingNotesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/projects/${projectSlug}/status-reports/${reportId}/pdf/data`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Report not found" : "Failed to load");
        return res.json();
      })
      .then((json) => {
        if (mounted.current) setData(json);
      })
      .catch((err) => {
        if (mounted.current) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    return () => {
      mounted.current = false;
    };
  }, [projectSlug, reportId, dataRefreshKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Status Report Preview"
    >
      <div className="flex flex-1 min-h-0 p-4">
        <div className="flex flex-col flex-1 min-w-0 min-h-0 rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg overflow-hidden">
          <div className="flex items-center justify-between shrink-0 px-4 py-2 border-b border-surface-200 dark:border-dark-border">
            <h2 className="text-title-sm font-semibold text-surface-800 dark:text-surface-100">
              Status Report Preview
            </h2>
            <div className="flex flex-col items-end gap-1">
              {pdfError && (
                <p className="text-body-sm text-jred-600 dark:text-jred-400">
                  {pdfError}
                  {" "}
                  <a
                    href={`/api/projects/${projectSlug}/status-reports/${reportId}/pdf?download=1`}
                    download
                    className="font-medium text-jblue-600 hover:text-jblue-700 dark:text-jblue-400 underline"
                  >
                    Download PDF (server)
                  </a>
                </p>
              )}
              <div className="flex items-center gap-2">
              <a
                href={`/reports/${reportId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 text-body-sm font-medium hover:bg-surface-50 dark:hover:bg-dark-bg focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
              >
                Open in new tab
              </a>
              <button
                type="button"
                onClick={async () => {
                  if (!slideRef.current || !data) return;
                  setPdfDownloading(true);
                  setPdfError(null);
                  try {
                    const safeProjectName = sanitizeForFilename(data.project.name);
                    const filename = `Status Report - ${safeProjectName} - ${data.report.reportDate}.pdf`;
                    await captureStatusReportToPdf({
                      slideElement: slideRef.current,
                      meetingNotesElement: meetingNotesRef.current ?? undefined,
                      filename,
                      exportScale: 1.5,
                    });
                  } catch (err) {
                    if (process.env.NODE_ENV === "development") {
                      console.error("Status report PDF capture failed:", err);
                    }
                    setPdfError("Download failed. Try again or use the server PDF.");
                  } finally {
                    if (mounted.current) setPdfDownloading(false);
                  }
                }}
                disabled={!data || pdfDownloading}
                aria-label="Download PDF"
                className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white text-body-sm font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none"
              >
                {pdfDownloading ? "Generating PDF…" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 text-body-sm font-medium hover:bg-surface-50 dark:hover:bg-dark-bg"
              >
                Close
              </button>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {loading && (
              <div className="flex flex-1 items-center justify-center py-12 text-body-sm text-surface-500 dark:text-surface-400">
                Loading…
              </div>
            )}
            {error && (
              <div className="flex flex-1 items-center justify-center p-4">
                <p className="text-body-sm text-jred-600 dark:text-jred-400">{error}</p>
              </div>
            )}
            {data && !loading && (
              <StatusReportView
                data={data}
                slideRef={slideRef}
                meetingNotesRef={meetingNotesRef}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
