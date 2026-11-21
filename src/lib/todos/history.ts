/**
 * When a repeating to-do was checked off, kept with it so the full view can
 * list them. Only the latest check-offs are kept: a to-do checked off daily
 * would otherwise grow past what browser sync holds for one item.
 */
export const HISTORY_LIMIT = 30;

const MINUTE = 60_000;

/**
 * Stores check-off times compactly: each as minutes since 1970 in base 36,
 * about six characters, separated by spaces. Only the latest are kept.
 *
 * @param times Check-off times in milliseconds, oldest first.
 * @returns The stored text.
 */
export function encodeHistory(times: ReadonlyArray<number>): string {
  return times.slice(-HISTORY_LIMIT).map(time => Math.floor(time / MINUTE).toString(36)).join(" ");
}

/**
 * Reads stored check-off times, dropping anything malformed.
 *
 * @param value The stored value.
 * @returns Check-off times in milliseconds, oldest first, at most {@link HISTORY_LIMIT}.
 */
export function decodeHistory(value: unknown): Array<number> {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(" ")
    .filter(part => /^[0-9a-z]{1,9}$/.test(part))
    .map(part => Number.parseInt(part, 36) * MINUTE)
    .filter(time => time > 0)
    .slice(-HISTORY_LIMIT);
}

/**
 * Adds a check-off, dropping the oldest past the limit.
 *
 * @param times The times so far, oldest first.
 * @param now When it was checked off.
 * @returns The new times.
 */
export function addToHistory(times: ReadonlyArray<number>, now: Date): Array<number> {
  return [...times, Math.floor(now.getTime() / MINUTE) * MINUTE].slice(-HISTORY_LIMIT);
}
