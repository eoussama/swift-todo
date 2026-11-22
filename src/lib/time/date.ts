/**
 * Due dates are local wall-clock values, `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`,
 * with no time zone: "3 pm" stays 3 pm wherever you are. These helpers turn
 * them into local `Date`s and back.
 */

/** Hour a date-only to-do reminds at, and counts as "due" from, in local time. */
export const DAY_START_HOUR = 9;

const MINUTE = 60_000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Formats a local date as `YYYY-MM-DD`.
 *
 * @param date The date, read in local time.
 * @returns The date string.
 */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Formats a local date as a due value, with or without its time.
 *
 * @param date The date, read in local time.
 * @param withTime Whether to keep the hours and minutes.
 * @returns `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`.
 */
export function toDue(date: Date, withTime: boolean): string {
  return withTime ? `${toDateString(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}` : toDateString(date);
}

/**
 * Writes a due value for a day at a clock time, from the numbers rather than
 * a `Date`, so a time that a daylight-saving change skips (2:30 on the night
 * clocks go forward) stays as chosen instead of becoming 3:30 for good.
 *
 * @param day The day, read in local time.
 * @param hours The hour; 24 and over roll into the next day.
 * @param minutes The minutes.
 * @returns The due value, `YYYY-MM-DDTHH:MM`.
 */
export function atTime(day: Date, hours: number, minutes: number): string {
  return `${toDateString(addDays(startOfDay(day), Math.floor(hours / 24)))}T${pad(hours % 24)}:${pad(minutes)}`;
}

/**
 * Reads a due value as a local date.
 *
 * @param due `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`.
 * @returns The local date (midnight when there's no time) and whether a time was given.
 */
export function parseDue(due: string): { date: Date; hasTime: boolean } {
  // Splitting always gives at least one part.
  const [day, time] = due.split("T") as [string, string | undefined];
  const [year = 0, month = 1, dayOfMonth = 1] = day.split("-").map(Number);
  const [hours = 0, minutes = 0] = time === undefined ? [] : time.split(":").map(Number);

  return { date: new Date(year, month - 1, dayOfMonth, hours, minutes), hasTime: time !== undefined };
}

/**
 * The moment a to-do is due: its time, or the start of the day for date-only ones.
 *
 * @param due The due value.
 * @returns Milliseconds since the epoch.
 */
export function dueInstant(due: string): number {
  const { date, hasTime } = parseDue(due);

  if (!hasTime) {
    date.setHours(DAY_START_HOUR, 0, 0, 0);
  }

  return date.getTime();
}

/**
 * Local midnight at the start of a date.
 *
 * @param date Any moment of the day.
 * @returns A new date at 00:00 local time.
 */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Adds days in local calendar terms, so daylight-saving changes don't shift the clock time.
 *
 * @param date The start.
 * @param days How many days to add (may be negative).
 * @returns A new date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
}

/**
 * Adds months, keeping the day of the month when possible and using the
 * month's last day otherwise (Jan 31 + 1 month = Feb 28 or 29).
 *
 * @param date The start.
 * @param months How many months to add.
 * @returns A new date.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();

  result.setDate(Math.min(day, lastDay));

  return result;
}

/**
 * Whole calendar days from `from` to `to` (negative when `to` is earlier).
 *
 * @param from The first date.
 * @param to The second date.
 * @returns The day difference.
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / (24 * 60 * MINUTE));
}

/**
 * Whether a to-do is overdue: a date-only one once its day has passed, a timed one once its time has.
 *
 * @param due The due value.
 * @param now The current moment.
 * @returns Whether it's overdue.
 */
export function isOverdue(due: string, now: Date): boolean {
  const { date, hasTime } = parseDue(due);

  return hasTime ? date.getTime() < now.getTime() : date.getTime() < startOfDay(now).getTime();
}

/**
 * Whether a to-do is due today (or already overdue) in local time.
 *
 * @param due The due value.
 * @param now The current moment.
 * @returns Whether it's due today or earlier.
 */
export function isDueByToday(due: string, now: Date): boolean {
  return parseDue(due).date.getTime() < addDays(startOfDay(now), 1).getTime();
}

/**
 * The next local time `HH:MM` occurs after a moment.
 *
 * @param time `HH:MM`.
 * @param now The current moment.
 * @returns Milliseconds since the epoch, later than `now`.
 */
export function nextTimeOfDay(time: string, now: Date): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

  return (candidate.getTime() > now.getTime() ? candidate : addDays(candidate, 1)).getTime();
}
