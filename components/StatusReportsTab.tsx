"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BRAND_COLORS } from "@/lib/brandColors";

type StatusReportRecord = {
  id: string;
  reportDate: string;
  variation: string;
  completedActivities: string;
  upcomingActivities: string;
  risksIssuesDecisions: string;
  meetingNotes: string | null;
};

function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

function formatHours(hours: number): string {
  return roundToQuarter(hours).toFixed(2).replace(/\.?0+$/, "");
}

function formatDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Two decimals for status report copy (e.g. -8.00, 224.00). */
function formatReportNumber(n: number): string {
  return n.toFixed(2);
}

function BudgetBurnCircleChart({ burnPercent }: { burnPercent: number | null }) {
  const size = 160;
  const r = 56;
  const stroke = 24;
  const circumference = 2 * Math.PI * r;
  const clamped = burnPercent == null ? 0 : Math.min(100, Math.max(0, burnPercent));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#E2E5EC"
            strokeWidth={stroke}
          />
          {clamped > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#1941FA"
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-title-lg font-semibold text-surface-900 dark:text-white tabular-nums"
          aria-live="polite"
        >
          {burnPercent != null ? `${burnPercent.toFixed(1)}%` : "—"}
        </div>
      </div>
      <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider">
        % Budget used (high est.)
      </p>
    </div>
  );
}

type BudgetLine = {
  id: string;
  type: string;
  label: string;
  lowHours: number;
  highHours: number;
  lowDollars: number;
  highDollars: number;
};

type Rollups = {
  actualHoursToDate: number;
  actualDollarsToDate: number;
  burnPercentHighDollars: number | null;
  remainingHoursLow: number;
  remainingHoursHigh: number;
  remainingDollarsLow: number;
  remainingDollarsHigh: number;
};

const VARIATIONS = [
  { value: "CDA", label: "CDA (Monthly/Project CDA Budgets)" },
  { value: "Standard", label: "Standard (Timeline/Project Budget)" },
  { value: "Milestones", label: "Milestones (Fixed Fee No Budget)" },
] as const;

