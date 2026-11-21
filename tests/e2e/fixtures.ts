import type { BrowserContext, Page, Worker } from "@playwright/test";

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
  /** Opens a new popup page, as if the toolbar icon was clicked. */
  openPopup: () => Promise<Page>;
  popup: Page;
  /** Reads a storage area through the extension's service worker. */
  storage: (area: "sync" | "local") => Promise<TStorage>;
  /** Writes to storage areas before the popup opens. */
  seed: (data: { sync?: TStorage; local?: TStorage }) => Promise<void>;
};

export const test = base.extend<TFixtures>({
  // A fresh browser profile per test, with the built extension loaded.
  // The showcase screenshots set a device scale factor for sharper images.
  context: async ({ deviceScaleFactor }, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      deviceScaleFactor,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });

    await use(context);
    await context.close();
  },

  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");

    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },

  openPopup: async ({ context, extensionId }, use) => {
    const errors: Array<string> = [];

    await use(async () => {
      const page = await context.newPage();

      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width: 380, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(page.getByLabel("New to-do")).toBeFocused();

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
