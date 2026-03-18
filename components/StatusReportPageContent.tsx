"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { StatusReportView } from "@/components/StatusReportView";
import type { StatusReportPDFData } from "@/components/pdf/StatusReportDocument";
import {
  captureStatusReportToPdf,
  sanitizeForFilename,
} from "@/lib/statusReportPdfCapture";

export function StatusReportPageContent({
  pdfData,
  slug,
  reportId,
  shareView = false,
}: {
  pdfData: StatusReportPDFData;
  slug: string;
  reportId: string;
  shareView?: boolean;
}) {
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const meetingNotesRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = async () => {
    const permalink = `${window.location.origin}/reports/${reportId}`;
    try {
      await navigator.clipboard.writeText(permalink);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setCopyFeedback(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!slideRef.current) return;
    setDownloadError(null);
    setPdfDownloading(true);
    try {
      const safeProjectName = sanitizeForFilename(pdfData.project.name);
      const filename = `Status Report - ${safeProjectName} - ${pdfData.report.reportDate}.pdf`;
      await captureStatusReportToPdf({
        slideElement: slideRef.current,
        meetingNotesElement: meetingNotesRef.current ?? undefined,
        filename,
        exportScale: 1.5,
      });
    } catch {
      setDownloadError("Download failed. Try again.");
    } finally {
      setPdfDownloading(false);
    }
  };

  const toolbar = (
    <div className="flex items-center gap-3 flex-wrap">
      {downloadError && (
        <span className="text-body-sm text-jred-600 dark:text-jred-400">
          {downloadError}
        </span>
      )}
      {!shareView && (
        <span className="text-body-sm text-surface-500 dark:text-surface-400">Share:</span>
      )}
      <button
        type="button"
        onClick={handleCopyLink}
        aria-label="Copy shareable link"
        className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border text-body-sm font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
      >
        {copyFeedback ? "Link copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={handleDownloadPdf}
        disabled={pdfDownloading}
        aria-label="Download PDF"
        className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white text-body-sm font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pdfDownloading ? "Generating PDF…" : "Download PDF"}
      </button>
    </div>
  );

  if (shareView) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
        {/* Minimal bar: back breadcrumb + share actions — no app nav/header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-3">
          <Link
            href={`/projects/${slug}?tab=status-reports`}
            className="text-body-sm font-medium text-jblue-600 hover:text-jblue-700 dark:text-jblue-400"
          >
            ← Back to project
          </Link>
          {toolbar}
        </div>
        <div className="pt-4 pb-8">
          <StatusReportView
            data={pdfData}
            slideRef={slideRef}
            meetingNotesRef={meetingNotesRef}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-3">
        <Link
          href={`/projects/${slug}?tab=status-reports`}
          className="text-body-sm font-medium text-jblue-600 hover:text-jblue-700 dark:text-jblue-400"
        >
          ← Back to project
        </Link>
        {toolbar}
      </div>
      <div className="py-6">
        <StatusReportView
          data={pdfData}
          slideRef={slideRef}
          meetingNotesRef={meetingNotesRef}
        />
      </div>
    </div>
  );
}
