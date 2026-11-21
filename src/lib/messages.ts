import { i18n } from "#i18n";

import { TodoError } from "./todos/errors";



/**
 * Turns an error from the store into a message for the user.
 *
 * @param error The error to describe.
 * @returns A short, translated message.
 */
export function errorMessage(error: Error): string {
  if (!(error instanceof TodoError)) {
    return i18n.t("errors.unknown");
  }

  switch (error.code) {
    case "empty":
      return i18n.t("errors.empty");

    case "not-found":
      return i18n.t("errors.notFound");

    case "sync-full":
      return i18n.t("errors.syncFull");

    case "sync-unavailable":
      return i18n.t("errors.syncUnavailable");

    case "too-many-lists":
      return i18n.t("errors.tooManyLists");

    case "invalid-backup":
      return i18n.t("errors.invalidBackup");
  }
}

/**
 * Shortens text for a toast, cutting at a word when possible.
 *
 * @param text The text to shorten.
 * @param max Longest result, in characters, including the ellipsis.
 * @returns The text, shortened with an ellipsis when needed.
 */
export function truncate(text: string, max = 40): string {
  const chars = Array.from(text);

  if (chars.length <= max) {
    return text;
  }

  const cut = chars.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");

  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
