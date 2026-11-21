import type { TRule } from "./recur";

import { i18n } from "#i18n";

import { addDays, daysBetween, isOverdue, parseDue, startOfDay } from "./date";
import { parseRule } from "./recur";



export type TDueLabel = {
  /** Short label: "Today", "Tomorrow 3:00 PM", "Tue", "Nov 24". */
  label: string;
  overdue: boolean;
  /** Due today (or overdue), for the Today view and highlighting. */
  soon: boolean;
};

/**
 * Describes a due date for a row's chip.
 *
 * @param due The due value.
 * @param now The current moment.
 * @param locale The locale for weekday, month and time names; the browser's by default.
 * @returns The label and its state.
 */
export function formatDue(due: string, now: Date, locale?: string): TDueLabel {
  const { date, hasTime } = parseDue(due);
  const days = daysBetween(now, date);
  let day: string;

  if (days === 0) {
    day = i18n.t("due.today");
  }
  else if (days === 1) {
    day = i18n.t("due.tomorrow");
  }
  else if (days === -1) {
    day = i18n.t("due.yesterday");
  }
  else if (days > 1 && days < 7) {
    day = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  }
  else {
    const sameYear = date.getFullYear() === now.getFullYear();

    day = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(date);
  }

  const time = hasTime ? ` ${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date)}` : "";

  return {
    label: `${day}${time}`,
    overdue: isOverdue(due, now),
    soon: date.getTime() < addDays(startOfDay(now), 1).getTime(),
  };
}

/**
 * Lists weekday names in locale order, Sunday first.
 *
 * @param locale The locale; the browser's by default.
 * @param style Short ("Mon") or long ("Monday") names.
 * @returns Seven names, index 0 being Sunday.
 */
export function weekdayNames(locale?: string, style: "short" | "long" = "short"): Array<string> {
  // Jan 4, 1970 was a Sunday.
  return Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(1970, 0, 4 + day))));
}

/**
 * Describes a repeat rule: "Every day", "Every 2 hours", "Every weekday", "Every Mon, Wed".
 *
 * @param rule The stored rule, or a parsed one.
 * @param locale The locale for weekday names.
 * @returns The description, or an empty string for an invalid rule.
 */
export function formatRule(rule: string | TRule, locale?: string): string {
  const parsed = typeof rule === "string" ? parseRule(rule) : rule;

  if (parsed === null) {
    return "";
  }

  if (parsed.kind === "weekdays") {
    if (parsed.days.join(",") === "1,2,3,4,5") {
      return i18n.t("repeat.weekdays");
    }

    const names = weekdayNames(locale);

    return i18n.t("repeat.on", [parsed.days.map(day => names[day]).join(", ")]);
  }

  const key = ({ m: "repeat.minutes", h: "repeat.hours", d: "repeat.days", w: "repeat.weeks", M: "repeat.months" } as const)[parsed.unit];

  return i18n.t(key, parsed.every);
}
