"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Eye,
  ExternalLink,
  Copy,
  Check,
  Pencil,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BRAND_COLORS } from "@/lib/brandColors";
import { StatusReportPreview } from "@/components/StatusReportPreview";

type RagValue = "Red" | "Amber" | "Green";

type StatusReportRecord = {
  id: string;
  reportDate: string;
  variation: string;
  updatedAt?: string;
  completedActivities: string;
  upcomingActivities: string;
  risksIssuesDecisions: string;
  meetingNotes: string | null;
  ragOverall?: RagValue | null;
  ragScope?: RagValue | null;
  ragSchedule?: RagValue | null;
  ragBudget?: RagValue | null;
  ragOverallExplanation?: string | null;
  ragScopeExplanation?: string | null;
  ragScheduleExplanation?: string | null;
  ragBudgetExplanation?: string | null;
  snapshot?: { timelinePreviousMonths?: number } | null;
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
  const size = 100;
  const r = 35;
  const stroke = 15;
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
  missingActuals?: boolean;
};

type CdaRow = {
  monthKey: string;
  monthLabel: string;
  planned: number;
  mtdActuals: number;
};

type CdaMilestone = {
  id: string;
  phase: string;
  devStartDate: string;
  devEndDate: string;
  uatStartDate: string;
  uatEndDate: string;
  deployDate: string;
  completed: boolean;
};

