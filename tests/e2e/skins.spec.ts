import type { Page, Worker } from "@playwright/test";

import AxeBuilder from "@axe-core/playwright";

import { addTodos, expect, row, test } from "./fixtures";



const SKINS = ["notepad", "sticky", "chalk", "minimal", "scroll"] as const;
const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

// Writes settings the way another device would, through sync storage.
async function setPrefs(worker: Worker, prefs: Record<string, unknown>): Promise<void> {
  await worker.evaluate(async (changes) => {
    const api = (globalThis as unknown as { chrome: { storage: { sync: { get: (key: string) => Promise<Record<string, unknown>>; set: (items: object) => Promise<void> } } } }).chrome.storage.sync;
    const { prefs: current = {} } = await api.get("prefs");

    await api.set({ prefs: { ...(current as object), ...changes } });
  }, prefs);
}

async function root(page: Page): Promise<Record<string, string | undefined>> {
  return page.evaluate(() => ({ ...document.documentElement.dataset }));
}

for (const skin of SKINS) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`the ${skin} skin has no detectable accessibility issues in ${colorScheme}`, async ({ popup, worker }) => {
      // Reduced motion, so nothing is mid-fade when the page is scanned.
      await popup.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await addTodos(popup, "Reply to Sam about the offsite #work", "Buy oat milk tomorrow", "Water the plants every 3 days");
      await row(popup, "Buy oat milk").getByRole("checkbox").click();
      await setPrefs(worker, { skin, accent: "violet" });
      await expect.poll(async () => root(popup)).toMatchObject({ skin, theme: colorScheme, accent: "violet" });
      // Row actions fade in over the text on hover; scan the list at rest.
      await popup.mouse.move(0, 0);
      await popup.getByLabel("New to-do").focus();

      const list = await new AxeBuilder({ page: popup }).withTags(WCAG).analyze();

      expect(list.violations).toEqual([]);

      await popup.getByRole("button", { name: "Settings" }).click();
      await expect(popup.getByRole("dialog", { name: "Settings" })).toBeVisible();

      const settings = await new AxeBuilder({ page: popup }).withTags(WCAG).analyze();

      expect(settings.violations).toEqual([]);
    });
  }
}

test("picks a skin, accent and theme in settings, and opens with them next time", async ({ popup, openPopup }) => {
  await popup.emulateMedia({ colorScheme: "light" });
  await popup.getByRole("button", { name: "Settings" }).click();

  const settings = popup.getByRole("dialog", { name: "Settings" });

  await settings.getByText("Chalkboard").click();
  await expect(settings.getByRole("radio", { name: "Chalkboard" })).toBeChecked();
  await settings.getByRole("radio", { name: "Amber" }).check({ force: true });
  await settings.getByText("Dark", { exact: true }).click();

  await expect.poll(async () => root(popup)).toMatchObject({ skin: "chalk", accent: "amber", theme: "dark" });
  expect(await popup.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim())).toBe("#f4b223");

  // The theme setting wins over the system.
  await settings.getByText("Light", { exact: true }).click();
  await popup.emulateMedia({ colorScheme: "dark" });
  await expect.poll(async () => root(popup)).toMatchObject({ theme: "light" });
  await settings.getByText("System", { exact: true }).click();
  await expect.poll(async () => root(popup)).toMatchObject({ theme: "dark" });

  // A new popup paints the cached skin before the settings load.
  const next = await openPopup();

  expect(await root(next)).toMatchObject({ skin: "chalk", accent: "amber" });
});
