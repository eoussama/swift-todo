import { addTodos, expect, listedTexts, row, rowAction, test } from "./fixtures";



test.describe("today and focus", () => {
  test("Today holds what's due or pinned, and pins what's added there", async ({ popup }) => {
    await addTodos(popup, "Pay rent today", "Someday", "Dentist tomorrow");

    await popup.getByRole("tab", { name: "Today" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent"]);

    const input = popup.getByLabel("New to-do");

    await input.fill("Call mom");
    await input.press("Enter");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent", "Call mom"]);
    // Added here, it's pinned to Today and shows it; "Pay rent" already shows Today as its due date.
    await expect(row(popup, "Call mom").locator("[data-chip=today]")).toHaveText("Today");
    await expect(row(popup, "Call mom")).toHaveAccessibleName(/added to Today/);
    await expect(row(popup, "Pay rent").locator("[data-chip=today]")).toHaveCount(0);

    await popup.getByRole("tab", { name: "All" }).click();
    await expect(row(popup, "Someday").locator("[data-chip=today]")).toHaveCount(0);
    await rowAction(row(popup, "Someday"), "Add to Today");
    await expect(row(popup, "Someday").locator("[data-chip=today]")).toHaveText("Today");
    await popup.getByRole("tab", { name: "Today" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent", "Someday", "Call mom"]);

    await rowAction(row(popup, "Call mom"), "Remove from Today");
    await popup.getByRole("tab", { name: "All" }).click();
    await expect(row(popup, "Call mom").locator("[data-chip=today]")).toHaveCount(0);
    await popup.getByRole("tab", { name: "Today" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent", "Someday"]);
  });

  test("says plainly that focus mode is on, with the way back right there", async ({ popup }) => {
    await addTodos(popup, "Write report today");

    const banner = popup.locator("[data-focus-banner]");

    await expect(banner).toHaveCount(0);
    await popup.getByRole("button", { name: "Focus mode" }).click();
    await expect(banner).toContainText("Focus mode · One at a time");

    // The header button says it leaves now.
    await popup.mouse.move(0, 0);
    await popup.getByRole("button", { name: "Focus mode" }).hover();
    await expect(popup.locator("[data-slot=tooltip-content]", { hasText: "Leave focus mode" })).toBeVisible();

    await banner.getByRole("button", { name: "Back to the list" }).click();
    await expect(banner).toHaveCount(0);
    await expect(popup.getByLabel("New to-do")).toBeFocused();
    await expect(popup.getByRole("button", { name: "Focus mode" })).toHaveAttribute("aria-pressed", "false");
  });

  test("keeps skipped to-dos skipped after the popup closes, until focus mode is turned off", async ({ popup, context, extensionId }) => {
    await addTodos(popup, "Write report today", "Water plants today", "Call the bank today");
    await popup.getByRole("button", { name: "Focus mode" }).click();

    const card = (page = popup) => page.getByRole("region", { name: "Focus on one to-do" });

    await card().getByRole("button", { name: "Skip" }).click();
    await card().getByRole("button", { name: "Skip" }).click();
    await expect(card().getByRole("heading", { name: "Call the bank" })).toBeVisible();
    await popup.close();

    // Opened directly: in focus mode there's no input to wait for.
    const again = await context.newPage();

    await again.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(card(again).getByRole("heading", { name: "Call the bank" })).toBeVisible();

    // Leaving focus mode starts the next session from the top.
    await again.getByRole("button", { name: "Focus mode" }).click();
    await again.getByRole("button", { name: "Focus mode" }).click();
    await expect(card(again).getByRole("heading", { name: "Write report" })).toBeVisible();
  });

  test("focus mode goes one at a time, and the timer runs on the badge", async ({ popup, worker }) => {
    const badge = async () => worker.evaluate(async () => (globalThis as unknown as { chrome: { action: { getBadgeText: (details: object) => Promise<string> } } }).chrome.action.getBadgeText({}));

    await addTodos(popup, "Write report today", "Water plants today", "Later");

    await popup.getByRole("button", { name: "Focus mode" }).click();
    await expect(popup.getByRole("button", { name: "Focus mode" })).toHaveAttribute("aria-pressed", "true");

    const card = popup.getByRole("region", { name: "Focus on one to-do" });

    await expect(card.getByRole("heading", { name: "Write report" })).toBeVisible();
    await expect(card.getByText("Today · 2 left")).toBeVisible();

    await card.getByRole("button", { name: "Skip" }).click();
    await expect(card.getByRole("heading", { name: "Water plants" })).toBeVisible();

    // The chips show just the number; the start button names the unit.
    await card.getByText("15", { exact: true }).click();
    await expect(card.getByRole("radio", { name: "15 min" })).toBeChecked();
    await card.getByRole("button", { name: "Start a 15-minute timer" }).click();
    await expect(card.getByRole("timer", { name: "Focus timer" })).toHaveText(/^1[45]:\d\d$/);
    await expect(popup.getByRole("progressbar", { name: "Focus timer" })).toBeVisible();
    await expect.poll(badge, { timeout: 10_000 }).toBe("15m");

    await card.getByRole("button", { name: "Done" }).click();
    await expect(card.getByRole("heading", { name: "Write report" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Skip" })).toBeDisabled();

    await card.getByRole("button", { name: "Stop" }).click();
    await expect.poll(badge, { timeout: 10_000 }).toBe("1");

    await card.getByRole("button", { name: "Done" }).click();

    // Today is clear, so focus offers the rest of the list.
    await expect(card.getByRole("heading", { name: "Later" })).toBeVisible();
    await expect(card.getByText("1 left here")).toBeVisible();
    await card.getByRole("button", { name: "Done" }).click();

    await expect(card.getByRole("heading", { name: "All clear" })).toBeVisible();
    await popup.getByRole("button", { name: "Back to the list" }).click();
    await expect(popup.getByLabel("New to-do")).toBeFocused();
  });

  test("sets the default timer length in settings", async ({ popup }) => {
    await addTodos(popup, "Read");
    await popup.getByRole("button", { name: "Settings" }).click();
    await popup.getByRole("dialog", { name: "Settings" }).getByRole("radio", { name: "50 min" }).check();
    await popup.keyboard.press("Escape");

    await popup.getByRole("button", { name: "Focus mode" }).click();
    await expect(popup.getByRole("button", { name: "Start a 50-minute timer" })).toBeVisible();
  });

  test("starts a timer of any length from 1 to 180 minutes, with the lengths on one line", async ({ popup, worker }) => {
    const badge = async () => worker.evaluate(async () => (globalThis as unknown as { chrome: { action: { getBadgeText: (details: object) => Promise<string> } } }).chrome.action.getBadgeText({}));

    await addTodos(popup, "Write report today");
    await popup.getByRole("button", { name: "Focus mode" }).click();

    const card = popup.getByRole("region", { name: "Focus on one to-do" });
    const chips = card.locator("fieldset label");

    await expect(chips).toHaveCount(5);
    expect(new Set(await chips.evaluateAll(labels => labels.map(label => Math.round(label.getBoundingClientRect().top)))).size).toBe(1);

    // Centered: as much room on either side of the start button.
    const start = await card.getByRole("button", { name: /^Start a/ }).boundingBox();
    const box = await card.getByRole("button", { name: /^Start a/ }).locator("..").boundingBox();

    expect(Math.abs((start!.x - box!.x) - (box!.x + box!.width - start!.x - start!.width))).toBeLessThan(2);

    await card.getByText("Custom").click();

    const minutes = card.getByRole("spinbutton", { name: "Minutes" });

    await expect(minutes).toBeFocused();
    await minutes.fill("0");
    await expect(card.getByRole("button", { name: "Enter 1 to 180 minutes" })).toBeDisabled();
    await minutes.fill("181");
    await expect(card.getByRole("button", { name: "Enter 1 to 180 minutes" })).toBeDisabled();
    await minutes.fill("40");
    await expect(card.getByRole("button", { name: "Start a 40-minute timer" })).toBeEnabled();
    await minutes.press("Enter");
    await expect(card.getByRole("timer", { name: "Focus timer" })).toHaveText(/^(40:00|39:\d\d)$/);
    await expect.poll(badge, { timeout: 10_000 }).toBe("40m");
  });
});
