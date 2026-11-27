import type { Page } from "@playwright/test";

import { resolve } from "node:path";

import { expect, rowAction, settled, test } from "../e2e/fixtures";



// Screenshots for `showcase/showcase.md`. Run with `pnpm showcase`.

const OUT = resolve(import.meta.dirname, "../../showcase");

// The popup's real size (its root is 560 pixels tall); the config doubles the pixels for sharpness.
const POPUP = { width: 380, height: 560 };

type TSkin = "notepad" | "sticky" | "chalk" | "scroll" | "minimal" | "aurora";
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
 * to-do saved from a web page, one pinned to Today, two in progress (one at a
 * stage of one's own) and two done.
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
    ["Read chapter 4 of the systems book #reading", { s: { u: "https://dataintensive.net/", t: "Designing Data-Intensive Applications" }, g: "doing" }],
    ["Plan the weekend trip with Sam #home", { l: "home", y: day(0), g: "doing:waiting" }],
    ["Oat milk, eggs and coffee", { l: "errands" }],
    ["Book the dentist", { d: 1 }],
    ["Pay the electricity bill #home", { l: "home", d: 1 }],
  ];

  return {
    meta: { v: 2 },
    lists: [{ i: "work", n: "Work", e: "💼" }, { i: "home", n: "Home", e: "🏡" }, { i: "errands", n: "Errands", e: "🛒" }],
    prefs: { skin, accent: "mint", theme, reminders: false, lead: 0, digest: null, nudges: false, badge: "due", timer: 25, stages: [{ id: "waiting", name: "Waiting", status: "doing" }, { id: "review", name: "Review", status: "doing" }] },
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
  // Fades still under way (the text's color easing from the default look into the saved dark
  // one, say) would be caught halfway: they finish first.
  await settled(page);
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

/**
 * Attaches a picture and a PDF to the weekend trip, as if pasted on it, then
 * opens the popup afresh, so no toast or focus shows in the shot.
 *
 * @param openPopup Opens the popup.
 * @returns The popup, with the files attached.
 */
async function withAttachments(openPopup: () => Promise<Page>): Promise<Page> {
  const first = await openPopup();
  const trip = rowStarting(first, "Plan the weekend trip");

  await trip.focus();
  await trip.evaluate(async (element) => {
    // A little map: the coast, a dashed route and two pins.
    const canvas = new OffscreenCanvas(480, 320);
    const context = canvas.getContext("2d")!;

    context.fillStyle = "#bfe3f5";
    context.fillRect(0, 0, 480, 320);
    context.fillStyle = "#e9dcb5";
    context.beginPath();
    context.moveTo(0, 320);
    context.bezierCurveTo(120, 140, 300, 260, 480, 90);
    context.lineTo(480, 320);
    context.fill();
    context.strokeStyle = "#242c88";
    context.lineWidth = 6;
    context.setLineDash([14, 10]);
    context.beginPath();
    context.moveTo(90, 250);
    context.quadraticCurveTo(250, 120, 390, 190);
    context.stroke();

    for (const [x, y, color] of [[90, 250, "#ef4444"], [390, 190, "#39c89a"]] as const) {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, 16, 0, Math.PI * 2);
      context.fill();
    }

    const data = new DataTransfer();

    data.items.add(new File([await canvas.convertToBlob({ type: "image/png" })], "route-map.png", { type: "image/png" }));
    data.items.add(new File(["%PDF-1.4 itinerary"], "train-tickets.pdf", { type: "application/pdf" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(trip.locator("[data-chip=files]")).toHaveText("2");
  await first.close();

  const popup = await openPopup();

  await popup.setViewportSize(POPUP);

  return popup;
}

// The popup's clock reads 10 AM today, so the shots look the same whenever they're
// taken: "Today 3:00 PM" stays ahead instead of turning overdue in the afternoon.
// The one-time tips count as seen, so they don't cover the list.
test.beforeEach(async ({ context }) => {
  const morning = new Date();

  morning.setHours(10, 0, 0, 0);
  await context.clock.setFixedTime(morning);
  await context.addInitScript(() => localStorage.setItem("swift-todo:hints", JSON.stringify(["long", "tabs", "menu"])));
});

test.describe("showcase", () => {
  test.beforeEach(async ({ seed }) => {
    await seed({ sync: sampleData() });
  });

  test("overview", async ({ openPopup }) => {
    const popup = await withAttachments(openPopup);

    await expect(popup.locator("[data-todo-row]")).toHaveCount(9);
    await shot(popup, "overview");
  });

  test("statuses", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);
    // Folded to do, the sections under it show.
    await popup.getByRole("button", { name: /^To do/ }).click();

    const reading = rowStarting(popup, "Read chapter 4");

    await reading.hover();
    await reading.getByRole("button", { name: "More actions" }).click();
    await popup.getByRole("menuitem", { name: /^Status/ }).click();
    await expect(popup.getByRole("menuitemradio", { name: "Waiting" })).toBeVisible();
    await shot(popup, "statuses");
  });

  test("attachments", async ({ openPopup }) => {
    const popup = await withAttachments(openPopup);

    await rowStarting(popup, "Plan the weekend trip").focus();
    await popup.keyboard.press("v");

    const view = popup.getByRole("dialog");

    await expect(view.getByRole("list", { name: "Attachments" }).locator("img")).toHaveJSProperty("complete", true);
    await view.locator("[data-attachments]").scrollIntoViewIfNeeded();
    await shot(popup, "attachments");
  });

  test("sorting", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);
    await popup.getByRole("tab", { name: "All" }).click();
    await popup.getByRole("menuitem", { name: /^Sort by/ }).click();
    await expect(popup.getByRole("menuitemradio", { name: "Due date" })).toBeVisible();
    await shot(popup, "sorting");
  });

  test("natural-language input", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);
    const input = popup.getByLabel("New to-do");

    await input.pressSequentially("Call Sam tomorrow 6pm #trip");
    // The chip, not the screen-reader status that says the same.
    await expect(popup.locator("span[aria-hidden='true']").getByText(/Tomorrow 6:00 PM/)).toBeVisible();
    await shot(popup, "natural-language");
  });

  test("row menu", async ({ openPopup }) => {
    const popup = await openPopup();

    await popup.setViewportSize(POPUP);
    // The lowest row, so the whole menu opens above it, down to its tag filter.
    const trip = rowStarting(popup, "Plan the weekend trip");

    await trip.hover();
    await trip.getByRole("button", { name: "More actions" }).click();
    await expect(popup.getByRole("menuitem", { name: "View in full" })).toBeInViewport();
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
    // Straight to the tag: with the pointer over the row, its hover buttons would sit on top of it.
    await popup.getByRole("button", { name: "Show only #home" }).first().dispatchEvent("click");
    await expect(popup.locator("span", { hasText: "Showing #home" })).toBeVisible();
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

    for (const section of ["lists", "stages", "reminders", "data"]) {
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
    ["aurora", "light"],
    ["aurora", "dark"],
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
