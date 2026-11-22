import type { TRule } from "./recur";

import { addDays, addMonths, atTime, startOfDay, toDue } from "./date";
import { anchorRule, encodeRule, firstOccurrence } from "./recur";



/** What the parser understood: the text without the date words, and the due date and repeat rule found. */
export type TParsed = {
  text: string;
  due: string | null;
  repeat: string | null;
};

const WEEKDAY_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const FULL_WEEKDAY = "sunday|monday|tuesday|wednesday|thursday|friday|saturday";
const ANY_WEEKDAY = "sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?";
const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const UNIT = "min(?:ute)?s?|h(?:ou)?rs?|days?|weeks?|months?";
const PREFIX = "(?:(?:on|by|due|this)\\s+)?";
const SHORT_WEEKDAY = "sun|mon|tues?|wed|thu(?:rs?)?|fri|sat";

/**
 * Where a loose date or time word reads as one: at the end, before punctuation
 * or a #tag, or before another date or time. "Water plants daily" and "rest in
 * 2 days" are dates; "cancel monthly subscription" and "put in 10 hours of
 * practice" aren't.
 */
const THEN = `(?=\\s*(?:$|[\\d,;!?)#]|\\.(?!\\d)|(?:at|today|tonight|tomorrow|tmrw?|on|next|this|every|in|by|due|${FULL_WEEKDAY}|${SHORT_WEEKDAY}|${MONTH})\\b))`;

function weekdayIndex(word: string): number {
  return WEEKDAY_SHORT.indexOf(word.toLowerCase().slice(0, 3));
}

function monthIndex(word: string): number {
  return MONTH_NAMES.indexOf(word.toLowerCase().slice(0, 3));
}

function unitCode(word: string): "m" | "h" | "d" | "w" | "M" {
  const lower = word.toLowerCase();

  if (lower.startsWith("min")) {
    return "m";
  }

  if (lower.startsWith("h")) {
    return "h";
  }

  if (lower.startsWith("d")) {
    return "d";
  }

  return lower.startsWith("w") ? "w" : "M";
}

type TMatch = { start: number; end: number };

// Finds the first match of a pattern in text not already consumed, and marks it consumed.
function take(text: string, used: Array<TMatch>, pattern: RegExp): RegExpExecArray | null {
  const global = new RegExp(pattern.source, `${pattern.flags}g`);

  for (const match of text.matchAll(global)) {
    const start = match.index;
    const end = start + match[0].length;

    // Every pattern starts and ends on a word boundary, so two matches never touch and `<` or `<=` agree.
    // Stryker disable next-line EqualityOperator: matches never touch, see above.
    if (!used.some(range => start < range.end && end > range.start)) {
      used.push({ start, end });

      return match as unknown as RegExpExecArray;
    }
  }

  return null;
}

function nextWeekday(day: number, today: Date, skipToday: boolean): Date {
  let offset = (day - today.getDay() + 7) % 7;

  if (offset === 0 && skipToday) {
    offset = 7;
  }

  return addDays(today, offset);
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day);

  // A day past the month's end (or 0) rolls into another month, so the month alone tells.
  return date.getMonth() === month ? date : null;
}

function parseRepeat(text: string, used: Array<TMatch>): TRule | null {
  let match = take(text, used, new RegExp(`\\bevery\\s+(\\d{1,3})\\s+(${UNIT})\\b`, "i"));

  if (match !== null) {
    return { kind: "interval", every: Number(match[1]), unit: unitCode(match[2]!) };
  }

  match = take(text, used, /\b(?:every\s+weekdays?|weekdays)\b/i);

  if (match !== null) {
    return { kind: "weekdays", days: [1, 2, 3, 4, 5] };
  }

  match = take(text, used, new RegExp(`\\bevery\\s+((?:${ANY_WEEKDAY})(?:\\s*(?:,|and|&)\\s*(?:${ANY_WEEKDAY}))*)\\b`, "i"));

  if (match !== null) {
    const days = [...match[1]!.matchAll(new RegExp(ANY_WEEKDAY, "gi"))].map(day => weekdayIndex(day[0]));

    return { kind: "weekdays", days };
  }

  match = take(text, used, /\bevery\s+(min(?:ute)?|hour|day|week|month)\b/i);

  if (match !== null) {
    return { kind: "interval", every: 1, unit: unitCode(match[1]!) };
  }

  match = take(text, used, new RegExp(`\\b(hourly|daily|weekly|monthly)\\b${THEN}`, "i"));

  if (match !== null) {
    return { kind: "interval", every: 1, unit: ({ hourly: "h", daily: "d", weekly: "w", monthly: "M" } as const)[match[1]!.toLowerCase() as "daily"] };
  }

  return null;
}

