import { isObject } from "@eoussama/core";



/**
 * Unsaved input waits here while the popup is closed, so nothing typed is
 * lost: the new to-do, a to-do being edited, an open dialog and its form, the
 * settings, and list names. Page `localStorage` is read synchronously, so the
 * popup opens with it already in place.
 */
export const DRAFT_PREFIX = "swift-todo:draft:";

/** The dialogs opened from a to-do, which reopen on it with their form as it was. */
export type TDialogKind = "view" | "schedule" | "repeat" | "link";

const DIALOG_KINDS: ReadonlyArray<TDialogKind> = ["view", "schedule", "repeat", "link"];

/**
 * Reads a draft.
 *
 * @param key The draft's name.
 * @returns What was saved, or `null` when nothing was (or storage is unavailable).
 */
export function readDraft(key: string): unknown {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);

    return raw === null ? null : JSON.parse(raw) as unknown;
  }
  catch {
    return null;
  }
}

/**
 * Saves a draft, or removes it.
 *
 * @param key The draft's name.
 * @param value What to keep; `null` removes it.
 */
export function saveDraft(key: string, value: unknown): void {
  try {
    if (value === null) {
      localStorage.removeItem(DRAFT_PREFIX + key);
    }
    else {
      localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(value));
    }
  }
  catch {
    // Storage can be unavailable (or full); the popup then forgets, as it used to.
  }
}

/**
 * Reads a draft made of fields, like the new to-do's text and whether its date was dismissed.
 *
 * @param key The draft's name.
 * @returns Its fields; none when nothing usable was saved.
 */
export function readFields(key: string): Record<string, unknown> {
  const saved = readDraft(key);

  return isObject(saved) ? saved : {};
}

/**
 * Reads a text field of a saved draft.
 *
 * @param draft The draft.
 * @param key The field.
 * @param fallback The value when it's missing or not text.
 * @returns The text.
 */
export function textOf(draft: Record<string, unknown>, key: string, fallback: string): string {
  const value = draft[key];

  return typeof value === "string" ? value : fallback;
}

/**
 * Reads a yes-or-no field of a saved draft.
 *
 * @param draft The draft.
 * @param key The field.
 * @param fallback The value when it's missing or not a boolean.
 * @returns The value.
 */
export function flagOf(draft: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = draft[key];

  return typeof value === "boolean" ? value : fallback;
}

/**
 * Reads a draft saved for one to-do: the one being edited, or the one a dialog was open on.
 *
 * @param key The draft's name.
 * @returns The to-do's ID and the draft's other fields, or `null`.
 */
export function readTodoDraft(key: string): { id: string; fields: Record<string, unknown> } | null {
  const saved = readDraft(key);

  return isObject(saved) && typeof saved.id === "string" ? { id: saved.id, fields: saved } : null;
}

/**
 * Tells which dialog was open, on which to-do, when the popup closed.
 *
 * @returns The dialog and the to-do's ID, or `null` when none was open.
 */
export function openDialog(): { kind: TDialogKind; id: string } | null {
  const saved = readTodoDraft("dialog");
  const kind = saved?.fields.kind;

  return saved !== null && DIALOG_KINDS.includes(kind as TDialogKind) ? { kind: kind as TDialogKind, id: saved.id } : null;
}

/**
 * Reads the form a dialog had, if it was open on this to-do.
 *
 * @param kind The dialog.
 * @param id The to-do it's open on.
 * @returns The form's fields, or `null` when it wasn't open on it.
 */
export function dialogForm(kind: TDialogKind, id: string): Record<string, unknown> | null {
  const saved = readTodoDraft("dialog");

  return saved !== null && saved.id === id && saved.fields.kind === kind && isObject(saved.fields.form) ? saved.fields.form : null;
}

/**
 * Keeps a dialog's form saved while it's open, and forgets it once it's
 * closed (by Cancel, Save or Escape, not by the popup closing). Call it while
 * the dialog's component initializes; it restores its own form, through
 * {@link dialogForm}, when it opens.
 *
 * @param kind The dialog.
 * @param state The dialog's state.
 * @param state.open Whether it's open.
 * @param state.id The to-do it's open on.
 * @param state.form Its form, as it stands.
 */
export function keepDialog(kind: TDialogKind, state: { open: () => boolean; id: () => string | null; form: () => Record<string, unknown> }): void {
  let wasOpen = false;

  $effect(() => {
    const id = state.id();

    if (state.open() && id !== null) {
      wasOpen = true;
      saveDraft("dialog", { kind, id, form: state.form() });
    }
    else if (wasOpen) {
      wasOpen = false;

      // Only its own: another dialog may have opened in the meantime.
      if (readTodoDraft("dialog")?.fields.kind === kind) {
        saveDraft("dialog", null);
      }
    }
  });
}
