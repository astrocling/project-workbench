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

  /** Palette: JBlue (dark navy). */
  jBlue: "#040066",
  /** Palette: Blue 072 C. */
  blue072C: "#040AB2",
  /** Palette: 285 C (electric blue). */
  blue285C: "#1941FA",
  /** Palette: 2925 C (sky blue). */
  blue2925C: "#3C82FF",
  /** Palette: JRed (bright red). */
  jRed: "#F00A0A",
  /** Palette: 1785 C. */
  red1785C: "#FF3F3F",
  /** Palette: 184 C (coral/salmon). */
  red184C: "#F16A6A",
  /** Palette: 197 C (light coral/peach). */
  red197C: "#FF8982",
} as const;
