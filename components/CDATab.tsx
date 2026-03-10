"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { BRAND_COLORS } from "@/lib/brandColors";

function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function formatHours(hours: number): string {
  const r = roundToQuarter(hours);
  return r.toFixed(2).replace(/\.?0+$/, "") || "0";
}

/** Two decimals for status report copy (e.g. -8.00, 224.00). */
function formatReportNumber(n: number): string {
  return n.toFixed(2);
}

/** Month full name from YYYY-MM (e.g. "2025-01" -> "January"). */
function getMonthFullName(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
}

/** YYYY-MM for the current month (for "previous month" comparison). */
function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Format ISO date string as MM/DD for display. */
function formatMonthDay(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${String(m).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

/** True if the date falls on Thursday (4) or Friday (5). */
function isThursdayOrFriday(isoDate: string): boolean {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 4 || day === 5;
}

/** Day name for deploy-date flag (Thu/Fri). */
function getDeployDayName(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[d.getDay()] ?? "";
}

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

type InitialBudgetData = {
  budgetLines: Array<{ highDollars?: number; highHours?: number }>;
  rollups?: Record<string, unknown> | null | unknown;
};

export function CDATab({
  projectId,
  canEdit,
  initialBudgetData,
}: {
  projectId: string;
  canEdit: boolean;
  initialBudgetData?: InitialBudgetData | null;
}) {
  const [rows, setRows] = useState<CdaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    monthKey: string;
    field: "planned" | "mtdActuals";
    str: string;
  } | null>(null);

  /** Selected month for status report table; default current month. */
  const [statusReportMonthKey, setStatusReportMonthKey] = useState<string>(
    () => getCurrentMonthKey()
  );

  /** Overall budget $ for OVERALL table (total planned, actual to date). Null if not loaded or no budget lines. */
  const [overallBudget, setOverallBudget] = useState<{
    totalDollars: number;
    actualDollars: number;
  } | null>(null);

  /** Total budget hours from budget lines (high estimate). Used for hours-per-month remaining so it doesn't change with CDA planned edits. Null until loaded. */
  const [totalBudgetHours, setTotalBudgetHours] = useState<number | null>(null);

  /** CDA milestones (phase, dev/uat/deploy dates, completed). */
  const [milestones, setMilestones] = useState<CdaMilestone[]>([]);
  const [cdaSubTab, setCdaSubTab] = useState<"budget" | "milestones">("budget");
  const [newPhase, setNewPhase] = useState("");
  const [newDevStart, setNewDevStart] = useState("");
  const [newDevEnd, setNewDevEnd] = useState("");
  const [newUatStart, setNewUatStart] = useState("");
  const [newUatEnd, setNewUatEnd] = useState("");
  const [newDeploy, setNewDeploy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setSaveError(null);
    fetch(`/api/projects/${projectId}/cda`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  /** Keep status report month in sync when rows load or when current month changes (default to current month). */
  useEffect(() => {
    if (rows.length === 0) return;
    const inRows = rows.some((r) => r.monthKey === statusReportMonthKey);
    if (inRows) return;
    const currentInRows = rows.some((r) => r.monthKey === currentMonthKey);
    setStatusReportMonthKey(currentInRows ? currentMonthKey : rows[0].monthKey);
  }, [rows, currentMonthKey, statusReportMonthKey]);

  /** Use server-passed budget data or fetch for OVERALL table (total $ and actual $) and total budget hours. */
  useEffect(() => {
    if (initialBudgetData) {
      const lines = initialBudgetData.budgetLines ?? [];
      const rollups = initialBudgetData.rollups ?? {};
      const totalDollars = lines.reduce(
        (s: number, bl: { highDollars?: number }) => s + Number(bl.highDollars ?? 0),
        0
      );
      const actualDollars = Number((rollups as { actualDollarsToDate?: number }).actualDollarsToDate ?? 0);
      const budgetHours = lines.reduce(
        (s: number, bl: { highHours?: number }) => s + Number(bl.highHours ?? 0),
        0
      );
      setTotalBudgetHours(budgetHours);
      if (totalDollars > 0 || actualDollars > 0) {
        setOverallBudget({ totalDollars, actualDollars });
      } else {
        setOverallBudget(null);
      }
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${projectId}/budget`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const lines = d.budgetLines ?? [];
        const rollups = d.rollups ?? {};
        const totalDollars = lines.reduce(
          (s: number, bl: { highDollars?: number }) => s + Number(bl.highDollars ?? 0),
          0
        );
        const actualDollars = Number(rollups.actualDollarsToDate ?? 0);
        const budgetHours = lines.reduce(
          (s: number, bl: { highHours?: number }) => s + Number(bl.highHours ?? 0),
          0
        );
        setTotalBudgetHours(budgetHours);
        if (totalDollars > 0 || actualDollars > 0) {
          setOverallBudget({ totalDollars, actualDollars });
        } else {
          setOverallBudget(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOverallBudget(null);
          setTotalBudgetHours(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, initialBudgetData]);

  const loadMilestones = useCallback(() => {
    fetch(`/api/projects/${projectId}/cda-milestones`)
      .then((r) => r.json())
      .then((d) => setMilestones(d.milestones ?? []))
      .catch(() => setMilestones([]));
  }, [projectId]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  const addMilestone = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canEdit || !newPhase.trim()) return;
      setSaveError(null);
      const res = await fetch(`/api/projects/${projectId}/cda-milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: newPhase.trim(),
          devStartDate: newDevStart || undefined,
          devEndDate: newDevEnd || undefined,
          uatStartDate: newUatStart || undefined,
          uatEndDate: newUatEnd || undefined,
          deployDate: newDeploy || undefined,
        }),
      });
      if (res.ok) {
        const m = await res.json();
        setMilestones((prev) => [...prev, m]);
        setNewPhase("");
        setNewDevStart("");
        setNewDevEnd("");
        setNewUatStart("");
        setNewUatEnd("");
        setNewDeploy("");
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data?.error ?? `Save failed (${res.status})`);
      }
    },
    [projectId, canEdit, newPhase, newDevStart, newDevEnd, newUatStart, newUatEnd, newDeploy]
  );

  const toggleMilestoneComplete = useCallback(
    async (milestone: CdaMilestone) => {
      if (!canEdit) return;
      const res = await fetch(
        `/api/projects/${projectId}/cda-milestones/${milestone.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !milestone.completed }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setMilestones((prev) =>
          prev.map((m) => (m.id === milestone.id ? updated : m))
        );
      }
    },
    [projectId, canEdit]
  );

  const deleteMilestone = useCallback(
    async (id: string) => {
      if (!canEdit) return;
      const res = await fetch(
        `/api/projects/${projectId}/cda-milestones/${id}`,
        { method: "DELETE" }
      );
      if (res.ok) setMilestones((prev) => prev.filter((m) => m.id !== id));
    },
    [projectId, canEdit]
  );

  /** Milestone IDs that will appear on the status report PDF (incomplete first, max 6). */
  const milestoneIdsOnPdfExport = useMemo(() => {
    const forPdf = [...milestones]
      .sort((a, b) => Number(a.completed) - Number(b.completed))
      .slice(0, 6);
    return new Set(forPdf.map((m) => m.id));
  }, [milestones]);

  const saveRows = useCallback(
    async (nextRows: CdaRow[]) => {
      setSaveError(null);
      const res = await fetch(`/api/projects/${projectId}/cda`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: nextRows.map((r) => ({
            monthKey: r.monthKey,
            planned: roundToQuarter(r.planned),
            mtdActuals: roundToQuarter(r.mtdActuals),
          })),
        }),
      });
      if (!res.ok) {
        setSaveError(await res.text());
        return;
      }
      const d = await res.json();
      setRows(d.rows ?? nextRows);
    },
    [projectId]
  );

  const updateCell = useCallback(
    (monthKey: string, field: "planned" | "mtdActuals", value: number) => {
      const next = rows.map((r) =>
        r.monthKey === monthKey ? { ...r, [field]: value } : r
      );
      setRows(next);
      setEditing(null);
      if (canEdit) saveRows(next);
    },
    [rows, canEdit, saveRows]
  );

  const displayValue = (
    row: CdaRow,
    field: "planned" | "mtdActuals"
  ): string => {
    const edit = editing?.monthKey === row.monthKey && editing?.field === field;
    if (edit && editing?.str !== undefined) return editing.str;
    return formatHours(row[field]);
  };

  const remaining = (row: CdaRow) =>
    roundToQuarter(row.planned - row.mtdActuals);

  /** Build HTML for one month's status report table (inline styles for Word/Docs paste). Month is first row of table so paste is one table. */
  const buildStatusReportTableHTML = useCallback(
    (row: CdaRow, monthTitle: string) => {
      const rem = remaining(row);
      const plannedStr = formatReportNumber(row.planned);
      const actualsStr = formatReportNumber(row.mtdActuals);
      const remainingStr = formatReportNumber(rem);
      const { header, accent, onHeader, onAccent, onWhite } = BRAND_COLORS;
      const headerStyle =
        `background-color:${header};color:${onHeader};padding:6px 10px;text-align:left;font-weight:600;font-size:12px;border:1px solid #e5e7eb;`;
      const monthRowStyle =
        `text-align:center;color:${onWhite};font-weight:600;font-size:14px;padding:8px 10px;border:1px solid #e5e7eb;background-color:#ffffff;`;
      const cellWhiteLeftStyle =
        `background-color:#ffffff;color:${onWhite};padding:6px 10px;text-align:left;font-weight:500;font-size:12px;border:1px solid #e5e7eb;`;
      const cellWhiteRightStyle =
        `background-color:#ffffff;color:${onWhite};padding:6px 10px;text-align:right;font-size:12px;border:1px solid #e5e7eb;`;
      const cellBlueStyle =
        `background-color:${accent};color:${onAccent};padding:6px 10px;text-align:right;font-size:12px;border:1px solid #e5e7eb;`;
      return (
        `<table style="border-collapse:collapse;font-family:sans-serif;min-width:280px;">` +
        `<tbody>` +
        `<tr><td colspan="4" style="${monthRowStyle}">${monthTitle}</td></tr>` +
        `<tr>` +
        `<th style="${headerStyle}">Current Month</th>` +
        `<th style="${headerStyle}">Planned</th>` +
        `<th style="${headerStyle}">Actuals</th>` +
        `<th style="${headerStyle}">Remaining</th>` +
        `</tr>` +
        `<tr>` +
        `<td style="${cellWhiteLeftStyle}">Hours</td>` +
        `<td style="${cellBlueStyle}">${plannedStr}</td>` +
        `<td style="${cellWhiteRightStyle}">${actualsStr}</td>` +
        `<td style="${cellBlueStyle}">${remainingStr}</td>` +
        `</tr></tbody></table>`
      );
    },
    [remaining]
  );

  /** Build plain text for one month's status report table. */
  const buildStatusReportTablePlain = useCallback(
    (row: CdaRow, monthTitle: string) => {
      const rem = remaining(row);
      const plannedStr = formatReportNumber(row.planned);
      const actualsStr = formatReportNumber(row.mtdActuals);
      const remainingStr = formatReportNumber(rem);
      return [
        monthTitle,
        "Current Month\tPlanned\tActuals\tRemaining",
        `Hours\t${plannedStr}\t${actualsStr}\t${remainingStr}`,
      ].join("\n");
    },
    [remaining]
  );

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyChartFeedback, setCopyChartFeedback] = useState<string | null>(null);

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

  const copyStatusReportTable = useCallback(
    async (row: CdaRow) => {
      if (typeof navigator?.clipboard?.write !== "function") {
        setCopyFeedback("Clipboard not available");
        return;
      }
      const monthTitle = getMonthFullName(row.monthKey);
      const html = buildStatusReportTableHTML(row, monthTitle);
      const plain = buildStatusReportTablePlain(row, monthTitle);
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
    },
    [buildStatusReportTableHTML, buildStatusReportTablePlain]
  );

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalMtdActuals = rows.reduce((s, r) => s + r.mtdActuals, 0);
  const totalRemaining = roundToQuarter(totalPlanned - totalMtdActuals);

  /** Format currency for OVERALL table (e.g. $362,880.00 or -$191,126.25). */
  const formatCurrency = (dollars: number): string => {
    const n = roundToQuarter(dollars);
    const sign = n < 0 ? "-" : "";
    return `${sign}$${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  /** Build HTML for OVERALL table (inline styles for Word/Docs paste). Match Status report summary table: 6px 10px, 12px. */
  const buildOverallTableHTML = useCallback(() => {
    const { header, onHeader, onWhite, accent, overallBudget: overallBudgetColor } = BRAND_COLORS;
    const headerStyle = `background-color:${header};color:${onHeader};padding:6px 10px;text-align:left;font-weight:600;font-size:12px;border:1px solid #e5e7eb;`;
    const monthRowStyle = `text-align:center;color:${onWhite};font-weight:600;font-size:14px;padding:8px 10px;border:1px solid #e5e7eb;background-color:#ffffff;`;
    const labelCellStyle = `background-color:#ffffff;color:${onWhite};padding:6px 10px;text-align:left;font-weight:500;font-size:12px;border:1px solid #e5e7eb;`;
    const actualsCellStyle = `background-color:#ffffff;color:${onWhite};padding:6px 10px;text-align:right;font-size:12px;border:1px solid #e5e7eb;`;
    const budgetPlannedRemainStyle = `background-color:${overallBudgetColor};color:${onHeader};padding:6px 10px;text-align:right;font-size:12px;border:1px solid #e5e7eb;`;
    const hoursPlannedRemainStyle = `background-color:${accent};color:${onHeader};padding:6px 10px;text-align:right;font-size:12px;border:1px solid #e5e7eb;`;
    const budgetPlanned =
      overallBudget != null ? formatCurrency(overallBudget.totalDollars) : "—";
    const budgetActuals =
      overallBudget != null ? formatCurrency(-overallBudget.actualDollars) : "—";
    const budgetRemaining =
      overallBudget != null
        ? formatCurrency(overallBudget.totalDollars - overallBudget.actualDollars)
        : "—";
    const hoursPlanned = formatReportNumber(totalPlanned);
    const hoursActuals = totalMtdActuals !== 0 ? formatReportNumber(-totalMtdActuals) : "0.00";
    const hoursRemaining = formatReportNumber(totalRemaining);
    return (
      `<table style="border-collapse:collapse;font-family:sans-serif;min-width:280px;">` +
      `<tbody>` +
      `<tr><td colspan="4" style="${monthRowStyle}">Overall</td></tr>` +
      `<tr>` +
      `<th style="${headerStyle}">Total Project</th><th style="${headerStyle}">Planned</th><th style="${headerStyle}">Actuals</th><th style="${headerStyle}">Remaining</th>` +
      `</tr>` +
      `<tr>` +
      `<td style="${labelCellStyle}">Budget ($)</td>` +
      `<td style="${budgetPlannedRemainStyle}">${budgetPlanned}</td>` +
      `<td style="${actualsCellStyle}">${budgetActuals}</td>` +
      `<td style="${budgetPlannedRemainStyle}">${budgetRemaining}</td>` +
      `</tr>` +
      `<tr>` +
      `<td style="${labelCellStyle}">Hours</td>` +
      `<td style="${hoursPlannedRemainStyle}">${hoursPlanned}</td>` +
      `<td style="${actualsCellStyle}">${hoursActuals}</td>` +
      `<td style="${hoursPlannedRemainStyle}">${hoursRemaining}</td>` +
      `</tr></tbody></table>`
    );
  }, [
    overallBudget,
    totalPlanned,
    totalMtdActuals,
    totalRemaining,
  ]);

  /** Build plain text for OVERALL table. */
  const buildOverallTablePlain = useCallback(() => {
    const budgetPlanned =
      overallBudget != null ? formatCurrency(overallBudget.totalDollars) : "—";
    const budgetActuals =
      overallBudget != null ? formatCurrency(-overallBudget.actualDollars) : "—";
    const budgetRemaining =
      overallBudget != null
        ? formatCurrency(overallBudget.totalDollars - overallBudget.actualDollars)
        : "—";
    const hoursActuals = totalMtdActuals !== 0 ? formatReportNumber(-totalMtdActuals) : "0.00";
    return [
      "Overall",
      "Total Project\tPlanned\tActuals\tRemaining",
      `Budget ($)\t${budgetPlanned}\t${budgetActuals}\t${budgetRemaining}`,
      `Hours\t${formatReportNumber(totalPlanned)}\t${hoursActuals}\t${formatReportNumber(totalRemaining)}`,
    ].join("\n");
  }, [overallBudget, totalPlanned, totalMtdActuals, totalRemaining]);

  const [copyOverallFeedback, setCopyOverallFeedback] = useState<string | null>(null);

  const copyOverallTable = useCallback(async () => {
    if (typeof navigator?.clipboard?.write !== "function") {
      setCopyOverallFeedback("Clipboard not available");
      setTimeout(() => setCopyOverallFeedback(null), 2500);
      return;
    }
    const html = buildOverallTableHTML();
    const plain = buildOverallTablePlain();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      setCopyOverallFeedback("Copied to clipboard");
      setTimeout(() => setCopyOverallFeedback(null), 2500);
    } catch {
      setCopyOverallFeedback("Copy failed");
      setTimeout(() => setCopyOverallFeedback(null), 2500);
    }
  }, [buildOverallTableHTML, buildOverallTablePlain]);

  /** Current month full name for chart label (e.g. "February"). */
  const currentMonthFull = useMemo(() => {
    const [y, m] = currentMonthKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
  }, [currentMonthKey]);

  /** Percent of total contract (planned) hours completed (actuals). */
  const hoursCompletePercent =
    totalPlanned > 0
      ? Math.min(100, Math.max(0, (totalMtdActuals / totalPlanned) * 100))
      : null;

  const currentMonthRow = rows.find((r) => r.monthKey === currentMonthKey);
  /** Current month: percent of planned hours used (MTD actuals / planned). */
  const currentMonthPercent =
    currentMonthRow && currentMonthRow.planned > 0
      ? Math.min(
          100,
          Math.max(0, (currentMonthRow.mtdActuals / currentMonthRow.planned) * 100)
        )
      : null;

  /** True if this month is in the past (has ended). */
  const isPreviousMonth = (monthKey: string) => monthKey < currentMonthKey;

  /** Completed months: all months before the current (e.g. through end of February when in March). */
  const completedMonthRows = useMemo(
    () => rows.filter((r) => r.monthKey < currentMonthKey),
    [rows, currentMonthKey]
  );
  /** Surplus or deficit as of end of last month: sum of (planned - mtdActuals) for completed months only. */
  const surplusThroughLastMonth = useMemo(
    () =>
      roundToQuarter(
        completedMonthRows.reduce((s, r) => s + (r.planned - r.mtdActuals), 0)
      ),
    [completedMonthRows]
  );

  /** Remaining months: current month plus future months (>= current). */
  const remainingMonthRows = useMemo(
    () => rows.filter((r) => r.monthKey >= currentMonthKey),
    [rows, currentMonthKey]
  );
  const remainingMonthCount = remainingMonthRows.length;
  const totalContractMonths = rows.length;
  /** Contract hours total for the average: use budget hours when available so the value doesn't change when CDA planned is edited; else fall back to CDA total planned. */
  const contractHoursTotal =
    totalBudgetHours != null && totalBudgetHours > 0 ? totalBudgetHours : totalPlanned;
  /** Average hours per month over the full contract (budget or planned total ÷ total contract months). */
  const avgHoursPerMonthContract =
    totalContractMonths > 0 ? contractHoursTotal / totalContractMonths : 0;
  /** Surplus or deficit spread per remaining month (surplus/deficit through last month ÷ remaining months). */
  const surplusDeficitPerRemainingMonth =
    remainingMonthCount > 0 ? surplusThroughLastMonth / remainingMonthCount : 0;
  /** Hours per month remaining: contract avg per month + (surplus or deficit ÷ remaining months). */
  const avgRemainingPerFutureMonth =
    remainingMonthCount > 0
      ? roundToQuarter(avgHoursPerMonthContract + surplusDeficitPerRemainingMonth)
      : null;

  if (loading) {
    return (
      <div className="py-8 text-body-sm text-surface-500 dark:text-surface-400">
        Loading…
      </div>
    );
  }

  function DonutChart({
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
          <svg
            width={size}
            height={size}
            className="-rotate-90"
            aria-hidden
          >
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
          <div
            className="absolute inset-0 flex items-center justify-center text-title-md font-semibold text-surface-900 dark:text-white tabular-nums"
            aria-live="polite"
          >
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

  const CDA_SUB_TABS = [
        { id: "budget" as const, label: "Budget" },
        { id: "milestones" as const, label: "Milestones" },
      ];

  return (
    <div className="space-y-4">
      {saveError && (
        <p className="text-body-sm text-jred-600 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 px-3 py-2 rounded-md">
          {saveError}
        </p>
      )}
      <nav className="flex gap-2 border-b border-surface-200 dark:border-dark-border -mb-px" aria-label="CDA sections">
        {CDA_SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setCdaSubTab(t.id)}
            className={`px-4 py-2 border-b-2 transition-colors ${
              cdaSubTab === t.id
                ? "border-jblue-500 text-jblue-600 dark:text-jblue-400 font-semibold"
                : "border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-raised rounded-t-md"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {cdaSubTab === "budget" && (
      <div className="flex flex-wrap items-start gap-6">
        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark max-w-lg">
        <table className="w-full min-w-0 text-body-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
              <th className="text-left px-2 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Month
              </th>
              <th className="text-right px-2 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Planned
              </th>
              <th className="text-right px-2 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                MTD Actuals
              </th>
              <th className="text-right px-2 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Remaining
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rem = remaining(row);
              const isNegative = rem < 0;
              const isPast = isPreviousMonth(row.monthKey);
              const plannedEmpty = isPast && row.planned === 0;
              const mtdEmpty = isPast && row.mtdActuals === 0;
              const inputBase =
                "h-8 px-1.5 rounded border text-body-sm w-full max-w-[5rem] text-right focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
              const inputClass = (highlight: boolean) =>
                `${inputBase} ${
                  highlight
                    ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-surface-800 dark:text-surface-100"
                    : "bg-white dark:bg-dark-raised border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                }`;
              return (
                <tr
                  key={row.monthKey}
                  className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100"
                >
                  <td className="px-2 py-2 font-medium text-surface-800 dark:text-white truncate">
                    {row.monthLabel}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${
                      plannedEmpty && !canEdit
                        ? "bg-amber-50 dark:bg-amber-900/20"
                        : ""
                    }`}
                  >
                    {canEdit ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.25}
                        value={displayValue(row, "planned")}
                        onChange={(e) =>
                          setEditing({
                            monthKey: row.monthKey,
                            field: "planned",
                            str: e.target.value,
                          })
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => {
                          const str = displayValue(row, "planned");
                          const n = parseFloat(str);
                          if (!Number.isFinite(n) || n < 0) {
                            setEditing(null);
                            return;
                          }
                          updateCell(row.monthKey, "planned", roundToQuarter(n));
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            (e.target as HTMLInputElement).blur();
                        }}
                        className={inputClass(plannedEmpty)}
                      />
                    ) : (
                      <span className="text-surface-700 dark:text-surface-200">
                        {formatHours(row.planned)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${
                      mtdEmpty && !canEdit
                        ? "bg-amber-50 dark:bg-amber-900/20"
                        : ""
                    }`}
                  >
                    {canEdit ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.25}
                        value={displayValue(row, "mtdActuals")}
                        onChange={(e) =>
                          setEditing({
                            monthKey: row.monthKey,
                            field: "mtdActuals",
                            str: e.target.value,
                          })
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => {
                          const str = displayValue(row, "mtdActuals");
                          const n = parseFloat(str);
                          if (!Number.isFinite(n) || n < 0) {
                            setEditing(null);
                            return;
                          }
                          updateCell(
                            row.monthKey,
                            "mtdActuals",
                            roundToQuarter(n)
                          );
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            (e.target as HTMLInputElement).blur();
                        }}
                        className={inputClass(mtdEmpty)}
                      />
                    ) : (
                      <span className="text-surface-700 dark:text-surface-200">
                        {formatHours(row.mtdActuals)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums font-semibold ${
                      isNegative
                        ? "text-jred-600 dark:text-jred-400"
                        : "text-surface-700 dark:text-surface-200"
                    }`}
                  >
                    {isNegative
                      ? `(${formatHours(-rem)})`
                      : formatHours(rem)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-surface-200 dark:border-dark-border bg-surface-100 dark:bg-dark-raised font-medium">
              <td className="px-2 py-2 text-surface-800 dark:text-surface-100">
                Total
              </td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">
                {formatHours(totalMtdActuals)}
              </td>
              <td
                className={`px-2 py-2 text-right tabular-nums font-semibold ${
                  totalRemaining < 0
                    ? "text-jred-600 dark:text-jred-400"
                    : "text-surface-700 dark:text-surface-200"
                }`}
              >
                {totalRemaining < 0
                  ? `(${formatHours(-totalRemaining)})`
                  : formatHours(totalRemaining)}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
        <div className="flex flex-col gap-4 shrink-0 min-w-0">
          <div className="flex flex-col gap-4 rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface px-6 py-4 shadow-card-light dark:shadow-card-dark">
            <div className="flex items-center gap-8">
              <DonutChart
                percent={hoursCompletePercent}
                label={<>Contract<br />Hours Complete</>}
              />
              <DonutChart
                percent={currentMonthPercent}
                label={<>{currentMonthFull}<br />Hours Burn</>}
                size={100}
              />
            </div>
            <div className="border-t border-surface-200 dark:border-dark-border pt-3">
              <p className="text-label-sm uppercase text-surface-400 dark:text-surface-500 tracking-wider">
                Surplus / deficit (through last month)
              </p>
              <p
                className={`text-title-md font-semibold tabular-nums mt-0.5 ${
                  surplusThroughLastMonth < 0
                    ? "text-jred-600 dark:text-jred-400"
                    : "text-surface-900 dark:text-white"
                }`}
              >
                {surplusThroughLastMonth > 0
                  ? `${formatHours(surplusThroughLastMonth)} hrs surplus`
                  : surplusThroughLastMonth < 0
                    ? `(${formatHours(-surplusThroughLastMonth)}) hrs deficit`
                    : "0 hrs"}
              </p>
            </div>
            <div className="border-t border-surface-200 dark:border-dark-border pt-3">
              <p className="text-label-sm uppercase text-surface-400 dark:text-surface-500 tracking-wider">
                Hours per month remaining
              </p>
              <p
                className={`text-title-md font-semibold tabular-nums mt-0.5 ${
                  avgRemainingPerFutureMonth != null && avgRemainingPerFutureMonth < 0
                    ? "text-jred-600 dark:text-jred-400"
                    : "text-surface-900 dark:text-white"
                }`}
              >
                {avgRemainingPerFutureMonth != null
                  ? `${avgRemainingPerFutureMonth < 0 ? "(" : ""}${formatHours(Math.abs(avgRemainingPerFutureMonth))}${avgRemainingPerFutureMonth < 0 ? ")" : ""} hrs${remainingMonthCount > 0 ? ` (${remainingMonthCount} months)` : ""}`
                  : "—"}
              </p>
            </div>
          </div>

          {rows.length > 0 && (() => {
            const selectedRow =
              rows.find((r) => r.monthKey === statusReportMonthKey) ?? rows[0];
            const rem = remaining(selectedRow);
            const monthTitle = getMonthFullName(selectedRow.monthKey);
            const plannedStr = formatReportNumber(selectedRow.planned);
            const actualsStr = formatReportNumber(selectedRow.mtdActuals);
            const remainingStr = formatReportNumber(rem);
            const budgetPlanned =
              overallBudget != null ? formatCurrency(overallBudget.totalDollars) : "—";
            const budgetActuals =
              overallBudget != null ? formatCurrency(-overallBudget.actualDollars) : "—";
            const budgetRemaining =
              overallBudget != null
                ? formatCurrency(overallBudget.totalDollars - overallBudget.actualDollars)
                : "—";
            const hoursActualsStr =
              totalMtdActuals !== 0 ? formatReportNumber(-totalMtdActuals) : "0.00";
            const selectedMonthBurnPercent =
              selectedRow.planned > 0
                ? Math.min(
                    100,
                    Math.max(0, (selectedRow.mtdActuals / selectedRow.planned) * 100)
                  )
                : null;
            /** Match Status report summary table (StatusReportsTab): 6px 10px, 12px for copy-paste consistency. */
            const headerCellStyle = {
              backgroundColor: BRAND_COLORS.header,
              color: BRAND_COLORS.onHeader,
              padding: "6px 10px",
              textAlign: "left" as const,
              fontWeight: 600,
              fontSize: "12px",
              border: "1px solid #e5e7eb",
            };
            const monthRowStyle = {
              textAlign: "center" as const,
              color: BRAND_COLORS.onWhite,
              fontWeight: 600,
              fontSize: "14px",
              padding: "8px 10px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
            };
            const cellWhiteLeftStyle = {
              backgroundColor: "#ffffff",
              color: BRAND_COLORS.onWhite,
              padding: "6px 10px",
              textAlign: "left" as const,
              fontWeight: 500,
              fontSize: "12px",
              border: "1px solid #e5e7eb",
            };
            const cellWhiteRightStyle = {
              backgroundColor: "#ffffff",
              color: BRAND_COLORS.onWhite,
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
            const overallHeaderStyle = {
              backgroundColor: BRAND_COLORS.header,
              color: BRAND_COLORS.onHeader,
              padding: "6px 10px",
              textAlign: "left" as const,
              fontWeight: 600,
              fontSize: "12px",
              border: "1px solid #e5e7eb",
            };
            /** Budget ($) and Hours label cells: white background, same as monthly table. */
            const overallLabelStyle = {
              backgroundColor: "#ffffff",
              color: BRAND_COLORS.onWhite,
              padding: "6px 10px",
              textAlign: "left" as const,
              fontWeight: 500,
              fontSize: "12px",
              border: "1px solid #e5e7eb",
            };
            const overallBudgetCellStyle = {
              backgroundColor: BRAND_COLORS.overallBudget,
              color: BRAND_COLORS.onHeader,
              padding: "6px 10px",
              textAlign: "right" as const,
              fontSize: "12px",
              border: "1px solid #e5e7eb",
            };
            const overallHoursCellStyle = {
              backgroundColor: BRAND_COLORS.accent,
              color: BRAND_COLORS.onAccent,
              padding: "6px 10px",
              textAlign: "right" as const,
              fontSize: "12px",
              border: "1px solid #e5e7eb",
            };
            const overallActualsStyle = {
              backgroundColor: "#ffffff",
              color: BRAND_COLORS.onWhite,
              padding: "6px 10px",
              textAlign: "right" as const,
              fontSize: "12px",
              border: "1px solid #e5e7eb",
            };
            return (
              <div className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface p-3 shadow-card-light dark:shadow-card-dark">
                <h3 className="text-title-sm font-semibold text-surface-900 dark:text-white mb-2">
                  Copy for status report
                </h3>
                {copyFeedback && (
                  <p className="text-label-sm text-jblue-600 dark:text-jblue-400 mb-2" role="status">
                    {copyFeedback}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {/* OVERALL table - OVERALL is first row of table like month in monthly table */}
                  <div className="flex flex-col gap-2">
                    <table
                      className="border-collapse font-sans w-full text-body-sm"
                      style={{
                        borderCollapse: "collapse",
                        fontFamily: "sans-serif",
                        minWidth: "0",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td colSpan={4} style={monthRowStyle}>
                            Overall
                          </td>
                        </tr>
                        <tr>
                          <th style={{ ...overallHeaderStyle, width: "30%" }}>Total Project</th>
                          <th style={overallHeaderStyle}>Planned</th>
                          <th style={overallHeaderStyle}>Actuals</th>
                          <th style={overallHeaderStyle}>Remaining</th>
                        </tr>
                        <tr>
                          <td style={overallLabelStyle}>Budget ($)</td>
                          <td style={overallBudgetCellStyle}>{budgetPlanned}</td>
                          <td style={overallActualsStyle}>{budgetActuals}</td>
                          <td style={overallBudgetCellStyle}>{budgetRemaining}</td>
                        </tr>
                        <tr>
                          <td style={overallLabelStyle}>Hours</td>
                          <td style={overallHoursCellStyle} className="tabular-nums">{formatReportNumber(totalPlanned)}</td>
                          <td style={overallActualsStyle} className="tabular-nums">{hoursActualsStr}</td>
                          <td style={overallHoursCellStyle} className="tabular-nums">{formatReportNumber(totalRemaining)}</td>
                        </tr>
                      </tbody>
                    </table>
                    {copyOverallFeedback && (
                      <p className="text-label-sm text-jblue-600 dark:text-jblue-400" role="status">
                        {copyOverallFeedback}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={copyOverallTable}
                      className="inline-flex items-center justify-center h-7 px-2 rounded text-label-sm bg-jblue-500 hover:bg-jblue-700 text-white font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 w-fit"
                    >
                      Copy table
                    </button>
                  </div>

                  <div className="border-t border-surface-200 dark:border-dark-border pt-3 mt-2">
                    <p className="text-label-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      Total contract hours burned
                    </p>
                    <div className="flex flex-col items-start gap-2">
                      <div className="w-full flex justify-center">
                        <DonutChart
                          percent={hoursCompletePercent}
                          label={null}
                          size={80}
                        />
                      </div>
                      {copyChartFeedback && (
                        <p className="text-label-sm text-jblue-600 dark:text-jblue-400" role="status">
                          {copyChartFeedback}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => copyChartAsPng(hoursCompletePercent)}
                        className="inline-flex items-center justify-center h-7 px-2 rounded text-label-sm bg-jblue-500 hover:bg-jblue-700 text-white font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 w-fit"
                      >
                        Copy chart
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <label htmlFor="status-report-month" className="text-label-sm font-medium text-surface-700 dark:text-surface-300 shrink-0">
                      Month
                    </label>
                    <select
                      id="status-report-month"
                      value={statusReportMonthKey}
                      onChange={(e) => setStatusReportMonthKey(e.target.value)}
                      className="h-7 px-2 rounded border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised text-surface-800 dark:text-surface-100 text-label-sm focus:outline-none focus:ring-1 focus:ring-jblue-500/30 focus:border-jblue-400 min-w-0 flex-1 max-w-[120px]"
                    >
                      {rows.map((r) => (
                        <option key={r.monthKey} value={r.monthKey}>
                          {getMonthFullName(r.monthKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <table
                    className="border-collapse font-sans w-full text-body-sm"
                    style={{
                      borderCollapse: "collapse",
                      fontFamily: "sans-serif",
                      minWidth: "0",
                    }}
                  >
                    <tbody>
                      <tr>
                        <td colSpan={4} style={monthRowStyle}>
                          {monthTitle}
                        </td>
                      </tr>
                      <tr>
                        <th style={headerCellStyle}>Current Month</th>
                        <th style={headerCellStyle}>Planned</th>
                        <th style={headerCellStyle}>Actuals</th>
                        <th style={headerCellStyle}>Remaining</th>
                      </tr>
                      <tr>
                        <td style={cellWhiteLeftStyle}>Hours</td>
                        <td style={cellBlueStyle} className="tabular-nums">{plannedStr}</td>
                        <td style={cellWhiteRightStyle} className="tabular-nums">{actualsStr}</td>
                        <td style={cellBlueStyle} className="tabular-nums">{remainingStr}</td>
                      </tr>
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={() => copyStatusReportTable(selectedRow)}
                    className="inline-flex items-center justify-center h-7 px-2 rounded text-label-sm bg-jblue-500 hover:bg-jblue-700 text-white font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 w-fit"
                  >
                    Copy table
                  </button>

                  <div className="border-t border-surface-200 dark:border-dark-border pt-3 mt-2">
                    <div className="flex flex-col items-start gap-2">
                      <div className="w-full flex justify-center">
                        <DonutChart
                          percent={selectedMonthBurnPercent}
                          label={null}
                          size={80}
                        />
                      </div>
                      {copyChartFeedback && (
                        <p className="text-label-sm text-jblue-600 dark:text-jblue-400" role="status">
                          {copyChartFeedback}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => copyChartAsPng(selectedMonthBurnPercent)}
                        className="inline-flex items-center justify-center h-7 px-2 rounded text-label-sm bg-jblue-500 hover:bg-jblue-700 text-white font-medium focus:outline-none focus:ring-1 focus:ring-jblue-400 focus:ring-offset-1 w-fit"
                      >
                        Copy chart
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      )}

      {cdaSubTab === "milestones" && (
      <section className="space-y-4">
        <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
          Milestones
        </h2>
        {canEdit && (
          <form
            onSubmit={addMilestone}
            className="flex flex-wrap gap-x-4 gap-y-3 items-end"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="cda-phase" className="text-label-sm font-medium text-surface-600 dark:text-surface-400">
                Phase
              </label>
              <input
                id="cda-phase"
                required
                value={newPhase}
                onChange={(e) => setNewPhase(e.target.value)}
                placeholder="e.g. Sprint 1"
                className="h-9 w-full min-w-[8rem] px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cda-dev-start" className="text-label-sm font-medium text-surface-600 dark:text-surface-400">
                Dev start (MM/DD/YYYY)
              </label>
              <input
                id="cda-dev-start"
                type="date"
                value={newDevStart}
                onChange={(e) => setNewDevStart(e.target.value)}
                className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cda-dev-end" className="text-label-sm font-medium text-surface-600 dark:text-surface-400">
                Dev end (MM/DD/YYYY)
              </label>
              <input
                id="cda-dev-end"
                type="date"
                value={newDevEnd}
                onChange={(e) => setNewDevEnd(e.target.value)}
                className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cda-uat-start" className="text-label-sm font-medium text-surface-600 dark:text-surface-400">
                UAT start (MM/DD/YYYY)
              </label>
              <input
                id="cda-uat-start"
                type="date"
                value={newUatStart}
                onChange={(e) => setNewUatStart(e.target.value)}
                className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cda-uat-end" className="text-label-sm font-medium text-surface-600 dark:text-surface-400">
                UAT end (MM/DD/YYYY)
              </label>
              <input
                id="cda-uat-end"
                type="date"
                value={newUatEnd}
                onChange={(e) => setNewUatEnd(e.target.value)}
                className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cda-deploy" className="text-label-sm font-medium text-surface-600 dark:text-surface-400">
                Deploy (MM/DD/YYYY)
              </label>
              <input
                id="cda-deploy"
                type="date"
                value={newDeploy}
                onChange={(e) => setNewDeploy(e.target.value)}
                className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              Add
            </button>
          </form>
        )}
        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
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
                  DEV START/END
                </th>
                <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }}>
                  UAT START/END
                </th>
                <th className="text-right px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }}>
                  Deploy
                </th>
                <th className="text-center px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }}>
                  Complete
                </th>
                <th className="text-center px-4 py-3 text-label-sm uppercase tracking-wider font-semibold" style={{ fontSize: "0.75rem" }} title="Shown on status report (max 6; completed omitted first)">
                  On status
                </th>
                {canEdit && (
                  <th className="w-10 px-2 py-3" aria-label="Delete row" />
                )}
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
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
                  <td
                    className={`px-4 py-3 text-right tabular-nums text-surface-700 dark:text-surface-200 ${m.completed ? "line-through" : ""} ${
                      isThursdayOrFriday(m.deployDate)
                        ? "bg-amber-100 dark:bg-amber-900/25 border-l-2 border-amber-400 dark:border-amber-600"
                        : ""
                    }`}
                    title={isThursdayOrFriday(m.deployDate) ? `Deploy on ${getDeployDayName(m.deployDate)}` : undefined}
                  >
                    {formatMonthDay(m.deployDate)}
                    {isThursdayOrFriday(m.deployDate) && (
                      <span className="ml-1.5 text-amber-700 dark:text-amber-400 text-label-sm font-medium">
                        ({getDeployDayName(m.deployDate)})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => toggleMilestoneComplete(m)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-dark-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-jblue-500"
                        aria-label={m.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {m.completed ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden>
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <span className="text-surface-600 dark:text-surface-400">
                        {m.completed ? "Yes" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-body-sm" title={milestoneIdsOnPdfExport.has(m.id) ? "Shown on status report" : "Not shown on status report (max 6; completed omitted first)"}>
                    {milestoneIdsOnPdfExport.has(m.id) ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">Yes</span>
                    ) : (
                      <span className="text-surface-400 dark:text-surface-500">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => deleteMilestone(m.id)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={`Delete ${m.phase}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
                          <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}
