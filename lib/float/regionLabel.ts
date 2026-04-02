import { regionIdFromHolidayRow, regionIdFromPersonRow } from "@/lib/float/excludedDays";

function nonEmptyTrim(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Extract a display label for Float region from a `/v3/people` row (shape varies by API version).
 */
export function floatRegionLabelFromPersonRow(row: Record<string, unknown>): string | null {
  const direct =
    nonEmptyTrim(row.region_name) ??
    nonEmptyTrim(row.region_label) ??
    nonEmptyTrim(row.regionName);
  if (direct) return direct;
  const r = row.region;
  if (typeof r === "string") return nonEmptyTrim(r);
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const o = r as Record<string, unknown>;
    return (
      nonEmptyTrim(o.name) ??
      nonEmptyTrim(o.region_name) ??
      nonEmptyTrim(o.regionName) ??
      nonEmptyTrim(o.label) ??
      nonEmptyTrim(o.title) ??
      nonEmptyTrim(o.display_name) ??
      nonEmptyTrim(o.displayName)
    );
  }
  return null;
}

/**
 * Display label for a region on a public/team holiday row (not the holiday event `name`).
 */
export function floatRegionLabelFromHolidayRow(row: Record<string, unknown>): string | null {
  const label =
    nonEmptyTrim(row.region_name) ??
    nonEmptyTrim(row.region_label) ??
    nonEmptyTrim(row.regionName) ??
    (typeof row.region === "string" ? nonEmptyTrim(row.region) : null);
  if (label) return label;
  const r = row.region;
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const o = r as Record<string, unknown>;
    return (
      nonEmptyTrim(o.name) ?? nonEmptyTrim(o.label) ?? nonEmptyTrim(o.title) ?? nonEmptyTrim(o.region_name)
    );
  }
  return null;
}

/**
 * Build region id → display label from public/team holiday rows (excluding holiday `name`, which is the event title).
 */
export function floatRegionNamesFromHolidayRows(
  publicHolidays: Array<Record<string, unknown>>,
  teamHolidays: Array<Record<string, unknown>>
): Map<number, string> {
  const m = new Map<number, string>();

  const considerRow = (row: Record<string, unknown>) => {
    const id = regionIdFromHolidayRow(row);
    if (id == null || m.has(id)) return;
    const label = floatRegionLabelFromHolidayRow(row);
    if (label) m.set(id, label);
  };

  for (const row of publicHolidays) considerRow(row);
  for (const row of teamHolidays) considerRow(row);
  return m;
}

/**
 * Build region id → display label from `/v3/people` rows (first label per id wins).
 */
export function floatRegionNamesFromPeopleRows(rows: Array<Record<string, unknown>>): Map<number, string> {
  const m = new Map<number, string>();
  for (const row of rows) {
    const id = regionIdFromPersonRow(row);
    if (id == null || m.has(id)) continue;
    const label = floatRegionLabelFromPersonRow(row);
    if (label) m.set(id, label);
  }
  return m;
}

/**
 * Merge maps in order: earlier maps keep their entries; later maps only add ids not yet present.
 * Typical use: holidays first, then people (people fill gaps when holidays omit names).
 */
export function mergeFloatRegionNameMaps(...maps: Map<number, string>[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of maps) {
    for (const [id, label] of m) {
      if (!out.has(id)) out.set(id, label);
    }
  }
  return out;
}

/**
 * Build merged region id → label from holiday rows and people rows (see {@link mergeFloatRegionNameMaps}).
 */
export function buildFloatRegionNameMap(
  publicHolidays: Array<Record<string, unknown>>,
  teamHolidays: Array<Record<string, unknown>>,
  peopleRows: Array<Record<string, unknown>>
): Map<number, string> {
  return mergeFloatRegionNameMaps(
    floatRegionNamesFromHolidayRows(publicHolidays, teamHolidays),
    floatRegionNamesFromPeopleRows(peopleRows)
  );
}

/**
 * Copy holiday rows and set `workbench_region_label` when the row has a `region_id` but Float did not send a display name,
 * and the merged map has a label for that id.
 */
export function enrichHolidayRowsWithWorkbenchRegionLabel(
  rows: Record<string, unknown>[],
  regionNameById: Map<number, string>
): Record<string, unknown>[] {
  return rows.map((row) => {
    const id = regionIdFromHolidayRow(row);
    if (id == null) return row;
    if (floatRegionLabelFromHolidayRow(row)) return row;
    const label = regionNameById.get(id);
    if (!label) return row;
    return { ...row, workbench_region_label: label };
  });
}
