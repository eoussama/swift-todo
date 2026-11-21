import { toDateString } from "../time/date";



/**
 * Saves text as a file through a temporary link, which works in the popup
 * without the downloads permission.
 *
 * @param filename The file name.
 * @param content The file content.
 * @param type The MIME type.
 */
export function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();

  // Give the browser time to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Names an export after the day it was made.
 *
 * @param now When the export is made.
 * @param extension The file extension, without the dot.
 * @returns For example `swift-todo-2026-11-21.json`.
 */
export function exportName(now: Date, extension: string): string {
  return `swift-todo-${toDateString(now)}.${extension}`;
}
