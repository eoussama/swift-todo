import type { Page } from "@playwright/test";

import { resolve } from "node:path";

import { expect, rowAction, test } from "../e2e/fixtures";



// Screenshots for `showcase/showcase.md`. Run with `pnpm showcase`.

const OUT = resolve(import.meta.dirname, "../../showcase");

// The popup's real size (its root is 560 pixels tall); the config doubles the pixels for sharpness.
const POPUP = { width: 380, height: 560 };

type TSkin = "notepad" | "sticky" | "chalk" | "minimal" | "scroll";
type TTheme = "light" | "dark";

/**
 * A local date some days from today, as stored (`YYYY-MM-DD`).
 *
 * @param offset Days from today.
 * @returns The date.
 */
function day(offset: number): string {
  const date = new Date();

  date.setDate(date.getDate() + offset);

  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(part => String(part).padStart(2, "0")).join("-");
}

/**
 * A believable list: three lists, tags, due dates (one overdue), repeats, a
 * to-do saved from a web page, one pinned to Today and two done.
 *
 * @param skin The skin.
 * @param theme Light or dark.
 * @returns What to put in browser sync.
 */
function sampleData(skin: TSkin = "notepad", theme: TTheme = "light"): Record<string, unknown> {
  const now = Date.now();
  const todos: Array<[string, Record<string, unknown>]> = [
    ["Send the quarterly report #work", { l: "work", w: `${day(0)}T15:00` }],
    ["Renew passport", { w: day(-2) }],
    ["Water the plants #home", { l: "home", r: "3d", w: day(0) }],
    ["Daily standup notes", { l: "work", r: "wd", w: `${day(1)}T09:30` }],
    ["Read chapter 4 of the systems book #reading", { s: { u: "https://dataintensive.net/", t: "Designing Data-Intensive Applications" } }],
    ["Plan the weekend trip with Sam #home", { l: "home", y: day(0) }],
    ["Oat milk, eggs and coffee", { l: "errands" }],
    ["Book the dentist", { d: 1 }],
    ["Pay the electricity bill #home", { l: "home", d: 1 }],
  ];

  return {
    meta: { v: 2 },
    lists: [{ i: "work", n: "Work", e: "💼" }, { i: "home", n: "Home", e: "🏡" }, { i: "errands", n: "Errands", e: "🛒" }],
    prefs: { skin, accent: "mint", theme, reminders: false, lead: 0, digest: null, nudges: false, badge: "due", timer: 25 },
    ...Object.fromEntries(todos.map(([text, fields], index) => [
      `t:sample${String(index).padStart(4, "0")}`,
      { t: text, d: 0, p: `a${index}`, c: now - (todos.length - index) * 60_000, u: now - (todos.length - index) * 60_000, ...fields },
    ])),
  };
}

/**
 * Saves a screenshot of the popup once fonts and animations have settled.
 *
 * @param page The popup.
 * @param name File name, without the extension.
 * @returns Once saved.
 */
async function shot(page: Page, name: string): Promise<void> {
  await page.evaluate(async () => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
}

/**
 * Finds a to-do row by the start of its text.
 *
 * @param page The popup.
 * @param start The beginning of the text.
 * @returns The row.
 */
function rowStarting(page: Page, start: string) {
  return page.getByRole("group", { name: new RegExp(`^${start}`) });
}

test.describe("showcase", () => {
  test.beforeEach(async ({ seed }) => {
    await seed({ sync: sampleData() });
  });

  test("overview", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);

    await expect(popup.locator("[data-todo-row]")).toHaveCount(9);
    await shot(popup, "overview");
  });

  test("natural-language input", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);
    const input = popup.getByLabel("New to-do");

    await input.pressSequentially("Call Sam tomorrow 6pm #trip");
    await expect(popup.getByText(/Tomorrow 6:00 PM/)).toBeVisible();
    await shot(popup, "natural-language");
  });

  test("row menu", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);
    const reading = rowStarting(popup, "Read chapter 4");

    await reading.hover();
    await reading.getByRole("button", { name: "More actions" }).click();
    await expect(popup.getByRole("menuitem", { name: "Open the page it came from" })).toBeVisible();
    await shot(popup, "row-menu");
  });

  test("schedule and repeat dialogs", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);

    await rowAction(rowStarting(popup, "Renew passport"), "Schedule…");
    await expect(popup.getByRole("dialog")).toBeVisible();
    await shot(popup, "schedule");
    await popup.keyboard.press("Escape");

    await rowAction(rowStarting(popup, "Daily standup notes"), "Repeat…");
    await expect(popup.getByRole("dialog")).toBeVisible();
    await shot(popup, "repeat");
  });

  test("lists and tags", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);

    await popup.getByRole("tab", { name: /Home/ }).click();
    await shot(popup, "list");

    await popup.getByRole("tab", { name: "All" }).click();
    await popup.getByRole("button", { name: "Show only #home" }).first().click();
    await expect(popup.getByText("Showing #home")).toBeVisible();
    await shot(popup, "tag-filter");
  });

  test("today and focus", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);

    await popup.getByRole("tab", { name: "Today" }).click();
    await shot(popup, "today");

    await popup.getByRole("button", { name: "Focus mode" }).click();
    await popup.getByRole("button", { name: "Start a 25-minute timer" }).click();
    await expect(popup.getByRole("timer")).toBeVisible();
    await popup.mouse.move(0, 0);
    await shot(popup, "focus");
  });

  test("settings", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);

    await popup.getByRole("button", { name: "Settings" }).click();
    await expect(popup.getByRole("dialog")).toBeVisible();
    await shot(popup, "settings-appearance");

    for (const section of ["lists", "reminders", "data"]) {
      await popup.locator(`#settings-${section}`).evaluate(element => element.closest("section")!.scrollIntoView({ block: "start" }));
      await shot(popup, `settings-${section}`);
    }
  });

  test("keyboard shortcuts", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);

    await popup.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(popup.getByText("Move between to-dos")).toBeVisible();
    await shot(popup, "shortcuts");
  });
});

test.describe("skins", () => {
  const looks: Array<[TSkin, TTheme]> = [
    ["notepad", "dark"],
    ["sticky", "light"],
    ["sticky", "dark"],
    ["chalk", "light"],
    ["chalk", "dark"],
    ["minimal", "light"],
    ["minimal", "dark"],
    ["scroll", "light"],
    ["scroll", "dark"],
  ];

  for (const [skin, theme] of looks) {
    test(`${skin} ${theme}`, async ({ seed, openPopup }) => {
      await seed({ sync: sampleData(skin, theme) });

      const popup = await openPopup();


      await popup.setViewportSize(POPUP);

      // The popup paints the default look until the saved one loads.
      await expect(popup.locator("html")).toHaveAttribute("data-skin", skin);
      await expect(popup.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(popup.locator("[data-todo-row]")).toHaveCount(9);
      await shot(popup, `skin-${skin}-${theme}`);
    });
  }
});
