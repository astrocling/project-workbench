"use client";

import { useState, useEffect, useCallback } from "react";
import { BRAND_COLORS } from "@/lib/brandColors";

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

export function StatusReportsTab({
  projectId,
}: {
  projectId: string;
}) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [rollups, setRollups] = useState<Rollups | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyChartFeedback, setCopyChartFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/budget`)
      .then((r) => r.json())
      .then((d) => {
        setBudgetLines(d.budgetLines ?? []);
        setRollups(d.rollups ?? null);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

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
