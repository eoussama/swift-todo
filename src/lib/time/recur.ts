import { addDays, addMonths, daysBetween, parseDue, startOfDay, toDateString, toDue } from "./date";



/**
 * A repeat rule, stored compactly on the to-do:
 * - `<n><unit>`: every n minutes (`m`), hours (`h`), days (`d`), weeks (`w`) or months (`M`);
 * - `<n>M@<day>`: every n months on the 29th, 30th or 31st, or the month's last day when it's shorter;
 * - `wd`: every weekday, Monday to Friday;
 * - `w:<days>`: on given weekdays, `0` (Sunday) to `6` (Saturday), comma-separated.
 */
export type TRule
  = | { kind: "interval"; every: number; unit: "m" | "h" | "d" | "w" | "M"; day?: number }
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

  const monthly = /^([1-9]\d{0,2})M@(29|30|31)$/.exec(rule);

  if (monthly !== null) {
    return { kind: "interval", every: Number(monthly[1]), unit: "M", day: Number(monthly[2]) };
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
    // Only months take a day, and only the days a short month can cut.
    const day = rule.unit === "M" ? rule.day ?? 0 : 0;

    return `${Math.min(Math.max(Math.trunc(rule.every), 1), MAX_INTERVAL)}${rule.unit}${day >= 29 && day <= 31 ? `@${day}` : ""}`;
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

// A day with the to-do's clock time, written as text ("THH:MM", or "" for a date-only one), so the
// time stays as chosen across daylight-saving changes instead of following a shifted Date.
function dueOn(date: Date, time: string): string {
  return `${toDateString(date)}${time}`;
}

function instantOf(date: Date, time: string): number {
  return parseDue(dueOn(date, time)).date.getTime();
}

// The first allowed weekday after the due date (or today) that hasn't gone yet.
function nextWeekday(days: ReadonlyArray<number>, base: TDue | null, time: string, now: Date): string {
  let date = startOfDay(base?.date ?? now);

  do {
    date = addDays(date, 1);
  } while (!days.includes(date.getDay()) || instantOf(date, time) <= now.getTime());

  return dueOn(date, time);
}

// The first step of the interval after the due date (or now) that's later than now.
// Steps already gone are skipped in one go, so "every minute" a year late doesn't loop.
function nextInterval(rule: TInterval, base: TDue | null, time: string, now: Date): string {
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

  // Days, weeks and months count on the calendar. A month too short for the
  // day lands on its last day, and a rule with a day ("1M@31") goes back to it
  // the month after, so the 31st doesn't drift to the 28th for good.
  // The whole steps that fit before today land on today at the latest, so one more step is always enough.
  const day = startOfDay(start);
  const monthly = rule.unit === "M";
  const size = monthly ? rule.every : rule.every * (rule.unit === "w" ? 7 : 1);
  const stepTo = (count: number): Date => {
    if (!monthly) {
      return addDays(day, count * size);
    }

    const date = addMonths(day, count * size);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    return rule.day === undefined ? date : new Date(date.getFullYear(), date.getMonth(), Math.min(rule.day, last));
  };
  const steps = Math.max(1, Math.floor((monthly ? monthsBetween(day, now) : daysBetween(day, now)) / size));
  const next = stepTo(steps);

  return dueOn(instantOf(next, time) > now.getTime() ? next : stepTo(steps + 1), time);
}

/**
 * A rule without the day a monthly one repeats on ("1M@31" is "1M"), as the
 * repeat choices show it.
 *
 * @param repeat The stored rule, or `null`.
 * @returns The rule without its day.
 */
export function baseRule(repeat: string | null): string | null {
  // Stryker disable next-line Regex: a rule's day is always last.
  return repeat === null ? null : repeat.replace(/@\d+$/, "");
}

/**
 * Gives a monthly rule the day it repeats on, taken from its due date when
 * that's the 29th, 30th or 31st, so short months don't move it for good.
 * When neither the rule nor the date changed, the day it had stays: a
 * February due date isn't the day it repeats on.
 *
 * @param repeat The rule being saved, or `null`.
 * @param due The due date being saved, or `null`.
 * @param before The rule and date it had, when it's an edit.
 * @param before.repeat Its rule before.
 * @param before.due Its due date before.
 * @returns The rule to store.
 */
export function anchorRule(repeat: string | null, due: string | null, before?: { repeat: string | null; due: string | null }): string | null {
  // Stryker disable next-line ConditionalExpression: parseRule doesn't read null as a rule either.
  const rule = repeat === null ? null : parseRule(repeat);

  // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement: encodeRule gives other rules back as they are; this only spares the work.
  if (rule?.kind !== "interval" || rule.unit !== "M") {
    return repeat;
  }

  if (before !== undefined && before.due === due && baseRule(before.repeat) === baseRule(repeat)) {
    return before.repeat;
  }

  const day = due === null ? 0 : parseDue(due).date.getDate();

  // encodeRule keeps only the 29th to the 31st.
  return encodeRule({ ...rule, day });
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
  // The clock time as written ("T02:30"), kept as it is on the next date.
  const time = base?.hasTime === true ? due!.slice(10) : "";

  return parsed.kind === "weekdays" ? nextWeekday(parsed.days, base, time, now) : nextInterval(parsed, base, time, now);
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
