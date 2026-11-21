import { addDays, addMonths, daysBetween, parseDue, startOfDay, toDue } from "./date";



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

// Whether the rule counts in minutes or hours, so the due value needs a time.
function isTimed(rule: TRule): boolean {
  return rule.kind === "interval" && (rule.unit === "m" || rule.unit === "h");
}

function step(date: Date, rule: TRule): Date {
  if (rule.kind === "weekdays") {
    let next = addDays(date, 1);

    while (!rule.days.includes(next.getDay())) {
      next = addDays(next, 1);
    }

    return next;
  }

  if (rule.unit === "m" || rule.unit === "h") {
    return new Date(date.getTime() + rule.every * (rule.unit === "m" ? 60_000 : 3_600_000));
  }

  // Days and weeks; months never get here, since they count from the original date.
  return addDays(date, rule.every * (rule.unit === "w" ? 7 : 1));
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

  const timed = isTimed(parsed);
  const base = due === null ? null : parseDue(due);
  let withTime = base?.hasTime ?? timed;
  let date = base?.date ?? new Date(now);

  // Minutes and hours need a time; a date-only to-do starts from 9:00.
  if (timed && base !== null && !base.hasTime) {
    date.setHours(9, 0, 0, 0);
    withTime = true;
  }

  if (!withTime) {
    date = startOfDay(date);
  }

  const limit = withTime ? now.getTime() : startOfDay(now).getTime();
  const isPast = (candidate: Date): boolean => candidate.getTime() <= limit;

  // Months always count from the original date, so the 31st doesn't drift to the 28th.
  if (parsed.kind === "interval" && parsed.unit === "M") {
    const months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
    let n = Math.max(1, Math.floor(months / parsed.every));
    let candidate = addMonths(date, n * parsed.every);

    while (isPast(candidate)) {
      n += 1;
      candidate = addMonths(date, n * parsed.every);
    }

    return toDue(candidate, withTime);
  }

  date = fastForward(date, parsed, now);

  do {
    date = step(date, parsed);
  } while (isPast(date));

  return toDue(date, withTime);
}

// Skips whole intervals of a long-overdue to-do in one go, so "every minute"
// a year late doesn't loop half a million times. Leaves at least one step to take.
function fastForward(date: Date, rule: TRule, now: Date): Date {
  if (rule.kind !== "interval" || date.getTime() >= now.getTime()) {
    return date;
  }

  if (rule.unit === "m" || rule.unit === "h") {
    const interval = rule.every * (rule.unit === "m" ? 60_000 : 3_600_000);
    const skips = Math.floor((now.getTime() - date.getTime()) / interval) - 1;

    return skips > 0 ? new Date(date.getTime() + skips * interval) : date;
  }

  const days = rule.every * (rule.unit === "w" ? 7 : 1);
  const skips = Math.floor(daysBetween(date, now) / days) - 1;

  return skips > 0 ? addDays(date, skips * days) : date;
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

  return rule.unit === "m" || rule.unit === "h" ? nextOccurrence(repeat, null, now) : toDue(now, false);
}
