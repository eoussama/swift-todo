// Stands in for the extension's `#i18n` on the website, with the strings the
// date formatter uses (from src/locales/en.yml).

const MESSAGES: Record<string, string | { 1: string; n: string }> = {
  "due.today": "Today",
  "due.tomorrow": "Tomorrow",
  "due.yesterday": "Yesterday",
  "repeat.minutes": { 1: "Every minute", n: "Every $1 minutes" },
  "repeat.hours": { 1: "Every hour", n: "Every $1 hours" },
  "repeat.days": { 1: "Every day", n: "Every $1 days" },
  "repeat.weeks": { 1: "Every week", n: "Every $1 weeks" },
  "repeat.months": { 1: "Every month", n: "Every $1 months" },
  "repeat.weekdays": "Every weekday",
  "repeat.on": "Every $1",
};

export const i18n = {
  /**
   * Looks up a message, like WXT's `i18n.t`.
   *
   * @param key The message key.
   * @param arg A count, for plural messages, or substitutions.
   * @returns The message.
   */
  t(key: string, arg?: number | Array<string>): string {
    const message = MESSAGES[key] ?? key;

    if (typeof message !== "string") {
      return (arg === 1 ? message[1] : message.n).replace("$1", String(arg));
    }

    return Array.isArray(arg) ? message.replace("$1", arg[0] ?? "") : message;
  },
};
