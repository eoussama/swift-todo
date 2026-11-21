import AxeBuilder from "@axe-core/playwright";

import { addTodos, expect, row, rowAction, test } from "./fixtures";



for (const colorScheme of ["light", "dark"] as const) {
  test(`has no detectable accessibility issues in the ${colorScheme} theme`, async ({ popup }) => {
    await popup.emulateMedia({ colorScheme });

    const empty = await new AxeBuilder({ page: popup }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

    expect(empty.violations).toEqual([]);

    await addTodos(popup, "Reply to Sam about the offsite", "Buy oat milk", "Water the plants");
    await row(popup, "Buy oat milk").getByRole("checkbox").click();
    await popup.keyboard.press("ArrowDown");

    const list = await new AxeBuilder({ page: popup }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

    expect(list.violations).toEqual([]);

    await popup.getByRole("button", { name: "Focus mode" }).click();
    await popup.getByRole("button", { name: /Start a \d+-minute timer/ }).click();
    await expect(popup.getByRole("timer")).toBeVisible();

    const focus = await new AxeBuilder({ page: popup }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

    expect(focus.violations).toEqual([]);

    await popup.getByRole("button", { name: "Settings" }).click();
    await expect(popup.getByRole("dialog", { name: "Settings" })).toBeVisible();

    const settings = await new AxeBuilder({ page: popup }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

    expect(settings.violations).toEqual([]);
  });
}

// Zoomed to 200%, the 380 × 560 popup gets 380 × 300 CSS pixels (Chrome caps popups at 800 × 600 screen pixels).
test("works zoomed to 200%: nothing scrolls sideways, and dialogs stay on screen", async ({ popup }) => {
  await addTodos(popup, "Pay rent tomorrow", "Call mom", "Water plants");
  await popup.setViewportSize({ width: 380, height: 300 });

  const onScreen = async (locator: ReturnType<typeof popup.getByRole>): Promise<void> => {
    const box = (await locator.boundingBox())!;

    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(300);
  };

  expect(await popup.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);

  // The footer is a page scroll away.
  await popup.getByRole("button", { name: "Keyboard shortcuts" }).scrollIntoViewIfNeeded();
  await expect(popup.getByRole("button", { name: "Keyboard shortcuts" })).toBeInViewport();

  for (const [action, name] of [["Schedule…", "Schedule"], ["Repeat…", "Repeat"], ["View in full", "To-do"], ["Add a link…", "Link"]] as const) {
    await rowAction(row(popup, "Call mom"), action);

    const dialog = popup.getByRole("dialog", { name });

    await expect(dialog).toBeVisible();
    await onScreen(dialog);
    expect(await popup.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    await popup.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

  // A long dialog scrolls inside itself, so its buttons can still be reached.
  await rowAction(row(popup, "Call mom"), "Schedule…");

  const schedule = popup.getByRole("dialog", { name: "Schedule" });

  await schedule.getByRole("button", { name: "Tomorrow" }).click();
  await schedule.getByRole("button", { name: "Save" }).click();
  await expect(row(popup, "Call mom")).toHaveAccessibleName(/due Tomorrow/);
});
