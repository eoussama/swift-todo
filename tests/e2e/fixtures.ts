import type { BrowserContext, Locator, Page, Worker } from "@playwright/test";

import { resolve } from "node:path";

import { test as base, chromium, expect } from "@playwright/test";



const EXTENSION_PATH = resolve(import.meta.dirname, "../../.output/chrome-mv3");

type TStorage = Record<string, unknown>;

// The part of the extension API used inside `worker.evaluate` callbacks, which run in the service worker.
declare const chrome: {
  storage: Record<"sync" | "local", {
    get: (keys: null) => Promise<TStorage>;
    set: (items: TStorage) => Promise<void>;
  }>;
};

type TFixtures = {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  /**
   * Opens a new popup page, as if the toolbar icon was clicked. It's ready once the input has the
   * focus, unless something kept from last time (a dialog, an edit) is expected to take it.
   */
  openPopup: (options?: { restored?: boolean }) => Promise<Page>;
  popup: Page;
  /** Reads a storage area through the extension's service worker. */
  storage: (area: "sync" | "local") => Promise<TStorage>;
  /** Writes to storage areas before the popup opens. */
  seed: (data: { sync?: TStorage; local?: TStorage }) => Promise<void>;
};

export const test = base.extend<TFixtures>({
  // A fresh browser profile per test, with the built extension loaded.
  // The showcase screenshots set a device scale factor for sharper images, and reduced motion.
  context: async ({ deviceScaleFactor, contextOptions, locale, timezoneId }, use) => {
    const context = await chromium.launchPersistentContext("", {
      ...contextOptions,
      channel: "chromium",
      deviceScaleFactor,
      locale,
      timezoneId,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });

    await use(context);
    await context.close();
  },

  worker: async ({ context, timezoneId }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");

    if (timezoneId !== undefined) {
      await pinWorkerZone(context, timezoneId);
    }

    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },

  openPopup: async ({ context, extensionId }, use) => {
    const errors: Array<string> = [];

    await use(async ({ restored = false } = {}) => {
      const page = await context.newPage();

      page.on("pageerror", error => errors.push(error.message));
      // The popup's real size (App.svelte).
      await page.setViewportSize({ width: 380, height: 560 });
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await (restored ? expect(page.getByLabel("New to-do")).toBeAttached() : expect(page.getByLabel("New to-do")).toBeFocused());

      return page;
    });

    expect(errors, "uncaught errors in the popup").toEqual([]);
  },

  popup: async ({ openPopup }, use) => {
    await use(await openPopup());
  },

  storage: async ({ worker }, use) => {
    await use(async area => worker.evaluate(async name => chrome.storage[name].get(null), area));
  },

  seed: async ({ worker }, use) => {
    await use(async ({ sync = {}, local = {} }) => {
      await worker.evaluate(async ([syncItems, localItems]) => {
        await chrome.storage.sync.set(syncItems);
        await chrome.storage.local.set(localItems);
      }, [sync, local] as const);
    });
  },
});

export { expect };

/**
 * Puts the extension's service worker in the same time zone as its pages.
 * Playwright's `timezoneId` reaches pages only, and on Windows the browser
 * ignores `TZ`, so the worker (which works out "today" for the badge and
 * reminders) is set through the DevTools protocol instead. The override holds
 * while the session is attached, so a blank tab keeps it for the whole test.
 *
 * @param context The browser context.
 * @param timezoneId The zone, like "Asia/Kolkata".
 * @returns Once the worker reports that zone.
 */
async function pinWorkerZone(context: BrowserContext, timezoneId: string): Promise<void> {
  const anchor = await context.newPage();
  const cdp = await context.newCDPSession(anchor);
  const { targetInfos } = await cdp.send("Target.getTargets");
  const worker = targetInfos.find(target => target.type === "service_worker");
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId: worker!.targetId, flatten: false });

  await cdp.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id: 1, method: "Emulation.setTimezoneOverride", params: { timezoneId } }) });
  // Zones go by more than one name ("Asia/Calcutta"), so compare the local time they give.
  const local = (zone?: string): string => new Date(0).toLocaleString("en-US", { timeZone: zone });

  await expect.poll(async () => context.serviceWorkers()[0]!.evaluate(() => new Date(0).toLocaleString("en-US"))).toBe(local(timezoneId));
}

