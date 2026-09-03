/**
 * Guards for the Plan grid's `<input type="date">` cells. A native date input reports a value on
 * every keystroke: empty while a segment is incomplete, and years like `0002` while the year is
 * typed digit by digit. Saving those would PATCH and refetch the plan on each keystroke, so a
 * date is only committed once it is a complete, plausible calendar date.
 */

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

export function isCommittablePlanDate(value: string): boolean {
  if (!YMD_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  // Round-trips only for real calendar days, so 2026-02-30 and 2026-13-01 are rejected.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type PlanDateEditEvent = "change" | "blur";

export type PlanDateCellDecision = {
  /** Date to send to the API, or null when this edit must not save. */
  save: string | null;
  /** Value to force back into the cell (an incomplete edit abandoned on blur), or null to leave it. */
  restore: string | null;
  /** The cell's new `lastSubmitted`; thread this back into the next event from the same cell. */
  nextLastSubmitted: string | null;
};

/**
 * Decide what one edit of a date cell does.
 *
 * A cell compares against the newest date it is known to have saved — its own `lastSubmitted`
 * while a save is in flight, otherwise the stored `externalValue`. The stored value lags behind
 * a save until the plan refetch lands, so comparing a blur against it would make the value just
 * saved on `change` look like a fresh edit and fire a second, identical PATCH. Each distinct date
 * saves exactly once; a repeat of the same date, from either event, saves nothing.
 */
export function resolvePlanDateCellEdit({
  event,
  inputValue,
  externalValue,
  lastSubmitted,
}: {
  event: PlanDateEditEvent;
  inputValue: string;
  externalValue: string;
  lastSubmitted: string | null;
}): PlanDateCellDecision {
  const committedValue = lastSubmitted ?? externalValue;

  if (!isCommittablePlanDate(inputValue)) {
    return {
      save: null,
      restore: event === "blur" && inputValue !== committedValue ? committedValue : null,
      nextLastSubmitted: lastSubmitted,
    };
  }

  if (inputValue === committedValue) {
    return { save: null, restore: null, nextLastSubmitted: lastSubmitted };
  }

  return { save: inputValue, restore: null, nextLastSubmitted: inputValue };
}
