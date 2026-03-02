/**
 * Brand colors for status reports and CDA copy-for-report table.
 * Keep in sync with app/globals.css @theme (--color-brand-*).
 * Do not change without product/brand approval.
 */
export const BRAND_COLORS = {
  /** Header row background (e.g. CDA status report table header). */
  header: "#060066",
  /** Planned and Remaining cells background. */
  accent: "#3d82ff",
  /** Text on header and accent (white). */
  onHeader: "#ffffff",
  onAccent: "#ffffff",
  /** Text on white cells (Hours, Actuals labels/values). */
  onWhite: "#060066",
  /** OVERALL table: Budget ($) row Planned/Remaining cells (light green). */
  overallBudget: "#22c55e",
} as const;
