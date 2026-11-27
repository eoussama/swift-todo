import type { TPeekKey } from "./prefs/prefs";



/** How long the key is held, alone, before a to-do opens up: typing a capital doesn't. */
export const PEEK_HOLD_MS = 250;

/** The `KeyboardEvent.key` values of each peek key. */
const PEEK_KEY_NAMES: Record<Exclude<TPeekKey, "off">, ReadonlyArray<string>> = {
  shift: ["Shift"],
  alt: ["Alt"],
  ctrl: ["Control", "Meta"],
};

/**
 * Sets `data-peek` on the root while the peek key is held down on its own,
 * which shows the whole of the to-do under the pointer or the keyboard focus
 * (see `[data-todo-line]` in app.css). It waits a moment first, and any other
 * key cancels it, so the key still works as a modifier: Shift+Enter, capitals
 * and Ctrl+Z never open anything up.
 *
 * @param target Where the keys are heard (the window).
 * @param root The element that gets `data-peek`.
 * @param key The chosen key, read on each press so a change in settings applies at once.
 * @param hold How long to hold it, in milliseconds.
 * @returns A function that stops watching.
 */
export function watchPeek(target: Pick<Window, "addEventListener" | "removeEventListener">, root: HTMLElement, key: () => TPeekKey, hold = PEEK_HOLD_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const isPeekKey = (event: KeyboardEvent): boolean => {
    const chosen = key();

    return chosen !== "off" && PEEK_KEY_NAMES[chosen].includes(event.key);
  };

  const stop = (): void => {
    clearTimeout(timer);
    timer = undefined;
    delete root.dataset.peek;
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (!isPeekKey(event)) {
      stop();

      return;
    }

    // Held down, the key repeats; only a fresh press starts the wait.
    if (!event.repeat && timer === undefined && root.dataset.peek === undefined) {
      timer = setTimeout(() => {
        timer = undefined;
        root.dataset.peek = "";
      }, hold);
    }
  };

  const onKeyup = (event: KeyboardEvent): void => {
    if (isPeekKey(event)) {
      stop();
    }
  };

  // Keys let go while the popup is in the background never arrive.
  const listeners = [["keydown", onKeydown], ["keyup", onKeyup], ["blur", stop]] as const;

  for (const [type, listener] of listeners) {
    target.addEventListener(type, listener as EventListener, true);
  }

  return () => {
    for (const [type, listener] of listeners) {
      target.removeEventListener(type, listener as EventListener, true);
    }

    stop();
  };
}