/**
 * Lists the to-do texts shown in the popup, in order.
 *
 * @param page The popup.
 * @returns The texts.
 */
export async function listedTexts(page: Page): Promise<Array<string>> {
  const texts = await page.locator("[data-todo-row] .pencil-strike").allTextContents();

  return texts.map(text => text.trim());
}

/**
 * Waits for transitions and one-off animations to finish, so a check sees the
 * final colors rather than a fade halfway through. Endless ones (the timer's)
 * are left running.
 *
 * @param page The popup.
 * @returns Once they're done.
 */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => Promise.all(document.getAnimations()
    .filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity)
    .map(async animation => animation.finished.catch(() => undefined))));
}

/**
 * Adds to-dos through the input.
 *
 * @param page The popup.
 * @param texts The to-dos to add, in order.
 * @returns Once the last one shows up.
 */
export async function addTodos(page: Page, ...texts: Array<string>): Promise<void> {
  const input = page.getByLabel("New to-do");

  for (const text of texts) {
    await input.fill(text);
    await input.press("Enter");
    await expect(input).toHaveValue("");
  }

  await expect(page.locator("[data-todo-row]")).toHaveCount(texts.length);
}

/**
 * Finds a to-do row by its text.
 *
 * @param page The popup.
 * @param text The to-do text.
 * @returns The row locator.
 */
export function row(page: Page, text: string) {
  return page.getByRole("group", { name: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`) });
}

/**
 * Moves the pointer near a row's end, where View, Edit (and Show, for hidden text) appear.
 *
 * @param target The row, from {@link row} or a role locator.
 * @returns Once there.
 */
export async function hoverEnd(target: ReturnType<typeof row>): Promise<void> {
  const box = (await target.boundingBox())!;

  await target.page().mouse.move(box.x + box.width - 60, box.y + 20);
}

/**
 * Runs an action from a row's "More actions" menu.
 *
 * @param target The row, from {@link row} or a role locator.
 * @param action The menu item's name.
 * @returns Once clicked.
 */
export async function rowAction(target: ReturnType<typeof row>, action: string | RegExp): Promise<void> {
  const page = target.page();

  await target.hover();
  await target.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

/**
 * Picks a date in a date button's calendar (the app's own, not the browser's).
 *
 * @param scope Where the date button is, like a dialog.
 * @param label The button's label, like "Date".
 * @param date The date as `YYYY-MM-DD`.
 * @returns Once picked.
 */
export async function pickDate(scope: Locator, label: string, date: string): Promise<void> {
  const page = scope.page();

  await scope.getByRole("button", { name: new RegExp(`^${label}: `) }).click();

  const day = page.locator(`[data-value="${date}"]:not([data-outside-month]) [data-bits-day]`);

  for (let month = 0; month < 13 && !(await day.isVisible()); month++) {
    await page.getByRole("button", { name: "Next" }).click();
  }

  await day.click();
}

/**
 * Types a time into a time field, segment by segment, in the 12-hour format the tests run in.
 *
 * @param field The field's group, from `getByRole("group", { name })`.
 * @param time The time as `HH:MM`.
 * @returns Once typed.
 */
export async function typeTime(field: Locator, time: string): Promise<void> {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const keyboard = field.page().keyboard;

  await field.getByRole("spinbutton").first().click();
  await keyboard.type(String(hours % 12 === 0 ? 12 : hours % 12).padStart(2, "0"));
  await keyboard.type(String(minutes).padStart(2, "0"));
  await keyboard.type(hours < 12 ? "A" : "P");
}

/**
 * Chooses an option in a dropdown (the app's own, not the browser's).
 *
 * @param scope Where the dropdown is.
 * @param label The dropdown's label.
 * @param option The option's text.
 * @returns Once chosen.
 */
export async function choose(scope: Locator, label: string, option: string): Promise<void> {
  await scope.getByRole("combobox", { name: label }).click();
  await scope.page().getByRole("option", { name: option, exact: true }).click();
}