/**
 * A time of day; `stated` when am/pm (or noon, midnight) says which half of
 * the day it is, and `typed` the hour as written, before any guess at the half.
 */
type TTime = { hours: number; minutes: number; stated: boolean; typed: number };

function parseTime(text: string, used: Array<TMatch>): TTime | null {
  let match = take(text, used, /\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);

  if (match !== null) {
    const hours = Number(match[1]) % 12 + (match[3]!.toLowerCase() === "pm" ? 12 : 0);

    return { hours, minutes: Number(match[2] ?? 0), stated: true, typed: hours };
  }

  // "At 9:30" or "09:30"; a bare "3:16" may be a verse or a score, not a time.
  match = take(text, used, /\b(?:at\s+([01]?\d|2[0-3])|([01]\d|2[0-3])):([0-5]\d)\b/i);

  if (match !== null) {
    const hours = Number(match[1] ?? match[2]);

    return { hours, minutes: Number(match[3]), stated: false, typed: hours };
  }

  // Only where it reads as a time: at the end, before punctuation, or before a date ("look at 3 options" isn't one).
  match = take(text, used, new RegExp(`\\bat\\s+([01]?\\d|2[0-3])\\b${THEN}`, "i"));

  if (match !== null) {
    const hour = Number(match[1]);

    // "Meet at 5" almost always means the afternoon.
    return { hours: hour >= 1 && hour <= 7 ? hour + 12 : hour, minutes: 0, stated: false, typed: hour };
  }

  match = take(text, used, /\b(?:at\s+)?(noon|midnight)\b/i);

  if (match === null) {
    return null;
  }

  const hours = match[1]!.toLowerCase() === "noon" ? 12 : 0;

  return { hours, minutes: 0, stated: true, typed: hours };
}

/** Hours before this, said with "tonight", are after midnight: the next day. */
const NIGHT_ENDS = 6;

/**
 * Reads an hour said with "tonight", which runs into the small hours. "Tonight
 * at 9" is 9 in the evening; "at 2" or "at 1am" is after midnight, the next
 * day; midnight or a plain "12" ends the night. A time on the 24-hour clock,
 * or an am/pm from 6 on, is taken as written.
 *
 * @param time The time as read.
 * @returns The hour on tonight's date; 24 and over roll into the next day.
 */
function tonightHours(time: TTime): number {
  const hour = time.stated ? time.hours : time.typed === 12 ? 0 : time.typed;

  if (hour < NIGHT_ENDS) {
    return hour + 24;
  }

  // Stryker disable next-line EqualityOperator: a plain 12 was taken as midnight above, so < and <= read the same hours.
  return !time.stated && hour < 12 ? hour + 12 : hour;
}

