const MEETING_VIOLET = "#6d28d9";
const DARK_TEXT = "#0f172a";
const LIGHT_TEXT = "#ffffff";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) {
    const [r, g, b] = raw;
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
    };
  }
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

/** Relative luminance 0–1 (sRGB). */
export function hexRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Text color that stays readable on a solid Gantt bar fill. */
export function ganttBarLabelTextColor(fillHex: string): typeof LIGHT_TEXT | typeof DARK_TEXT {
  return hexRelativeLuminance(fillHex) > 0.45 ? DARK_TEXT : LIGHT_TEXT;
}

export function ganttMarkFillColor(phaseColor: string, isMeeting: boolean): string {
  return isMeeting ? MEETING_VIOLET : phaseColor;
}

export { MEETING_VIOLET };
