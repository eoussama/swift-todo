import { tryCatch } from "@eoussama/core";



/** Where the popup's own window, when one had to be opened, is remembered for the browser session. */
export const POPUP_WINDOW_KEY = "popup:window";

export type TPopupDeps = {
  /** The browser window last used, throwing when there's none (all closed). */
  lastWindow: () => Promise<number>;
  /** Brings a window to the front, throwing when it's gone. */
  focusWindow: (id: number) => Promise<void>;
  /** Opens the toolbar popup in a window, throwing when the browser won't. */
  openPopup: (windowId: number) => Promise<void>;
  /** Opens the popup's page in a small window of its own. */
  createWindow: () => Promise<number | undefined>;
  session: {
    get: (key: string) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
  };
};

/**
 * Opens the popup from a notification. A click on a notification takes the
 * focus away from the browser, and Chrome only opens the toolbar popup in a
 * focused window, so the last window is brought to the front first. Where that
 * still fails (no window open, or a browser that wants a click on the
 * toolbar), the popup opens in a small window of its own: the same one each
 * time while it stays open.
 *
 * @param deps The browser's windows, action and session storage.
 * @returns Once open.
 */
export async function openPopup(deps: TPopupDeps): Promise<void> {
  const [refused] = await tryCatch(async () => {
    const id = await deps.lastWindow();

    await deps.focusWindow(id);
    await deps.openPopup(id);
  });

  if (refused === null) {
    return;
  }

  const opened = (await deps.session.get(POPUP_WINDOW_KEY))[POPUP_WINDOW_KEY];

  if (typeof opened === "number") {
    const [gone] = await tryCatch(async () => deps.focusWindow(opened));

    if (gone === null) {
      return;
    }
  }

  await deps.session.set({ [POPUP_WINDOW_KEY]: await deps.createWindow() });
}
