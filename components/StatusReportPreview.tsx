"use client";

import { useState, useEffect, useRef } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import { registerStatusReportFonts } from "@/lib/statusReportFonts";
import { StatusReportDocument } from "@/components/pdf/StatusReportDocument";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";

const FONTS_REGISTERED_KEY = "status-report-fonts-registered";

function ensureFontsRegistered(): void {
  if (typeof window === "undefined") return;
  if ((window as unknown as { [FONTS_REGISTERED_KEY]?: boolean })[FONTS_REGISTERED_KEY])
    return;
  registerStatusReportFonts("/fonts");
  (window as unknown as { [FONTS_REGISTERED_KEY]: boolean })[FONTS_REGISTERED_KEY] = true;
}

export function StatusReportPreview({
  projectId,
  reportId,
  onClose,
}: {
  projectId: string;
  reportId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StatusReportPDFData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/projects/${projectId}/status-reports/${reportId}/pdf/data`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Report not found" : "Failed to load");
        return res.json();
      })
      .then((json) => {
        if (mounted.current) {
          setData(json);
          ensureFontsRegistered();
        }
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
  }, [projectId, reportId]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Status report preview"
    >
      <div className="flex flex-1 min-h-0 p-4">
        <div className="flex flex-col flex-1 min-w-0 min-h-0 rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg overflow-hidden">
          <div className="flex items-center justify-between shrink-0 px-4 py-2 border-b border-surface-200 dark:border-dark-border">
            <h2 className="text-title-sm font-semibold text-surface-800 dark:text-surface-100">
              Status report preview
            </h2>
            <div className="flex items-center gap-2">
              <a
                href={`/api/projects/${projectId}/status-reports/${reportId}/pdf?download=1`}
                download
                className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white text-body-sm font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
              >
                Download PDF
              </a>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 text-body-sm font-medium hover:bg-surface-50 dark:hover:bg-dark-bg"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {loading && (
              <div className="flex flex-1 items-center justify-center text-body-sm text-surface-500 dark:text-surface-400">
                Loading…
              </div>
            )}
            {error && (
              <div className="flex flex-1 items-center justify-center p-4">
                <p className="text-body-sm text-jred-600 dark:text-jred-400">{error}</p>
              </div>
            )}
            {data && !loading && (
              <div className="flex-1 min-h-0 w-full">
                <PDFViewer
                  width="100%"
                  height="100%"
                  showToolbar={true}
                  style={{ border: "none", minHeight: "480px" }}
                >
                  <StatusReportDocument data={data} />
                </PDFViewer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
