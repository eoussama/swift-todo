import { toError } from "@eoussama/core";



/**
 * Why a storage call failed:
 * - `rate-limit`: too many writes this minute or hour; retry later.
 * - `quota`: sync storage is full (bytes, item size or item count).
 * - `unavailable`: sync is turned off or not supported here; use local storage.
 * - `unknown`: anything else; treated as temporary.
 */
export type TStorageFailure = "rate-limit" | "quota" | "unavailable" | "unknown";

/**
 * Sorts a storage error into what the app should do about it.
 *
 * @param error The error a storage call threw.
 * @returns The kind of failure.
 */
export function classifyStorageError(error: unknown): TStorageFailure {
  const message = toError(error).message;

  // Chromium: "MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded" (and _PER_HOUR).
  if (/MAX_WRITE_OPERATIONS|MAX_SUSTAINED_WRITE_OPERATIONS/i.test(message)) {
    return "rate-limit";
  }

  // Chromium: "QUOTA_BYTES quota exceeded", "QUOTA_BYTES_PER_ITEM ...", "MAX_ITEMS ...".
  // Firefox: "QuotaExceededError: storage.sync API call exceeded its quota limitations."
  if (/QUOTA_BYTES|MAX_ITEMS|quota/i.test(message)) {
    return "quota";
  }

  // Firefox: sync turned off in about:config, or a temporary add-on without an ID.
  // Chromium: the area is missing or blocked by policy.
  if (/sync.*(?:disabled|not enabled)|storage\.sync\.enabled|temporary add-?on|not supported|is not available/i.test(message)) {
    return "unavailable";
  }

  return "unknown";
}

/**
 * Why a request was refused:
 * - `empty`: the text is blank.
 * - `not-found`: the to-do no longer exists.
 * - `sync-full`: the to-do doesn't fit in sync; keep another one on the device first.
 * - `sync-unavailable`: sync is off or unsupported in this browser.
 */
export type TTodoErrorCode = "empty" | "not-found" | "sync-full" | "sync-unavailable";

/** A request the app refuses, as opposed to a storage failure. */
export class TodoError extends Error {
  override name = "TodoError";

  /**
   * Creates the error.
   *
   * @param code Why the request was refused.
   * @param message Optional details; defaults to the code.
   */
  constructor(readonly code: TTodoErrorCode, message?: string) {
    super(message ?? code);
  }
}
