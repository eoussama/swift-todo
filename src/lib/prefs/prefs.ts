import { isObject } from "@eoussama/core";



export const SKINS = ["notepad", "sticky", "chalk", "minimal", "scroll"] as const;
export type TSkin = (typeof SKINS)[number];

export const ACCENTS = ["mint", "sky", "coral", "violet", "amber", "rose", "teal", "ink"] as const;
export type TAccent = (typeof ACCENTS)[number];

export const THEMES = ["system", "light", "dark"] as const;
export type TTheme = (typeof THEMES)[number];

/** What the toolbar badge counts. */
export const BADGE_MODES = ["due", "open", "off"] as const;
export type TBadgeMode = (typeof BADGE_MODES)[number];

/** Settings shared by every device through sync. */
export type TPrefs = {
  skin: TSkin;
  accent: TAccent;
  theme: TTheme;
  /** Due reminders on or off. Each device still needs the notifications permission. */
  reminders: boolean;
  /** Minutes before the due time to remind, 0 for "at due time". */
  lead: number;
  /** Daily digest time as `HH:MM`, or `null` for off. */
  digest: string | null;
  /** Gentle reminders about overdue to-dos, at most every few hours. */
  nudges: boolean;
  badge: TBadgeMode;
  /** Default focus timer length, in minutes. */
  timer: number;
};

export const DEFAULT_PREFS: Readonly<TPrefs> = Object.freeze({
  skin: "notepad",
  accent: "mint",
  theme: "system",
  reminders: false,
  lead: 0,
  digest: null,
  nudges: false,
  badge: "due",
  timer: 25,
});

export const LEAD_OPTIONS = [0, 5, 10, 15, 30, 60] as const;
export const TIMER_OPTIONS = [5, 15, 25, 50] as const;
export const MAX_TIMER_MINUTES = 180;

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function oneOf<T extends string>(options: ReadonlyArray<T>, value: unknown, fallback: T): T {
  return (options as ReadonlyArray<unknown>).includes(value) ? value as T : fallback;
}

function wholeNumber(value: unknown, min: number, max: number, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? value as number : fallback;
}

/**
 * Reads the stored settings, using the default for anything missing or malformed.
 *
 * @param value The stored value.
 * @returns Complete settings.
 */
export function parsePrefs(value: unknown): TPrefs {
  const raw = isObject(value) ? value : {};

  return {
    skin: oneOf(SKINS, raw.skin, DEFAULT_PREFS.skin),
    accent: oneOf(ACCENTS, raw.accent, DEFAULT_PREFS.accent),
    theme: oneOf(THEMES, raw.theme, DEFAULT_PREFS.theme),
    reminders: typeof raw.reminders === "boolean" ? raw.reminders : DEFAULT_PREFS.reminders,
    lead: wholeNumber(raw.lead, 0, 1440, DEFAULT_PREFS.lead),
    digest: typeof raw.digest === "string" && TIME_PATTERN.test(raw.digest) ? raw.digest : DEFAULT_PREFS.digest,
    nudges: typeof raw.nudges === "boolean" ? raw.nudges : DEFAULT_PREFS.nudges,
    badge: oneOf(BADGE_MODES, raw.badge, DEFAULT_PREFS.badge),
    timer: wholeNumber(raw.timer, 1, MAX_TIMER_MINUTES, DEFAULT_PREFS.timer),
  };
}

/**
 * Applies a change to the stored settings, keeping fields this version
 * doesn't know so a newer version's settings survive.
 *
 * @param stored The stored value, possibly from a newer version.
 * @param patch The settings to change.
 * @returns The value to store.
 */
export function mergePrefs(stored: unknown, patch: Partial<TPrefs>): Record<string, unknown> {
  const raw = isObject(stored) ? stored : {};

  return { ...raw, ...parsePrefs({ ...raw, ...patch }) };
}
