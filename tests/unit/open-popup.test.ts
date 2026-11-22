import type { TPopupDeps } from "~/lib/open-popup";

import { describe, expect, it } from "vitest";

import { openPopup, POPUP_WINDOW_KEY } from "~/lib/open-popup";

import { memoryArea } from "./helpers";



// A browser with windows 1 and 2 open, the last one used being `last`.
function browserWith(options: { last?: number; popup?: "opens" | "refused"; windows?: Array<number> } = {}) {
  const calls: Array<string> = [];
  const windows = new Set(options.windows ?? [1, 2]);
  const session = memoryArea();
  let next = 10;

  const deps: TPopupDeps = {
    lastWindow: async () => {
      if (options.last === undefined) {
        throw new Error("No window");
      }

      return options.last;
    },
    focusWindow: async (id) => {
      calls.push(`focus ${id}`);

      if (!windows.has(id)) {
        throw new Error("Gone");
      }
    },
    openPopup: async (windowId) => {
      if (options.popup === "refused") {
        throw new Error("Refused");
      }

      calls.push(`popup ${windowId}`);
    },
    createWindow: async () => {
      const id = next++;

      windows.add(id);
      calls.push(`create ${id}`);

      return id;
    },
    session,
  };

  return { deps, calls, windows, session };
}

describe("opening the popup from a notification", () => {
  it("brings the last window to the front and opens the toolbar popup there", async () => {
    const { deps, calls, session } = browserWith({ last: 2 });

    await openPopup(deps);

    expect(calls).toEqual(["focus 2", "popup 2"]);
    expect(await session.get(POPUP_WINDOW_KEY)).toEqual({});
  });

  it("opens a small window of its own when the browser won't open the popup, and reuses it", async () => {
    const { deps, calls, session } = browserWith({ last: 1, popup: "refused" });

    await openPopup(deps);
    expect(calls).toEqual(["focus 1", "create 10"]);
    expect(await session.get(POPUP_WINDOW_KEY)).toEqual({ [POPUP_WINDOW_KEY]: 10 });

    await openPopup(deps);
    expect(calls).toEqual(["focus 1", "create 10", "focus 1", "focus 10"]);
  });

  it("opens a new one once that window was closed", async () => {
    const { deps, calls, windows, session } = browserWith({ last: 1, popup: "refused" });

    await openPopup(deps);
    windows.delete(10);
    await openPopup(deps);

    expect(calls).toEqual(["focus 1", "create 10", "focus 1", "focus 10", "create 11"]);
    expect(await session.get(POPUP_WINDOW_KEY)).toEqual({ [POPUP_WINDOW_KEY]: 11 });
  });

  it("opens its window when no browser window is left, or the last one just closed", async () => {
    const none = browserWith();

    await openPopup(none.deps);
    expect(none.calls).toEqual(["create 10"]);

    const closed = browserWith({ last: 3 });

    await openPopup(closed.deps);
    expect(closed.calls).toEqual(["focus 3", "create 10"]);
  });

  it("ignores anything else stored under its key", async () => {
    const { deps, calls, session } = browserWith({ popup: "refused" });

    expect(POPUP_WINDOW_KEY).toBe("popup:window");
    await session.set({ [POPUP_WINDOW_KEY]: "1" });
    await openPopup(deps);

    expect(calls).toEqual(["create 10"]);
  });
});
