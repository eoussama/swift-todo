import { addDays, addMonths, daysBetween, parseDue, toDue } from "./date";



/**
 * A repeat rule, stored compactly on the to-do:
 * - `<n><unit>`: every n minutes (`m`), hours (`h`), days (`d`), weeks (`w`) or months (`M`);
 * - `wd`: every weekday, Monday to Friday;
 * - `w:<days>`: on given weekdays, `0` (Sunday) to `6` (Saturday), comma-separated.
 */
export type TRule
  = | { kind: "interval"; every: number; unit: "m" | "h" | "d" | "w" | "M" }
    | { kind: "weekdays"; days: Array<number> };

export const MAX_INTERVAL = 999;
const WORKDAYS = [1, 2, 3, 4, 5];

/**
 * Reads a stored repeat rule.
 *
 * @param rule The stored rule.
 * @returns The rule, or `null` when it isn't valid.
 */
export function parseRule(rule: string): TRule | null {
  if (rule === "wd") {
    return { kind: "weekdays", days: [...WORKDAYS] };
  }

  const weekly = /^w:([0-6](?:,[0-6])*)$/.exec(rule);

  if (weekly !== null) {
    return { kind: "weekdays", days: [...new Set(weekly[1]!.split(",").map(Number))].sort((a, b) => a - b) };
  }

  const interval = /^([1-9]\d{0,2})([mhdwM])$/.exec(rule);

  if (interval !== null) {
    return { kind: "interval", every: Number(interval[1]), unit: interval[2] as "m" | "h" | "d" | "w" | "M" };
  }

  return null;
}

/**
 * Writes a repeat rule in its stored form.
 *
 * @param rule The rule.
 * @returns The stored rule, or `null` when it can't repeat (no weekdays picked).
 */
export function encodeRule(rule: TRule): string | null {
  if (rule.kind === "interval") {
    return `${Math.min(Math.max(Math.trunc(rule.every), 1), MAX_INTERVAL)}${rule.unit}`;
  }

  const days = [...new Set(rule.days)].filter(day => day >= 0 && day <= 6).sort((a, b) => a - b);

  if (days.length === 0) {
    return null;
  }

  return days.join(",") === WORKDAYS.join(",") ? "wd" : `w:${days.join(",")}`;
}


type TInterval = Extract<TRule, { kind: "interval" }>;
type TDue = ReturnType<typeof parseDue>;

/** The units that count on the clock rather than the calendar, in milliseconds. */
const CLOCK_UNITS: Partial<Record<TInterval["unit"], number>> = { m: 60_000, h: 3_600_000 };

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
}

// The first allowed weekday after the due date (or today) that hasn't gone yet.
function nextWeekday(days: ReadonlyArray<number>, base: TDue | null, now: Date): string {
  let date = base?.date ?? now;

  do {
    date = addDays(date, 1);
  } while (!days.includes(date.getDay()) || date.getTime() <= now.getTime());

  return toDue(date, base?.hasTime ?? false);
}

// The first step of the interval after the due date (or now) that's later than now.
// Steps already gone are skipped in one go, so "every minute" a year late doesn't loop.
function nextInterval(rule: TInterval, base: TDue | null, now: Date): string {
  const start = base?.date ?? now;
  const unitMs = CLOCK_UNITS[rule.unit];

  if (unitMs !== undefined) {
    // Minutes and hours need a time; a date-only to-do starts from 9:00.
    if (base !== null && !base.hasTime) {
      start.setHours(9, 0, 0, 0);
    }

    const step = rule.every * unitMs;
    const steps = Math.max(1, Math.floor((now.getTime() - start.getTime()) / step) + 1);

    return toDue(new Date(start.getTime() + steps * step), true);
  }

  // Days, weeks and months count on the calendar from the original date, so the 31st doesn't drift to the 28th.
  // The whole steps that fit before today land on today at the latest, so one more step is always enough.
  const monthly = rule.unit === "M";
  const size = monthly ? rule.every : rule.every * (rule.unit === "w" ? 7 : 1);
  const add = monthly ? addMonths : addDays;
  const steps = Math.max(1, Math.floor((monthly ? monthsBetween(start, now) : daysBetween(start, now)) / size));
  const next = add(start, steps * size);

  return toDue(next.getTime() > now.getTime() ? next : add(start, (steps + 1) * size), base?.hasTime ?? false);
}

/**
 * Finds when a repeating to-do is due next, after it's checked off. The
 * schedule is kept (every Monday stays on Mondays) and skips ahead past
 * occurrences already gone, so an overdue daily task comes back tomorrow,
 * not several times today.
 *
 * @param rule The stored repeat rule.
 * @param due The current due value, or `null` to start from now.
 * @param now The current moment.
 * @returns The next due value, or `null` when the rule isn't valid.
 */
export function nextOccurrence(rule: string, due: string | null, now: Date): string | null {
  const parsed = parseRule(rule);

  if (parsed === null) {
    return null;
  }

  const base = due === null ? null : parseDue(due);

  return parsed.kind === "weekdays" ? nextWeekday(parsed.days, base, now) : nextInterval(parsed, base, now);
}

/**
 * The first due date for a to-do that starts repeating without a date:
 * today when the rule allows it, or the first time it would come up.
 *
 * @param repeat The stored repeat rule.
 * @param now The current moment.
 * @returns The due value, or `null` when the rule isn't valid.
 */
export function firstOccurrence(repeat: string, now: Date): string | null {
  const rule = parseRule(repeat);

  if (rule === null) {
    return null;
  }

  if (rule.kind === "weekdays") {
    return rule.days.includes(now.getDay()) ? toDue(now, false) : nextOccurrence(repeat, toDue(now, false), now);
  }

  return CLOCK_UNITS[rule.unit] === undefined ? toDue(now, false) : nextOccurrence(repeat, null, now);
}