export function StatusReportsTab({
  projectId,
  projectSlug,
  canEdit,
  cdaEnabled = false,
}: {
  projectId: string;
  projectSlug: string;
  canEdit: boolean;
  cdaEnabled?: boolean;
}) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [rollups, setRollups] = useState<Rollups | null>(null);
  const [lastWeekWithActuals, setLastWeekWithActuals] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyChartFeedback, setCopyChartFeedback] = useState<string | null>(null);

  const [reports, setReports] = useState<StatusReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [formReportDate, setFormReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formVariation, setFormVariation] = useState<"Standard" | "Milestones" | "CDA">("Standard");
  const [formCompleted, setFormCompleted] = useState("");
  const [formUpcoming, setFormUpcoming] = useState("");
  const [formRisks, setFormRisks] = useState("");
  const [formMeetingNotes, setFormMeetingNotes] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/budget`)
      .then((r) => r.json())
      .then((d) => {
        setBudgetLines(d.budgetLines ?? []);
        setRollups(d.rollups ?? null);
        setLastWeekWithActuals(d.lastWeekWithActuals ?? null);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadReports = useCallback(() => {
    setReportsLoading(true);
    fetch(`/api/projects/${projectId}/status-reports`)
      .then((r) => r.json())
      .then((list) => setReports(Array.isArray(list) ? list : []))
      .catch(() => setReports([]))
      .finally(() => setReportsLoading(false));
  }, [projectId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const prefillFromPrevious = useCallback(() => {
    fetch(`/api/projects/${projectId}/status-reports?previousFor=${formReportDate}`)
      .then((r) => r.json())
      .then((prev) => {
        if (prev && typeof prev.completedActivities === "string") {
          setFormCompleted(prev.completedActivities);
          setFormUpcoming(prev.upcomingActivities ?? "");
          setFormRisks(prev.risksIssuesDecisions ?? "");
        }
      })
      .catch(() => {});
  }, [projectId, formReportDate]);

  const openNewForm = useCallback(() => {
    setEditingReportId(null);
    setFormReportDate(new Date().toISOString().slice(0, 10));
    setFormVariation(cdaEnabled ? "CDA" : "Standard");
    setFormCompleted("");
    setFormUpcoming("");
    setFormRisks("");
    setFormMeetingNotes("");
    setFormError(null);
    setSavedReportId(null);
    setShowForm(true);
  }, [cdaEnabled]);

  const openEditForm = useCallback((r: StatusReportRecord) => {
    setEditingReportId(r.id);
    setFormReportDate(r.reportDate.slice(0, 10));
    setFormVariation((r.variation as "Standard" | "Milestones" | "CDA") || "Standard");
    setFormCompleted(r.completedActivities ?? "");
    setFormUpcoming(r.upcomingActivities ?? "");
    setFormRisks(r.risksIssuesDecisions ?? "");
    setFormMeetingNotes(r.meetingNotes ?? "");
    setFormError(null);
    setSavedReportId(r.id);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingReportId(null);
    setSavedReportId(null);
    loadReports();
  }, [loadReports]);

  const submitForm = useCallback(async () => {
    setFormError(null);
    setFormSaving(true);
    const payload = {
      reportDate: formReportDate,
      variation: formVariation,
      completedActivities: formCompleted,
      upcomingActivities: formUpcoming,
      risksIssuesDecisions: formRisks,
      meetingNotes: formMeetingNotes.trim() || null,
    };
    const url = editingReportId
      ? `/api/projects/${projectId}/status-reports/${editingReportId}`
      : `/api/projects/${projectId}/status-reports`;
    const method = editingReportId ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Save failed");
        return;
      }
      setSavedReportId(data.id ?? editingReportId);
      if (!editingReportId) loadReports();
    } finally {
      setFormSaving(false);
    }
  }, [projectId, editingReportId, formReportDate, formVariation, formCompleted, formUpcoming, formRisks, formMeetingNotes, loadReports]);

  const estBudgetLow = budgetLines.reduce((s, bl) => s + Number(bl.lowDollars), 0);
  const estBudgetHigh = budgetLines.reduce((s, bl) => s + Number(bl.highDollars), 0);
  const budgetedHoursLow = budgetLines.reduce((s, bl) => s + Number(bl.lowHours), 0);
  const budgetedHoursHigh = budgetLines.reduce((s, bl) => s + Number(bl.highHours), 0);

  const spentDollars = rollups?.actualDollarsToDate ?? 0;
  const actualHours = rollups?.actualHoursToDate ?? 0;
  const remainingDollarsLow = rollups?.remainingDollarsLow ?? estBudgetLow - spentDollars;
  const remainingDollarsHigh = rollups?.remainingDollarsHigh ?? estBudgetHigh - spentDollars;
  const remainingHoursLow = rollups?.remainingHoursLow ?? budgetedHoursLow - actualHours;
  const remainingHoursHigh = rollups?.remainingHoursHigh ?? budgetedHoursHigh - actualHours;
  const burnPercentHigh = rollups?.burnPercentHighDollars ?? null;

  /** Format $ Spent / Actual Hrs as negative for copy and display. */
  const spentDollarsDisplay = -spentDollars;
  const actualHoursDisplay = -actualHours;

  /** Build SVG string for donut chart (for PNG export). Shows only the percent in center, no label. */
  const buildDonutChartSVG = useCallback((percent: number | null, size: number = 200) => {
    const r = size * 0.35;
    const stroke = size * 0.15;
    const circumference = 2 * Math.PI * r;
    const clamped = percent == null ? 0 : Math.min(100, Math.max(0, percent));
    const dash = (clamped / 100) * circumference;
    const cx = size / 2;
    const cy = size / 2;
    const grayCircle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e5ec" stroke-width="${stroke}"/>`;
    const blueArc =
      clamped > 0
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1941FA" stroke-width="${stroke}" stroke-dasharray="${dash} ${circumference}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>`
        : "";
    const percentText = percent != null ? `${percent.toFixed(0)}%` : "—";
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<g transform="translate(0,0)">` +
      grayCircle +
      blueArc +
      `</g>` +
      `<text x="${size / 2}" y="${size / 2 + 6}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="24" font-weight="600" fill="#0f1623">${percentText}</text>` +
      `</svg>`
    );
  }, []);

  const copyChartAsPng = useCallback(
    async (percent: number | null) => {
      if (typeof navigator?.clipboard?.write !== "function") {
        setCopyChartFeedback("Clipboard not available");
        setTimeout(() => setCopyChartFeedback(null), 2500);
        return;
      }
      const svgString = buildDonutChartSVG(percent);
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const cleanup = () => URL.revokeObjectURL(url);
      img.onerror = () => {
        cleanup();
        setCopyChartFeedback("Copy failed");
        setTimeout(() => setCopyChartFeedback(null), 2500);
      };
      img.onload = () => {
        const width = 200;
        const height = 200;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          setCopyChartFeedback("Copy failed");
          setTimeout(() => setCopyChartFeedback(null), 2500);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, width);
        canvas.toBlob(
          (pngBlob) => {
            cleanup();
            if (!pngBlob) {
              setCopyChartFeedback("Copy failed");
              setTimeout(() => setCopyChartFeedback(null), 2500);
              return;
            }
            navigator.clipboard
              .write([new ClipboardItem({ "image/png": pngBlob })])
              .then(() => {
                setCopyChartFeedback("Chart copied to clipboard");
                setTimeout(() => setCopyChartFeedback(null), 2500);
              })
              .catch(() => {
                setCopyChartFeedback("Copy failed");
                setTimeout(() => setCopyChartFeedback(null), 2500);
              });
          },
          "image/png"
        );
      };
      img.src = url;
    },
    [buildDonutChartSVG]
  );

  const copyTable = useCallback(async () => {
    if (typeof navigator?.clipboard?.write !== "function") {
      setCopyFeedback("Clipboard not available");
      setTimeout(() => setCopyFeedback(null), 2500);
      return;
    }
    const { header, accent, overallBudget, onHeader, onAccent, onWhite } = BRAND_COLORS;
    const headerStyle =
      `background-color:${header};color:${onHeader};padding:6px 10px;text-align:left;font-weight:600;font-size:12px;border:1px solid #e5e7eb;`;
    const labelCellStyle =
      `background-color:#ffffff;color:${onWhite};padding:6px 10px;text-align:left;font-weight:600;font-size:12px;border:1px solid #e5e7eb;`;
    const cellWhiteStyle =
      `background-color:#ffffff;color:${onWhite};padding:6px 10px;text-align:right;font-size:12px;border:1px solid #e5e7eb;`;
    const cellGreenStyle =
      `background-color:${overallBudget};color:${onHeader};padding:6px 10px;text-align:right;font-size:12px;border:1px solid #e5e7eb;`;
    const cellBlueStyle =
      `background-color:${accent};color:${onAccent};padding:6px 10px;text-align:right;font-size:12px;border:1px solid #e5e7eb;`;

    const spentStr = `-$${formatReportNumber(spentDollars)}`;
    const actualHrsStr = formatReportNumber(actualHoursDisplay);

    const highRow =
      `<tr>` +
      `<td style="${labelCellStyle}">HIGH</td>` +
      `<td style="${cellGreenStyle}">$${formatReportNumber(estBudgetHigh)}</td>` +
      `<td style="${cellWhiteStyle}">${spentStr}</td>` +
      `<td style="${cellGreenStyle}">$${formatReportNumber(remainingDollarsHigh)}</td>` +
      `<td style="${cellBlueStyle}">${formatReportNumber(budgetedHoursHigh)}</td>` +
      `<td style="${cellWhiteStyle}">${actualHrsStr}</td>` +
      `<td style="${cellBlueStyle}">${formatReportNumber(remainingHoursHigh)}</td>` +
      `</tr>`;
    const lowRow =
      `<tr>` +
      `<td style="${labelCellStyle}">LOW</td>` +
      `<td style="${cellGreenStyle}">$${formatReportNumber(estBudgetLow)}</td>` +
      `<td style="${cellWhiteStyle}">${spentStr}</td>` +
      `<td style="${cellGreenStyle}">$${formatReportNumber(remainingDollarsLow)}</td>` +
      `<td style="${cellBlueStyle}">${formatReportNumber(budgetedHoursLow)}</td>` +
      `<td style="${cellWhiteStyle}">${actualHrsStr}</td>` +
      `<td style="${cellBlueStyle}">${formatReportNumber(remainingHoursLow)}</td>` +
      `</tr>`;

    const html =
      `<table style="border-collapse:collapse;font-family:sans-serif;min-width:480px;">` +
      `<thead><tr>` +
      `<th style="${headerStyle}"></th>` +
      `<th style="${headerStyle}">Est. Budget</th>` +
      `<th style="${headerStyle}">$ Spent</th>` +
      `<th style="${headerStyle}">$ Remaining</th>` +
      `<th style="${headerStyle}">Budgeted Hrs</th>` +
      `<th style="${headerStyle}">Actual Hrs</th>` +
      `<th style="${headerStyle}">Hrs Remaining</th>` +
      `</tr></thead><tbody>${highRow}${lowRow}</tbody></table>`;

    const plain = [
      "\tEst. Budget\t$ Spent\t$ Remaining\tBudgeted Hrs\tActual Hrs\tHrs Remaining",
      `HIGH\t$${formatReportNumber(estBudgetHigh)}\t${spentStr}\t$${formatReportNumber(remainingDollarsHigh)}\t${formatReportNumber(budgetedHoursHigh)}\t${actualHrsStr}\t${formatReportNumber(remainingHoursHigh)}`,
      `LOW\t$${formatReportNumber(estBudgetLow)}\t${spentStr}\t$${formatReportNumber(remainingDollarsLow)}\t${formatReportNumber(budgetedHoursLow)}\t${actualHrsStr}\t${formatReportNumber(remainingHoursLow)}`,
    ].join("\n");

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      setCopyFeedback("Copied to clipboard");
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setCopyFeedback("Copy failed");
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  }, [
    estBudgetLow,
    estBudgetHigh,
    spentDollars,
    remainingDollarsLow,
    remainingDollarsHigh,
    budgetedHoursLow,
    budgetedHoursHigh,
    actualHours,
    remainingHoursLow,
    remainingHoursHigh,
  ]);

  function periodDisplay(): string {
    if (!lastWeekWithActuals) return "—";
    const mon = new Date(lastWeekWithActuals + "T00:00:00");
    const fri = new Date(mon);
    fri.setDate(fri.getDate() + 4);
    return `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${fri.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  if (loading) {
    return (
      <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>
    );
  }

  const hasData = budgetLines.length > 0;
  const headerStyle = {
    backgroundColor: BRAND_COLORS.header,
    color: BRAND_COLORS.onHeader,
    padding: "6px 10px",
    textAlign: "left" as const,
    fontWeight: 600,
    fontSize: "12px",
    border: "1px solid #e5e7eb",
  };
  const labelCellStyle = {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    padding: "6px 10px",
    textAlign: "left" as const,
    fontWeight: 600,
    fontSize: "12px",
    border: "1px solid #e5e7eb",
  };
  const cellWhiteStyle = {
    backgroundColor: "#ffffff",
    color: BRAND_COLORS.onWhite,
    padding: "6px 10px",
    textAlign: "right" as const,
    fontSize: "12px",
    border: "1px solid #e5e7eb",
  };
  const cellGreenStyle = {
    backgroundColor: BRAND_COLORS.overallBudget,
    color: BRAND_COLORS.onHeader,
    padding: "6px 10px",
    textAlign: "right" as const,
    fontSize: "12px",
    border: "1px solid #e5e7eb",
  };
  const cellBlueStyle = {
    backgroundColor: BRAND_COLORS.accent,
    color: BRAND_COLORS.onAccent,
    padding: "6px 10px",
    textAlign: "right" as const,
    fontSize: "12px",
    border: "1px solid #e5e7eb",
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-200 dark:border-dark-border pb-2">
          <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100">
            Status reports
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={openNewForm}
              className="inline-flex items-center justify-center h-8 px-3 rounded text-label-sm bg-jblue-500 hover:bg-jblue-700 text-white font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
            >
              New report
            </button>
          )}
        </div>
        {reportsLoading ? (
          <p className="text-body-sm text-surface-500 dark:text-surface-400">Loading reports…</p>
        ) : reports.length === 0 && !showForm ? (
          <p className="text-body-sm text-surface-500 dark:text-surface-400">No saved reports yet. Create one to export a PDF.</p>
        ) : (
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised">
                  <th className="text-left py-2 px-3 font-semibold text-surface-800 dark:text-surface-100">Report date</th>
                  <th className="text-left py-2 px-3 font-semibold text-surface-800 dark:text-surface-100">Variation</th>
                  <th className="text-right py-2 px-3 font-semibold text-surface-800 dark:text-surface-100">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-surface-100 dark:border-dark-border last:border-0">
                    <td className="py-2 px-3 text-surface-700 dark:text-surface-200">
                      {new Date(r.reportDate).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </td>
                    <td className="py-2 px-3 text-surface-700 dark:text-surface-200">{r.variation}</td>
                    <td className="py-2 px-3 text-right">
                      <a
                        href={`/api/projects/${projectId}/status-reports/${r.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-jblue-600 dark:text-jblue-400 hover:underline mr-3"
                      >
                        Export PDF
                      </a>
                      {canEdit && (
                        <>
                          <button type="button" onClick={() => openEditForm(r)} className="text-jblue-600 dark:text-jblue-400 hover:underline mr-3">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Delete this report?")) return;
                              const res = await fetch(`/api/projects/${projectId}/status-reports/${r.id}`, { method: "DELETE" });
                              if (res.ok) loadReports();
                            }}
                            className="text-jred-600 dark:text-jred-400 hover:underline"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border p-6 space-y-4">
            <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100">
              {editingReportId ? "Edit report" : "Create report"}
            </h3>
            <p className="text-body-sm text-surface-500 dark:text-surface-400">
              Biographical data (Account Director, PM, PGM, Key Staff, Period) comes from project settings.{" "}
              <Link href={`/projects/${projectSlug}/edit`} className="text-jblue-600 dark:text-jblue-400 hover:underline">
                Edit project details
              </Link>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Report date</label>
                <input
                  type="date"
                  value={formReportDate}
                  onChange={(e) => setFormReportDate(e.target.value)}
                  className="block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
                />
              </div>
              <div>
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Period (read-only)</label>
                <p className="text-body-sm text-surface-600 dark:text-surface-300 pt-1.5">{periodDisplay()}</p>
              </div>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Variation</label>
              <select
                value={formVariation}
                onChange={(e) => setFormVariation(e.target.value as "Standard" | "Milestones" | "CDA")}
                className="block w-full max-w-xs h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
              >
                {VARIATIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <button type="button" onClick={prefillFromPrevious} className="text-label-sm text-jblue-600 dark:text-jblue-400 hover:underline">
                Pre-fill from previous report
              </button>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Completed activities</label>
              <textarea
                value={formCompleted}
                onChange={(e) => setFormCompleted(e.target.value)}
                rows={4}
                placeholder="One per line or use bullets"
                className="block w-full px-3 py-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Upcoming activities</label>
              <textarea
                value={formUpcoming}
                onChange={(e) => setFormUpcoming(e.target.value)}
                rows={4}
                placeholder="One per line or use bullets"
                className="block w-full px-3 py-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Risks, issues and decisions</label>
              <textarea
                value={formRisks}
                onChange={(e) => setFormRisks(e.target.value)}
                rows={4}
                placeholder="One per line or use bullets"
                className="block w-full px-3 py-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Meeting notes (optional)</label>
              <textarea
                value={formMeetingNotes}
                onChange={(e) => setFormMeetingNotes(e.target.value)}
                rows={3}
                placeholder="Rendered as separate page(s) in PDF"
                className="block w-full px-3 py-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
              />
            </div>
            {formError && (
              <p className="text-body-sm text-jred-600 dark:text-jred-400">{formError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={submitForm}
                disabled={formSaving}
                className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm disabled:opacity-50"
              >
                {formSaving ? "Saving…" : editingReportId ? "Update" : "Save"}
              </button>
              {savedReportId && (
                <a
                  href={`/api/projects/${projectId}/status-reports/${savedReportId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm hover:bg-surface-50 dark:hover:bg-dark-bg"
                >
                  Export PDF
                </a>
              )}
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent text-surface-700 dark:text-surface-200 font-medium text-body-sm"
              >
                {editingReportId ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
          Status report summary
        </h2>
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 min-w-0">
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-surface-100 dark:border-dark-border">
                <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100">
                  Project budget & hours
                </p>
                <div className="flex items-center gap-2">
                  {copyFeedback && (
                    <span className="text-label-sm text-jblue-600 dark:text-jblue-400" role="status">
                      {copyFeedback}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={copyTable}
                    className="inline-flex items-center justify-center h-7 px-3 rounded text-label-sm bg-jblue-500 hover:bg-jblue-700 text-white font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
                  >
                    Copy table
                  </button>
                </div>
              </div>
              <table className="w-full text-body-sm border-collapse" style={{ borderCollapse: "collapse", fontFamily: "sans-serif" }}>
                <thead>
                  <tr>
                    <th style={{ ...headerStyle, width: "1%" }} />
                    <th style={headerStyle}>Est. Budget</th>
                    <th style={headerStyle}>$ Spent</th>
                    <th style={headerStyle}>$ Remaining</th>
                    <th style={headerStyle}>Budgeted Hrs</th>
                    <th style={headerStyle}>Actual Hrs</th>
                    <th style={headerStyle}>Hrs Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={labelCellStyle}>HIGH</td>
                    <td style={cellGreenStyle} className="tabular-nums">
                      {hasData ? `$${formatDollars(estBudgetHigh)}` : "—"}
                    </td>
                    <td style={cellWhiteStyle} className="tabular-nums">
                      {hasData ? `-$${formatDollars(spentDollars)}` : "—"}
                    </td>
                    <td style={cellGreenStyle} className="tabular-nums">
                      {hasData ? `$${formatDollars(remainingDollarsHigh)}` : "—"}
                    </td>
                    <td style={cellBlueStyle} className="tabular-nums">
                      {hasData ? formatHours(budgetedHoursHigh) : "—"}
                    </td>
                    <td style={cellWhiteStyle} className="tabular-nums">
                      {hasData ? `-${formatHours(actualHours)}` : "—"}
                    </td>
                    <td style={cellBlueStyle} className="tabular-nums">
                      {hasData ? formatHours(remainingHoursHigh) : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td style={labelCellStyle}>LOW</td>
                    <td style={cellGreenStyle} className="tabular-nums">
                      {hasData ? `$${formatDollars(estBudgetLow)}` : "—"}
                    </td>
                    <td style={cellWhiteStyle} className="tabular-nums">
                      {hasData ? `-$${formatDollars(spentDollars)}` : "—"}
                    </td>
                    <td style={cellGreenStyle} className="tabular-nums">
                      {hasData ? `$${formatDollars(remainingDollarsLow)}` : "—"}
                    </td>
                    <td style={cellBlueStyle} className="tabular-nums">
                      {hasData ? formatHours(budgetedHoursLow) : "—"}
                    </td>
                    <td style={cellWhiteStyle} className="tabular-nums">
                      {hasData ? `-${formatHours(actualHours)}` : "—"}
                    </td>
                    <td style={cellBlueStyle} className="tabular-nums">
                      {hasData ? formatHours(remainingHoursLow) : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="shrink-0">
            <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
              <BudgetBurnCircleChart burnPercent={burnPercentHigh} />
              {copyChartFeedback && (
                <p className="text-label-sm text-jblue-600 dark:text-jblue-400 mt-2" role="status">
                  {copyChartFeedback}
                </p>
              )}
              <button
                type="button"
                onClick={() => copyChartAsPng(burnPercentHigh)}
                className="mt-3 inline-flex items-center justify-center h-7 px-3 rounded text-label-sm bg-jblue-500 hover:bg-jblue-700 text-white font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 w-full"
              >
                Copy chart
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