function parseDate(text: string, used: Array<TMatch>, now: Date): { date: Date; timed: boolean; tonight: boolean } | null {
  const today = startOfDay(now);
  let match = take(text, used, new RegExp(`\\bin\\s+(\\d{1,3})\\s+(${UNIT})\\b${THEN}`, "i"));

  if (match !== null) {
    const amount = Number(match[1]);
    const unit = unitCode(match[2]!);

    if (unit === "m" || unit === "h") {
      return { date: new Date(now.getTime() + amount * (unit === "m" ? 60_000 : 3_600_000)), timed: true, tonight: false };
    }

    return { date: unit === "M" ? addMonths(today, amount) : addDays(today, amount * (unit === "w" ? 7 : 1)), timed: false, tonight: false };
  }

  match = take(text, used, /\b(today|tonight)\b/i);

  if (match !== null) {
    return { date: today, timed: false, tonight: match[1]!.toLowerCase() === "tonight" };
  }

  match = take(text, used, /\b(tomorrow|tmrw?)\b/i);

  if (match !== null) {
    return { date: addDays(today, 1), timed: false, tonight: false };
  }

  match = take(text, used, /\bnext\s+week\b/i);

  if (match !== null) {
    return { date: addDays(today, 7), timed: false, tonight: false };
  }

  match = take(text, used, /\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (match !== null) {
    const date = validDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

    if (date !== null) {
      return { date, timed: false, tonight: false };
    }

    // Not a real date ("2026-02-30"): leave the words in the text.
    used.pop();
  }

  match = take(text, used, new RegExp(`\\b${PREFIX}(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"))
    ?? take(text, used, new RegExp(`\\b${PREFIX}(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})(?:,?\\s+(\\d{4}))?\\b`, "i"));

  if (match !== null) {
    const monthFirst = Number.isNaN(Number(match[1]));
    const month = monthIndex(monthFirst ? match[1]! : match[2]!);
    const day = Number(monthFirst ? match[2] : match[1]);
    const year = match[3] === undefined ? today.getFullYear() : Number(match[3]);
    let date = validDate(year, month, day);

    // No year given and already past this year: next year.
    if (date !== null && match[3] === undefined && date.getTime() < today.getTime()) {
      date = validDate(year + 1, month, day);
    }

    if (date !== null) {
      return { date, timed: false, tonight: false };
    }

    used.pop();
  }

  // Full weekday names anywhere; short ones only after on/next/this/by/due ("sun" is also a word).
  match = take(text, used, new RegExp(`\\b(next|on|this|by|due)\\s+((?:${FULL_WEEKDAY})\\b|(?:${SHORT_WEEKDAY})\\b${THEN})`, "i"));

  if (match !== null) {
    return { date: nextWeekday(weekdayIndex(match[2]!), today, match[1]!.toLowerCase() === "next"), timed: false, tonight: false };
  }

  match = take(text, used, new RegExp(`\\b(${FULL_WEEKDAY})\\b`, "i"));

  if (match !== null) {
    return { date: nextWeekday(weekdayIndex(match[1]!), today, false), timed: false, tonight: false };
  }

  return null;
}

function cleanUp(text: string, used: ReadonlyArray<TMatch>): string {
  let result = "";
  let last = 0;

  for (const range of [...used].sort((a, b) => a.start - b.start)) {
    result += `${text.slice(last, range.start)} `;
    last = range.end;
  }

  result += text.slice(last);

  return result
    .replace(/\s+/g, " ")
    .replace(/(?:^|\s)(?:at|on|by|due|every|from)(?=\s*$)/i, "")
    .replace(/ ([,.;:!?])/g, "$1")
    .replace(/[\s,;:-]+$/, "")
    .trim();
}

/**
 * Finds a due date, time and repeat rule in a to-do as typed, like
 * "call Sam tomorrow 3pm" or "water plants every 3 days", and removes them
 * from the text. English only, like the rest of the UI.
 *
 * @param input The to-do as typed.
 * @param now The current moment, to resolve "tomorrow" and friends.
 * @returns The text and what was found; nothing is found when it would leave no text.
 */
export function parseTodo(input: string, now: Date): TParsed {
  const used: Array<TMatch> = [];
  const rule = parseRepeat(input, used);
  const date = parseDate(input, used, now);
  const time = parseTime(input, used);
  const text = cleanUp(input, used);
  const nothing: TParsed = { text: input.trim(), due: null, repeat: null };

  if (text.length === 0 || used.length === 0) {
    return nothing;
  }

  let due: string | null = null;

  if (date !== null) {
    if (time !== null) {
      due = atTime(date.date, date.tonight ? tonightHours(time) : time.hours, time.minutes);
    }
    else {
      due = date.tonight ? atTime(date.date, 20, 0) : toDue(date.date, date.timed);
    }
  }
  else if (time !== null) {
    // A time alone: today if it's still ahead, otherwise tomorrow,
    // moved to the first allowed day for a weekday repeat.
    let result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hours, time.minutes);

    if (result.getTime() <= now.getTime()) {
      result = addDays(result, 1);
    }

    while (rule?.kind === "weekdays" && !rule.days.includes(result.getDay())) {
      result = addDays(result, 1);
    }

    due = atTime(result, time.hours, time.minutes);
  }

  if (rule === null) {
    return { text, due, repeat: null };
  }

  // The parser's rules always have a day to repeat on, so they always encode.
  const repeat = encodeRule(rule)!;

  // A repeat alone starts on its first day; a monthly one remembers its day of the month.
  const first = due ?? firstOccurrence(repeat, now);

  return { text, due: first, repeat: anchorRule(repeat, first)! };
}
