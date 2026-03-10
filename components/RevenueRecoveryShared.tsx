/**
 * Shared revenue recovery UI: circle chart and card content used on both
 * project Budget tab and PM dashboard portfolio recovery.
 */

export function formatRecoveryDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatWeekLabelShort(weekStartDate: string): string {
  if (!weekStartDate) return "—";
  const d = new Date(weekStartDate + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function getRecoveryColorClass(recoveryPercent: number | null): string {
  if (recoveryPercent == null) return "text-surface-600 dark:text-surface-300";
  if (recoveryPercent > 100) return "text-orange-600 dark:text-orange-400";
  if (recoveryPercent >= 85) return "text-green-600 dark:text-green-400";
  if (recoveryPercent >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-jred-600 dark:text-jred-400";
}

/** Budget burn % health: green < 90%, amber 90–100%, red > 100%. */
export function getBurnHealthClass(percent: number | null): string {
  if (percent == null) return "text-surface-600 dark:text-surface-300";
  if (percent > 100) return "text-jred-600 dark:text-jred-400";
  if (percent >= 90) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

/** Buffer % health: green ≥ 10%, amber 5–10%, red < 5% or over budget (< 0). */
export function getBufferHealthClass(percent: number | null): string {
  if (percent == null) return "text-surface-600 dark:text-surface-300";
  if (percent < 0) return "text-jred-600 dark:text-jred-400";
  if (percent < 5) return "text-jred-600 dark:text-jred-400";
  if (percent < 10) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

export type RecoveryCardData = {
  weekStartDate?: string;
  forecastDollars: number;
  actualDollars: number;
  recoveryPercent: number | null;
  dollarsDelta: number;
};

export function RevenueRecoveryPieChart({
  recoveryPercent,
}: {
  recoveryPercent: number | null;
}) {
  const size = 160;
  const r = 56;
  const stroke = 24;
  const circumference = 2 * Math.PI * r;
  const clamped =
    recoveryPercent == null ? 0 : Math.max(0, recoveryPercent);
  const dash = (Math.min(100, clamped) / 100) * circumference;

  const strokeColor =
    recoveryPercent != null && recoveryPercent > 100
      ? "#f97316" // orange
      : recoveryPercent != null && recoveryPercent >= 85
        ? "#22c55e" // green
        : recoveryPercent != null && recoveryPercent >= 80
          ? "#eab308" // yellow
          : recoveryPercent != null && recoveryPercent >= 0
            ? "#ff3f3f" // red
            : "#9aa3b2"; // neutral gray when null

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
              stroke={strokeColor}
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
          {recoveryPercent != null
            ? `${recoveryPercent.toFixed(1)}%`
            : "—"}
        </div>
      </div>
      <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider text-center">
        Recovery
      </p>
    </div>
  );
}

export function RecoveryCardContent({ data }: { data: RecoveryCardData }) {
  const dollarsDelta = data.dollarsDelta;
  const deltaLabel =
    dollarsDelta > 0
      ? `$${formatRecoveryDollars(Math.abs(dollarsDelta))} above forecast`
      : dollarsDelta < 0
        ? `$${formatRecoveryDollars(Math.abs(dollarsDelta))} below forecast`
        : "On forecast";

  const deltaColorClass = getRecoveryColorClass(data.recoveryPercent);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <RevenueRecoveryPieChart recoveryPercent={data.recoveryPercent} />
      <div className="flex flex-col gap-1">
        <p className="text-body-sm text-surface-600 dark:text-surface-300">
          Forecast: ${formatRecoveryDollars(data.forecastDollars)}
        </p>
        <p className="text-body-sm text-surface-600 dark:text-surface-300">
          Actual: ${formatRecoveryDollars(data.actualDollars)}
        </p>
        <p className={`text-label-md font-semibold ${deltaColorClass}`}>
          {deltaLabel}
        </p>
      </div>
    </div>
  );
}
