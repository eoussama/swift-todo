import type { TBadgeMode, TPrefs } from "../prefs/prefs";
import type { TTodo } from "../todos/model";

import { isObject } from "@eoussama/core";

import { addDays, dueInstant, isDueByToday, isOverdue, parseDue, startOfDay } from "./date";



/** What the reminder engine remembers on this device. */
export type TReminderState = {
  /** To-dos already reminded about, with the due value they were reminded for. */
  notified: Record<string, string>;
  /** Snoozed to-dos and when to remind again (ms). */
  snoozed: Record<string, number>;
  /** When the last overdue nudge was shown (ms). */
  lastNudge: number;
};

export const EMPTY_REMINDER_STATE: Readonly<TReminderState> = Object.freeze({ notified: {}, snoozed: {}, lastNudge: 0 });

/** Reminders later than this are skipped; overdue nudges cover them instead of a flood. */
export const MAX_LATE_MS = 24 * 60 * 60 * 1000;

/** Minimum time between two overdue nudges. */
export const NUDGE_INTERVAL_MS = 3 * 60 * 60 * 1000;

/** Nudges only show during the day, local time. */
export const NUDGE_HOURS = { from: 9, to: 21 } as const;

export const SNOOZE_MS = 10 * 60 * 1000;

/**
 * Reads the stored reminder state, dropping anything malformed.
 *
 * @param value The stored value.
 * @returns The state.
 */
export function parseReminderState(value: unknown): TReminderState {
  const raw = isObject(value) ? value : {};
  const notified: Record<string, string> = {};
  const snoozed: Record<string, number> = {};

  if (isObject(raw.notified)) {
    for (const [id, due] of Object.entries(raw.notified)) {
      if (typeof due === "string") {
        notified[id] = due;
      }
    }
  }

  if (isObject(raw.snoozed)) {
    for (const [id, until] of Object.entries(raw.snoozed)) {
      if (typeof until === "number") {
        snoozed[id] = until;
      }
    }
  }

  return { notified, snoozed, lastNudge: typeof raw.lastNudge === "number" ? raw.lastNudge : 0 };
}

/**
 * When to remind about a to-do: its due time minus the lead time, or the snooze time.
 *
 * @param todo The to-do.
 * @param lead Minutes before the due time.
 * @param state The reminder state.
 * @returns Milliseconds since the epoch, or `null` when it has nothing to remind about.
 */
export function reminderAt(todo: Pick<TTodo, "id" | "done" | "due">, lead: number, state: TReminderState): number | null {
  if (todo.done || todo.due === null) {
    return null;
  }

  return state.snoozed[todo.id] ?? dueInstant(todo.due) - lead * 60_000;
}

export type TReminderPlan = {
  /** To-dos to remind about now. */
  fire: Array<TTodo>;
  /** When the next reminder is due, if any. */
  next: number | null;
  /** The state to save: fired reminders marked, stale entries dropped. */
  state: TReminderState;
};

/**
 * Decides which reminders to show now and when the next one is due. Each
 * to-do is reminded once per due date; snoozing reminds again later.
 *
 * @param todos All to-dos.
 * @param prefs The settings (lead time).
 * @param state The reminder state.
 * @param now The current moment.
 * @returns What to show, when to wake up next, and the new state.
 */
export function planReminders(todos: ReadonlyArray<TTodo>, prefs: Pick<TPrefs, "lead">, state: TReminderState, now: Date): TReminderPlan {
  const fire: Array<TTodo> = [];
  const notified: Record<string, string> = {};
  const snoozed: Record<string, number> = {};
  let next: number | null = null;

  for (const todo of todos) {
    const at = reminderAt(todo, prefs.lead, state);

    if (at === null) {
      continue;
    }

    const isSnoozed = todo.id in state.snoozed;
    const alreadyShown = !isSnoozed && state.notified[todo.id] === todo.due;

    if (alreadyShown) {
      notified[todo.id] = todo.due!;
      continue;
    }

    if (at <= now.getTime()) {
      // Too late to be useful; overdue nudges take it from here.
      if (now.getTime() - at <= MAX_LATE_MS) {
        fire.push(todo);
      }

      notified[todo.id] = todo.due!;
    }
    else {
      if (isSnoozed) {
        snoozed[todo.id] = at;
      }

      next = next === null ? at : Math.min(next, at);
    }
  }

  return { fire, next, state: { notified, snoozed, lastNudge: state.lastNudge } };
}

export type TBadge = {
  /** Text for the toolbar badge; empty hides it. */
  text: string;
  /** Something is overdue, so the badge turns coral. */
  alert: boolean;
};

/**
 * Works out the toolbar badge.
 *
 * @param todos All to-dos.
 * @param mode What to count: due today and overdue, all open, or nothing.
 * @param now The current moment.
 * @returns The badge text and whether something is overdue.
 */
export function badgeFor(todos: ReadonlyArray<TTodo>, mode: TBadgeMode, now: Date): TBadge {
  if (mode === "off") {
    return { text: "", alert: false };
  }

  const open = todos.filter(todo => !todo.done);
  const counted = mode === "open" ? open : open.filter(todo => todo.due !== null && isDueByToday(todo.due, now));
  const alert = open.some(todo => todo.due !== null && isOverdue(todo.due, now));

  return { text: counted.length === 0 ? "" : counted.length > 99 ? "99+" : String(counted.length), alert };
}

/**
 * When the badge can next change on its own, without any edit: when a timed
 * to-do becomes overdue, or at midnight when tomorrow's to-dos become today's.
 *
 * @param todos All to-dos.
 * @param now The current moment.
 * @returns Milliseconds since the epoch.
 */
export function nextBadgeChange(todos: ReadonlyArray<TTodo>, now: Date): number {
  let next = addDays(startOfDay(now), 1).getTime();

  for (const todo of todos) {
    if (!todo.done && todo.due !== null && parseDue(todo.due).hasTime) {
      const at = parseDue(todo.due).date.getTime();

      if (at > now.getTime() && at < next) {
        next = at;
      }
    }
  }

  return next;
}

export type TSummary = { open: number; dueToday: number; overdue: number };

/**
 * Counts open, due-today and overdue to-dos, for the daily digest and nudges.
 *
 * @param todos All to-dos.
 * @param now The current moment.
 * @returns The counts.
 */
export function summarize(todos: ReadonlyArray<TTodo>, now: Date): TSummary {
  const open = todos.filter(todo => !todo.done);
  const overdue = open.filter(todo => todo.due !== null && isOverdue(todo.due, now)).length;
  const dueByToday = open.filter(todo => todo.due !== null && isDueByToday(todo.due, now)).length;

  return { open: open.length, dueToday: dueByToday - overdue, overdue };
}

/**
 * Whether an overdue nudge should show now: something is overdue, it's
 * daytime, and the last nudge was a while ago.
 *
 * @param summary The counts.
 * @param state The reminder state.
 * @param now The current moment.
 * @returns Whether to nudge.
 */
export function shouldNudge(summary: TSummary, state: TReminderState, now: Date): boolean {
  const hour = now.getHours();

  return summary.overdue > 0
    && hour >= NUDGE_HOURS.from && hour < NUDGE_HOURS.to
    && now.getTime() - state.lastNudge >= NUDGE_INTERVAL_MS;
}
