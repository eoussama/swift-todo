import { isObject } from "@eoussama/core";

import { MAX_TIMER_MINUTES } from "../prefs/prefs";



/** Where the running focus timer lives: `storage.session`, so it ends with the browser session. */
export const TIMER_KEY = "focus:timer";

export type TTimer = {
  /** When it started and ends, in milliseconds since the epoch. */
  startedAt: number;
  endsAt: number;
  /** The to-do being worked on, if any. */
  todo: string | null;
};

type TSessionArea = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

/**
 * Reads a stored timer, ignoring anything malformed.
 *
 * @param value The stored value.
 * @returns The timer, or `null`.
 */
export function parseTimer(value: unknown): TTimer | null {
  if (!isObject(value) || typeof value.startedAt !== "number" || typeof value.endsAt !== "number" || !(value.endsAt > value.startedAt)) {
    return null;
  }

  return { startedAt: value.startedAt, endsAt: value.endsAt, todo: typeof value.todo === "string" ? value.todo : null };
}

/**
 * Creates a timer.
 *
 * @param minutes Its length, clamped to 1–{@link MAX_TIMER_MINUTES}.
 * @param todo The to-do being worked on, if any.
 * @param now When it starts.
 * @returns The timer.
 */
export function createTimer(minutes: number, todo: string | null, now: Date): TTimer {
  const length = Math.min(Math.max(Math.round(minutes), 1), MAX_TIMER_MINUTES);

  return { startedAt: now.getTime(), endsAt: now.getTime() + length * 60_000, todo };
}

/**
 * Time left on a timer.
 *
 * @param timer The timer.
 * @param now The current moment.
 * @returns Milliseconds left, never below zero.
 */
export function remainingMs(timer: TTimer, now: Date): number {
  return Math.max(timer.endsAt - now.getTime(), 0);
}

/**
 * The toolbar badge for a running timer: whole minutes left, rounded up.
 *
 * @param timer The timer.
 * @param now The current moment.
 * @returns For example `25m`.
 */
export function timerBadge(timer: TTimer, now: Date): string {
  return `${Math.ceil(remainingMs(timer, now) / 60_000)}m`;
}

/**
 * Formats time left as a clock.
 *
 * @param ms Milliseconds left.
 * @returns For example `24:59`, or `1:02:00` past an hour.
 */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * Reads the running timer.
 *
 * @param area The session storage area.
 * @returns The timer, or `null`.
 */
export async function readTimer(area: Pick<TSessionArea, "get">): Promise<TTimer | null> {
  return parseTimer((await area.get(TIMER_KEY))[TIMER_KEY]);
}

/**
 * Saves the running timer, or clears it.
 *
 * @param area The session storage area.
 * @param timer The timer, or `null` to stop it.
 * @returns Once saved.
 */
export async function saveTimer(area: TSessionArea, timer: TTimer | null): Promise<void> {
  await (timer === null ? area.remove(TIMER_KEY) : area.set({ [TIMER_KEY]: timer }));
}