/** Format ISO date string as MM/DD for display. */
function formatMonthDay(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${String(m).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthFullName(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
}

/** Max milestones shown on the status report slide (completed omitted first). Matches PDF export. */
const MAX_MILESTONES_ON_PDF = 6;

const REPORTS_PER_PAGE = 5;

function RagStatusLight({ status }: { status: RagValue | null | undefined }) {
  if (status == null || status === "") {
    return (
      <span
        title="No status"
        className="inline-block w-3 h-3 rounded-full bg-surface-300 dark:bg-dark-muted ring-2 ring-surface-200 dark:ring-dark-border"
        aria-label="No status"
      />
    );
  }
  const config: Record<RagValue, { label: string; className: string }> = {
    Green: {
      label: "Green",
      className:
        "bg-green-500 dark:bg-green-400 ring-2 ring-green-400/50 dark:ring-green-500/50",
    },
    Amber: {
      label: "Amber",
      className:
        "bg-amber-500 dark:bg-amber-400 ring-2 ring-amber-400/50 dark:ring-amber-500/50",
    },
    Red: {
      label: "Red",
      className:
        "bg-jred-500 dark:bg-jred-400 ring-2 ring-jred-400/50 dark:ring-jred-500/50",
    },
  };
  const { label, className } = config[status];
  return (
    <span
      title={label}
      className={`inline-block w-3 h-3 rounded-full ${className}`}
      aria-label={label}
    />
  );
}

function milestonesForPdfExport<T extends { completed: boolean }>(milestones: T[]): T[] {
  return [...milestones]
    .sort((a, b) => Number(a.completed) - Number(b.completed))
    .slice(0, MAX_MILESTONES_ON_PDF);
}

/** Donut chart for CDA summary (Contract Hours Complete / Current Month Burn). */
function CdaDonutChart({
  percent,
  label,
  size = 100,
}: {
  percent: number | null;
  label: React.ReactNode | null;
  size?: number;
}) {
  const r = size * 0.35;
  const stroke = size * 0.15;
  const circumference = 2 * Math.PI * r;
  const clamped = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const dash = (clamped / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="stroke-surface-200 dark:stroke-dark-muted"
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
        <div className="absolute inset-0 flex items-center justify-center text-title-md font-semibold text-surface-900 dark:text-white tabular-nums" aria-live="polite">
          {percent != null ? `${percent.toFixed(0)}%` : "—"}
        </div>
      </div>
      {label != null && (
        <p className="text-label-sm uppercase text-surface-400 dark:text-surface-500 tracking-wider text-center">
          {label}
        </p>
      )}
    </div>
  );
}

const VARIATIONS = [
  { value: "CDA", label: "CDA (Monthly/Project CDA Budgets)" },
  { value: "Standard", label: "Standard (Timeline/Project Budget)" },
  { value: "Milestones", label: "Milestones (Fixed Fee No Budget)" },
] as const;

type InitialBudgetData = {
  budgetLines: BudgetLine[];
  rollups: Rollups | null | unknown;
  lastWeekWithActuals: string | null;
};

export function StatusReportsTab({
  projectId,
  projectSlug,
  canEdit,
  cdaEnabled = false,
  initialBudgetData,
}: {
  projectId: string;
  projectSlug: string;
  canEdit: boolean;
  cdaEnabled?: boolean;
  initialBudgetData?: InitialBudgetData | null;
}) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>(initialBudgetData?.budgetLines ?? []);
  const [rollups, setRollups] = useState<Rollups | null>((initialBudgetData?.rollups as Rollups) ?? null);
  const [lastWeekWithActuals, setLastWeekWithActuals] = useState<string | null>(initialBudgetData?.lastWeekWithActuals ?? null);
  const [loading, setLoading] = useState(!initialBudgetData);
  const [cdaRows, setCdaRows] = useState<CdaRow[]>([]);
  const [cdaMilestones, setCdaMilestones] = useState<CdaMilestone[]>([]);
  const [cdaLoading, setCdaLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyChartFeedback, setCopyChartFeedback] = useState<string | null>(null);

  const [reports, setReports] = useState<StatusReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsPage, setReportsPage] = useState(1);
  const [openingNewForm, setOpeningNewForm] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [formReportDate, setFormReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formVariation, setFormVariation] = useState<"Standard" | "Milestones" | "CDA">("Standard");
  const [formTimelinePreviousMonths, setFormTimelinePreviousMonths] = useState<number>(1);
  const [formCompleted, setFormCompleted] = useState("");
  const [formUpcoming, setFormUpcoming] = useState("");
  const [formRisks, setFormRisks] = useState("");
  const [formMeetingNotes, setFormMeetingNotes] = useState("");
  const [formRagOverall, setFormRagOverall] = useState<RagValue | "">("");
  const [formRagScope, setFormRagScope] = useState<RagValue | "">("");
  const [formRagSchedule, setFormRagSchedule] = useState<RagValue | "">("");
  const [formRagBudget, setFormRagBudget] = useState<RagValue | "">("");
  const [formRagOverallExplanation, setFormRagOverallExplanation] = useState("");
  const [formRagScopeExplanation, setFormRagScopeExplanation] = useState("");
  const [formRagScheduleExplanation, setFormRagScheduleExplanation] = useState("");
  const [formRagBudgetExplanation, setFormRagBudgetExplanation] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);

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
    if (!initialBudgetData) load();
  }, [load, initialBudgetData]);

  const loadCda = useCallback(() => {
    if (!cdaEnabled) return;
    setCdaLoading(true);
    fetch(`/api/projects/${projectId}/cda`)
      .then((r) => r.json())
      .then((d) => setCdaRows(d.rows ?? []))
      .catch(() => setCdaRows([]))
      .finally(() => setCdaLoading(false));
  }, [projectId, cdaEnabled]);

  const loadCdaMilestones = useCallback(() => {
    if (!cdaEnabled) return;
    fetch(`/api/projects/${projectId}/cda-milestones`)
      .then((r) => r.json())
      .then((d) => setCdaMilestones(d.milestones ?? []))
      .catch(() => setCdaMilestones([]));
  }, [projectId, cdaEnabled]);

  useEffect(() => {
    if (cdaEnabled) {
      loadCda();
      loadCdaMilestones();
    }
  }, [cdaEnabled, loadCda, loadCdaMilestones]);

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

  useEffect(() => {
    const totalPages = Math.ceil(reports.length / REPORTS_PER_PAGE) || 1;
    if (reportsPage > totalPages) {
      setReportsPage(totalPages);
    }
  }, [reports.length, reportsPage]);

  const applyPreviousReport = useCallback((prev: StatusReportRecord | null) => {
    if (!prev) return;
    if (typeof prev.completedActivities === "string") {
      setFormCompleted(prev.completedActivities);
      setFormUpcoming(prev.upcomingActivities ?? "");
      setFormRisks(prev.risksIssuesDecisions ?? "");
    }
    setFormMeetingNotes(prev.meetingNotes ?? "");
    setFormRagOverall((prev.ragOverall as RagValue) ?? "");
    setFormRagScope((prev.ragScope as RagValue) ?? "");
    setFormRagSchedule((prev.ragSchedule as RagValue) ?? "");
    setFormRagBudget((prev.ragBudget as RagValue) ?? "");
    setFormRagOverallExplanation(prev.ragOverallExplanation ?? "");
    setFormRagScopeExplanation(prev.ragScopeExplanation ?? "");
    setFormRagScheduleExplanation(prev.ragScheduleExplanation ?? "");
    setFormRagBudgetExplanation(prev.ragBudgetExplanation ?? "");
  }, []);

  const openNewForm = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setOpeningNewForm(true);
    fetch(`/api/projects/${projectId}/status-reports?previousFor=${today}`)
      .then((r) => r.json())
      .then((prev: StatusReportRecord | null) => {
        setEditingReportId(null);
        setFormReportDate(today);
        setFormVariation(cdaEnabled ? "CDA" : "Standard");
        if (prev) {
          applyPreviousReport(prev);
        } else {
          setFormCompleted("");
          setFormUpcoming("");
          setFormRisks("");
          setFormMeetingNotes("");
          setFormRagOverall("");
          setFormRagScope("");
          setFormRagSchedule("");
          setFormRagBudget("");
          setFormRagOverallExplanation("");
          setFormRagScopeExplanation("");
          setFormRagScheduleExplanation("");
          setFormRagBudgetExplanation("");
        }
        setFormError(null);
        setSavedReportId(null);
        setShowForm(true);
      })
      .catch(() => {
        setEditingReportId(null);
        setFormReportDate(today);
        setFormVariation(cdaEnabled ? "CDA" : "Standard");
        setFormTimelinePreviousMonths(1);
        setFormCompleted("");
        setFormUpcoming("");
        setFormRisks("");
        setFormMeetingNotes("");
        setFormRagOverall("");
        setFormRagScope("");
        setFormRagSchedule("");
        setFormRagBudget("");
        setFormRagOverallExplanation("");
        setFormRagScopeExplanation("");
        setFormRagScheduleExplanation("");
        setFormRagBudgetExplanation("");
        setFormError(null);
        setSavedReportId(null);
        setShowForm(true);
      })
      .finally(() => setOpeningNewForm(false));
  }, [cdaEnabled, projectId, applyPreviousReport]);

  const openEditForm = useCallback((r: StatusReportRecord) => {
    setEditingReportId(r.id);
    setFormReportDate(r.reportDate.slice(0, 10));
    setFormVariation((r.variation as "Standard" | "Milestones" | "CDA") || "Standard");
    const prevMonths = r.snapshot?.timelinePreviousMonths;
    setFormTimelinePreviousMonths(
      typeof prevMonths === "number" && prevMonths >= 1 && prevMonths <= 4 ? prevMonths : 1
    );
    setFormCompleted(r.completedActivities ?? "");
    setFormUpcoming(r.upcomingActivities ?? "");
    setFormRisks(r.risksIssuesDecisions ?? "");
    setFormMeetingNotes(r.meetingNotes ?? "");
    setFormRagOverall((r.ragOverall as RagValue) ?? "");
    setFormRagScope((r.ragScope as RagValue) ?? "");
    setFormRagSchedule((r.ragSchedule as RagValue) ?? "");
    setFormRagBudget((r.ragBudget as RagValue) ?? "");
    setFormRagOverallExplanation(r.ragOverallExplanation ?? "");
    setFormRagScopeExplanation(r.ragScopeExplanation ?? "");
    setFormRagScheduleExplanation(r.ragScheduleExplanation ?? "");
    setFormRagBudgetExplanation(r.ragBudgetExplanation ?? "");
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
    if (!editingReportId && (rollups?.missingActuals ?? false)) {
      setFormError("Actuals are stale. Update hours in the Resourcing tab before creating a new report.");
      return;
    }
    setFormSaving(true);
    const payload: Record<string, unknown> = {
      ...(!editingReportId && { reportDate: formReportDate }),
      ...(!editingReportId && { timelinePreviousMonths: formTimelinePreviousMonths }),
      variation: formVariation,
      completedActivities: formCompleted,
      upcomingActivities: formUpcoming,
      risksIssuesDecisions: formRisks,
      meetingNotes: formMeetingNotes.trim() || null,
      ragOverall: formRagOverall || null,
      ragScope: formRagScope || null,
      ragSchedule: formRagSchedule || null,
      ragBudget: formRagBudget || null,
      ragOverallExplanation: formRagOverallExplanation.trim() || null,
      ragScopeExplanation: formRagScopeExplanation.trim() || null,
      ragScheduleExplanation: formRagScheduleExplanation.trim() || null,
      ragBudgetExplanation: formRagBudgetExplanation.trim() || null,
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
  }, [projectId, editingReportId, rollups, formReportDate, formVariation, formTimelinePreviousMonths, formCompleted, formUpcoming, formRisks, formMeetingNotes, formRagOverall, formRagScope, formRagSchedule, formRagBudget, formRagOverallExplanation, formRagScopeExplanation, formRagScheduleExplanation, formRagBudgetExplanation, loadReports]);

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

  const actualsStale = rollups?.missingActuals ?? false;

  return (
    <div className="flex flex-col gap-4">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-200 dark:border-dark-border pb-2">
          <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100">
            Status Reports
          </h2>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {actualsStale && (
                <span className="text-body-sm text-amber-600 dark:text-amber-400 font-medium">
                  Update actuals in Resourcing before creating a new report.
                </span>
              )}
              <button
                type="button"
                onClick={openNewForm}
                disabled={actualsStale || openingNewForm}
                title={actualsStale ? "Actuals are stale. Update hours in the Resourcing tab first." : undefined}
                className="inline-flex items-center justify-center gap-2 h-8 px-3 rounded text-label-sm bg-jblue-500 hover:bg-jblue-700 text-white font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {openingNewForm ? "Opening…" : "New report"}
              </button>
            </div>
          )}
        </div>
        {reportsLoading ? (
          <p className="text-body-sm text-surface-500 dark:text-surface-400">Loading reports…</p>
        ) : reports.length === 0 && !showForm ? (
          <p className="text-body-sm text-surface-500 dark:text-surface-400">No saved reports yet. Create one to export a PDF.</p>
        ) : (
          <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden">
            {(() => {
              const totalPages = Math.ceil(reports.length / REPORTS_PER_PAGE) || 1;
              const currentPage = Math.min(Math.max(1, reportsPage), totalPages);
              const start = (currentPage - 1) * REPORTS_PER_PAGE;
              const paginatedReports = reports.slice(start, start + REPORTS_PER_PAGE);
              return (
                <>
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised">
                  <th className="text-left py-2 px-3 font-semibold text-surface-800 dark:text-surface-100">Report date</th>
                  <th className="text-left py-2 px-3 font-semibold text-surface-800 dark:text-surface-100">Variation</th>
                  <th className="text-left py-2 px-3 font-semibold text-surface-800 dark:text-surface-100">Last updated</th>
                  <th className="text-center py-2 px-3 font-semibold text-surface-800 dark:text-surface-100">Status</th>
                  <th className="text-right py-2 px-3 font-semibold text-surface-800 dark:text-surface-100">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map((r) => (
                  <tr key={r.id} className="border-b border-surface-100 dark:border-dark-border last:border-0">
                    <td className="py-2 px-3 text-surface-700 dark:text-surface-200">
                      {new Date(r.reportDate).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </td>
                    <td className="py-2 px-3 text-surface-700 dark:text-surface-200">{r.variation}</td>
                    <td className="py-2 px-3 text-surface-600 dark:text-surface-300 text-body-sm">
                      {r.updatedAt
                        ? new Date(r.updatedAt).toLocaleString("en-US", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <RagStatusLight status={r.ragOverall ?? null} />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => setPreviewReportId(r.id)}
                            title="Preview Report"
                            aria-label="Preview Report"
                            className="inline-flex items-center justify-center h-8 w-8 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                          </button>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-medium whitespace-nowrap rounded bg-surface-800 text-white dark:bg-surface-700 dark:text-surface-100 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                            Preview Report
                          </span>
                        </div>
                        <div className="relative group">
                          <a
                            href={`/reports/${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Present Report"
                            aria-label="Present Report"
                            className="inline-flex items-center justify-center h-8 w-8 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 no-underline"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          </a>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-medium whitespace-nowrap rounded bg-surface-800 text-white dark:bg-surface-700 dark:text-surface-100 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                            Present Report
                          </span>
                        </div>
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={async () => {
                              const permalink = `${window.location.origin}/reports/${r.id}`;
                              try {
                                await navigator.clipboard.writeText(permalink);
                                setCopiedReportId(r.id);
                                setTimeout(() => setCopiedReportId(null), 2000);
                              } catch {
                                setCopiedReportId(null);
                              }
                            }}
                            title={copiedReportId === r.id ? "Copied" : "Copy Link"}
                            aria-label={copiedReportId === r.id ? "Copied" : "Copy Link"}
                            className="inline-flex items-center justify-center h-8 w-8 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
                          >
                            {copiedReportId === r.id ? (
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-medium whitespace-nowrap rounded bg-surface-800 text-white dark:bg-surface-700 dark:text-surface-100 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                            {copiedReportId === r.id ? "Copied" : "Copy Link"}
                          </span>
                        </div>
                        {canEdit && (
                          <>
                            <div className="relative group">
                              <button
                                type="button"
                                onClick={() => openEditForm(r)}
                                title="Edit"
                                aria-label="Edit"
                                className="inline-flex items-center justify-center h-8 w-8 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </button>
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-medium whitespace-nowrap rounded bg-surface-800 text-white dark:bg-surface-700 dark:text-surface-100 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                                Edit
                              </span>
                            </div>
                            <div className="relative group">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm("Delete this report?")) return;
                                  const res = await fetch(`/api/projects/${projectId}/status-reports/${r.id}`, { method: "DELETE" });
                                  if (res.ok) loadReports();
                                }}
                                title="Delete"
                                aria-label="Delete"
                                className="inline-flex items-center justify-center h-8 w-8 rounded border border-jred-500 dark:border-jred-400 text-jred-600 dark:text-jred-400 hover:bg-jred-50 dark:hover:bg-jred-900/20 focus:outline-none focus:ring-1 focus:ring-jred-400 focus:ring-offset-1"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </button>
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-medium whitespace-nowrap rounded bg-surface-800 text-white dark:bg-surface-700 dark:text-surface-100 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                                Delete
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reports.length > REPORTS_PER_PAGE && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised">
                <p className="text-body-sm text-surface-600 dark:text-surface-300">
                  Showing {start + 1}–{start + paginatedReports.length} of {reports.length} reports
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    aria-label="Previous page"
                    className="inline-flex items-center justify-center h-8 w-8 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="text-body-sm font-medium text-surface-700 dark:text-surface-200 tabular-nums">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReportsPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    aria-label="Next page"
                    className="inline-flex items-center justify-center h-8 w-8 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-border disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            )}
                </>
              );
            })()}
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
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">
                  Report date{editingReportId ? " (locked)" : ""}
                </label>
                <input
                  type="date"
                  value={formReportDate}
                  onChange={(e) => setFormReportDate(e.target.value)}
                  disabled={!!editingReportId}
                  className="block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted disabled:opacity-60 disabled:cursor-not-allowed"
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
                {formVariation === "Milestones" && (
                  <option value="Milestones" disabled>Milestones (Fixed Fee No Budget) — not yet available</option>
                )}
                {VARIATIONS.filter((v) => v.value !== "Milestones").map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            {(formVariation === "Standard" || formVariation === "Milestones") && (
              <div>
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">
                  Previous months on timeline{editingReportId ? " (locked)" : ""}
                </label>
                {editingReportId ? (
                  <p className="text-body-sm text-surface-600 dark:text-surface-300 pt-1.5">
                    {formTimelinePreviousMonths} {formTimelinePreviousMonths === 1 ? "month" : "months"}
                  </p>
                ) : (
                  <select
                    value={formTimelinePreviousMonths}
                    onChange={(e) => setFormTimelinePreviousMonths(Number(e.target.value))}
                    className="block w-full max-w-xs h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? "month" : "months"} before report date</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">Project Status</label>
              <div className="rounded-md border border-surface-200 dark:border-dark-border overflow-hidden">
                <table className="w-full text-body-sm border-collapse table-fixed">
                  <thead>
                    <tr>
                      <th className="text-left font-semibold text-white bg-[#220088] px-2 py-1.5 w-24">Project Status</th>
                      <th className="text-center font-semibold text-white bg-[#220088] px-2 py-1.5 w-20">RAG</th>
                      <th className="text-left font-semibold text-white bg-[#220088] px-2 py-1.5">Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "Overall" as const, rag: formRagOverall, setRag: setFormRagOverall, explanation: formRagOverallExplanation, setExplanation: setFormRagOverallExplanation },
                      { key: "Scope" as const, rag: formRagScope, setRag: setFormRagScope, explanation: formRagScopeExplanation, setExplanation: setFormRagScopeExplanation },
                      { key: "Schedule" as const, rag: formRagSchedule, setRag: setFormRagSchedule, explanation: formRagScheduleExplanation, setExplanation: setFormRagScheduleExplanation },
                      { key: "Budget" as const, rag: formRagBudget, setRag: setFormRagBudget, explanation: formRagBudgetExplanation, setExplanation: setFormRagBudgetExplanation },
                    ].map(({ key, rag, setRag, explanation, setExplanation }) => (
                      <tr key={key} className="border-t border-surface-200 dark:border-dark-border even:bg-surface-50 dark:even:bg-dark-raised/50">
                        <td className="px-2 py-1.5 align-middle w-24">
                          <span className="font-semibold text-[#220088]">{key}</span>
                        </td>
                        <td className="px-2 py-1.5 align-middle text-center w-20">
                          <select
                            value={rag}
                            onChange={(e) => setRag((e.target.value || "") as RagValue | "")}
                            className={`inline-flex items-center justify-center w-full max-w-[5rem] mx-auto h-6 px-2.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ring-1 shadow-sm border-0 cursor-pointer appearance-none ${
                              rag === "Green"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 ring-emerald-400 dark:ring-emerald-500"
                                : rag === "Amber"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-amber-400 dark:ring-amber-500"
                                  : rag === "Red"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-red-400 dark:ring-red-500"
                                    : "bg-surface-100 text-surface-500 dark:bg-dark-raised dark:text-surface-400 ring-surface-300 dark:ring-dark-muted"
                            }`}
                            aria-label={`${key} status`}
                          >
                            <option value="">—</option>
                            <option value="Green">Green</option>
                            <option value="Amber">Amber</option>
                            <option value="Red">Red</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <input
                            type="text"
                            value={explanation}
                            onChange={(e) => setExplanation(e.target.value)}
                            placeholder="Explanation"
                            className="block w-full h-7 px-2 rounded text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
                            aria-label={`${key} explanation`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Completed Activities</label>
              <textarea
                value={formCompleted}
                onChange={(e) => setFormCompleted(e.target.value)}
                rows={4}
                placeholder="One per line or use bullets"
                className="block w-full px-3 py-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
              />
              <p className="mt-1 text-body-sm text-surface-500 dark:text-surface-400">Only the first 7 items appear on the exported status report. Paste a URL to add a link, or use [link text](url) for custom link text.</p>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">Upcoming Activities</label>
              <textarea
                value={formUpcoming}
                onChange={(e) => setFormUpcoming(e.target.value)}
                rows={4}
                placeholder="One per line or use bullets"
                className="block w-full px-3 py-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted"
              />
              <p className="mt-1 text-body-sm text-surface-500 dark:text-surface-400">Only the first 7 items appear on the exported status report.</p>
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
              <p className="mt-1 text-body-sm text-surface-500 dark:text-surface-400">Only the first 7 items appear on the exported status report.</p>
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
                <button
                  type="button"
                  onClick={() => setPreviewReportId(savedReportId)}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm hover:bg-surface-50 dark:hover:bg-dark-bg"
                >
                  View
                </button>
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
          Status Report Summary
        </h2>
        {formVariation === "CDA" && cdaEnabled ? (
          <div className="flex flex-col lg:flex-row gap-8 items-stretch">
            {/* Left: CDA milestones table (matches status report PDF: Phase, DEV, UAT, Deploy + On report) */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-hidden flex-1 min-h-[280px] flex flex-col">
                <div className="p-4 border-b border-surface-100 dark:border-dark-border">
                  <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100">
                    Milestones
                  </p>
                  <p className="mt-1 text-body-sm text-surface-500 dark:text-surface-400">
                    Only first six incomplete milestones appear on status report.
                  </p>
                </div>
                <div className="flex-1 overflow-auto">
                  {cdaMilestones.length === 0 ? (
                    <p className="p-4 text-body-sm text-surface-500 dark:text-surface-400">
                      No milestones. Add them in the CDA tab.
                    </p>
                  ) : (
                    (() => {
                      const onReportIds = new Set(milestonesForPdfExport(cdaMilestones).map((m) => m.id));
                      return (
                        <table className="w-full text-body-sm border-collapse">
                          <thead>
                            <tr
                              className="border-b border-surface-200 dark:border-dark-border"
                              style={{
                                backgroundColor: BRAND_COLORS.header,
                                color: BRAND_COLORS.onHeader,
                              }}
                            >
                              <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }}>
                                Phase
                              </th>
                              <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }}>
                                DEV
                              </th>
                              <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }}>
                                UAT
                              </th>
                              <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }}>
                                Deploy
                              </th>
                              <th className="text-center px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }}>
                                On status report
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {cdaMilestones.map((m) => (
                              <tr
                                key={m.id}
                                className={`border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100 ${
                                  m.completed ? "opacity-75" : ""
                                }`}
                              >
                                <td className={`px-4 py-3 font-medium text-surface-800 dark:text-white ${m.completed ? "line-through" : ""}`}>
                                  {m.phase}
                                </td>
                                <td className={`px-4 py-3 text-right tabular-nums text-surface-700 dark:text-surface-200 ${m.completed ? "line-through" : ""}`}>
                                  {formatMonthDay(m.devStartDate)}–{formatMonthDay(m.devEndDate)}
                                </td>
                                <td className={`px-4 py-3 text-right tabular-nums text-surface-700 dark:text-surface-200 ${m.completed ? "line-through" : ""}`}>
                                  {formatMonthDay(m.uatStartDate)}–{formatMonthDay(m.uatEndDate)}
                                </td>
                                <td className={`px-4 py-3 text-right tabular-nums text-surface-700 dark:text-surface-200 ${m.completed ? "line-through" : ""}`}>
                                  {formatMonthDay(m.deployDate)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {onReportIds.has(m.id) ? (
                                    <span className="text-green-600 dark:text-green-400 font-medium">Yes</span>
                                  ) : (
                                    <span className="text-surface-400 dark:text-surface-500">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
            {/* Right: CDA budget — two tables + two charts (same as CDA tab) */}
            <div className="flex-1 min-w-0 lg:max-w-[480px] flex flex-col gap-4">
              {cdaLoading ? (
                <p className="text-body-sm text-surface-500 dark:text-surface-400 py-4">Loading CDA data…</p>
              ) : (() => {
                const currentMonthKey = getCurrentMonthKey();
                const totalPlanned = cdaRows.reduce((s, r) => s + r.planned, 0);
                const totalMtdActuals = cdaRows.reduce((s, r) => s + r.mtdActuals, 0);
                const totalRemaining = roundToQuarter(totalPlanned - totalMtdActuals);
                const cdaOverallBudget = hasData
                  ? { totalDollars: estBudgetHigh, actualDollars: spentDollars }
                  : null;
                const formatCurrency = (dollars: number): string => {
                  const n = roundToQuarter(dollars);
                  const sign = n < 0 ? "-" : "";
                  return `${sign}$${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
                };
                const budgetPlanned = cdaOverallBudget != null ? formatCurrency(cdaOverallBudget.totalDollars) : "—";
                const budgetActuals = cdaOverallBudget != null ? formatCurrency(-cdaOverallBudget.actualDollars) : "—";
                const budgetRemaining =
                  cdaOverallBudget != null
                    ? formatCurrency(cdaOverallBudget.totalDollars - cdaOverallBudget.actualDollars)
                    : "—";
                const hoursActualsStr = totalMtdActuals !== 0 ? formatReportNumber(-totalMtdActuals) : "0.00";
                const currentMonthRow = cdaRows.find((r) => r.monthKey === currentMonthKey);
                const currentMonthFull = getMonthFullName(currentMonthKey);
                const hoursCompletePercent =
                  totalPlanned > 0 ? Math.min(100, Math.max(0, (totalMtdActuals / totalPlanned) * 100)) : null;
                const currentMonthPercent =
                  currentMonthRow && currentMonthRow.planned > 0
                    ? Math.min(100, Math.max(0, (currentMonthRow.mtdActuals / currentMonthRow.planned) * 100))
                    : null;
                const monthRemaining = currentMonthRow
                  ? roundToQuarter(currentMonthRow.planned - currentMonthRow.mtdActuals)
                  : null;
                const cdaHeaderStyle = {
                  backgroundColor: BRAND_COLORS.header,
                  color: BRAND_COLORS.onHeader,
                  padding: "6px 10px",
                  textAlign: "left" as const,
                  fontWeight: 600,
                  fontSize: "12px",
                  border: "1px solid #e5e7eb",
                };
                const cdaMonthRowStyle = {
                  textAlign: "center" as const,
                  color: BRAND_COLORS.onWhite,
                  fontWeight: 600,
                  fontSize: "14px",
                  padding: "8px 10px",
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff",
                };
                const cdaLabelStyle = {
                  backgroundColor: "#ffffff",
                  color: BRAND_COLORS.onWhite,
                  padding: "6px 10px",
                  textAlign: "left" as const,
                  fontWeight: 500,
                  fontSize: "12px",
                  border: "1px solid #e5e7eb",
                };
                const cdaCellRightStyle = {
                  backgroundColor: "#ffffff",
                  color: BRAND_COLORS.onWhite,
                  padding: "6px 10px",
                  textAlign: "right" as const,
                  fontSize: "12px",
                  border: "1px solid #e5e7eb",
                };
                const cdaBudgetCellStyle = {
                  backgroundColor: BRAND_COLORS.overallBudget,
                  color: BRAND_COLORS.onHeader,
                  padding: "6px 10px",
                  textAlign: "right" as const,
                  fontSize: "12px",
                  border: "1px solid #e5e7eb",
                };
                const cdaHoursCellStyle = {
                  backgroundColor: BRAND_COLORS.accent,
                  color: BRAND_COLORS.onAccent,
                  padding: "6px 10px",
                  textAlign: "right" as const,
                  fontSize: "12px",
                  border: "1px solid #e5e7eb",
                };
                return (
                  <>
                    <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-hidden">
                      <table className="w-full text-body-sm border-collapse" style={{ borderCollapse: "collapse", fontFamily: "sans-serif" }}>
                        <tbody>
                          <tr>
                            <td colSpan={4} style={cdaMonthRowStyle}>OVERALL</td>
                          </tr>
                          <tr>
                            <th style={{ ...cdaHeaderStyle, width: "30%" }}>Total Project</th>
                            <th style={cdaHeaderStyle}>Planned</th>
                            <th style={cdaHeaderStyle}>Actuals</th>
                            <th style={cdaHeaderStyle}>Remaining</th>
                          </tr>
                          <tr>
                            <td style={cdaLabelStyle}>Budget ($)</td>
                            <td style={cdaBudgetCellStyle} className="tabular-nums">{budgetPlanned}</td>
                            <td style={cdaCellRightStyle} className="tabular-nums">{budgetActuals}</td>
                            <td style={cdaBudgetCellStyle} className="tabular-nums">{budgetRemaining}</td>
                          </tr>
                          <tr>
                            <td style={cdaLabelStyle}>Hours</td>
                            <td style={cdaHoursCellStyle} className="tabular-nums">{formatReportNumber(totalPlanned)}</td>
                            <td style={cdaCellRightStyle} className="tabular-nums">{hoursActualsStr}</td>
                            <td style={cdaHoursCellStyle} className="tabular-nums">{formatReportNumber(totalRemaining)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark overflow-hidden">
                      <table className="w-full text-body-sm border-collapse" style={{ borderCollapse: "collapse", fontFamily: "sans-serif" }}>
                        <tbody>
                          <tr>
                            <td colSpan={4} style={cdaMonthRowStyle}>{currentMonthFull}</td>
                          </tr>
                          <tr>
                            <th style={cdaHeaderStyle}>Current Month</th>
                            <th style={cdaHeaderStyle}>Planned</th>
                            <th style={cdaHeaderStyle}>Actuals</th>
                            <th style={cdaHeaderStyle}>Remaining</th>
                          </tr>
                          <tr>
                            <td style={cdaLabelStyle}>Hours</td>
                            <td style={cdaHoursCellStyle} className="tabular-nums">
                              {currentMonthRow ? formatReportNumber(currentMonthRow.planned) : "—"}
                            </td>
                            <td style={cdaCellRightStyle} className="tabular-nums">
                              {currentMonthRow ? formatReportNumber(currentMonthRow.mtdActuals) : "—"}
                            </td>
                            <td style={cdaHoursCellStyle} className="tabular-nums">
                              {monthRemaining != null ? formatReportNumber(monthRemaining) : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface px-6 py-4 shadow-card-light dark:shadow-card-dark">
                      <div className="flex items-center gap-8 flex-wrap">
                        <CdaDonutChart
                          percent={hoursCompletePercent}
                          label={<>Contract<br />Hours Complete</>}
                        />
                        <CdaDonutChart
                          percent={currentMonthPercent}
                          label={<>{currentMonthFull}<br />Hours Burn</>}
                          size={100}
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
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
        )}
      </section>
      {previewReportId && (
        <StatusReportPreview
          projectId={projectId}
          projectSlug={projectSlug}
          reportId={previewReportId}
          onClose={() => setPreviewReportId(null)}
        />
      )}
    </div>
  );
}
