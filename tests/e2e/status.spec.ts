import type { Page } from "@playwright/test";

import { addTodos, choose, expect, listedTexts, row, test } from "./fixtures";



/**
 * Adds a stage of one's own in the settings, and leaves them.
 *
 * @param page The popup.
 * @param status The status it's under: "todo", "doing" or "done".
 * @param name Its name.
 * @returns Once added.
 */
async function addStage(page: Page, status: string, name: string): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();

  const field = page.locator(`[data-stages=${status}]`).getByPlaceholder("New stage");

  await field.fill(name);
  await field.press("Enter");
  await expect(page.locator(`[data-stages=${status}] li input`).last()).toHaveValue(name);
  await page.keyboard.press("Escape");
}

/**
 * Picks a status (or a stage) for a to-do from its menu.
 *
 * @param page The popup.
 * @param text The to-do's text.
 * @param choice The status or stage, as the menu names it.
 * @returns Once picked.
 */
async function pickStatus(page: Page, text: string, choice: string): Promise<void> {
  await row(page, text).hover();
  await row(page, text).getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: /^Status/ }).click();
  await page.getByRole("menuitemradio", { name: choice, exact: true }).click();
}

const header = (page: Page, name: RegExp) => page.getByRole("button", { name });

test.describe("statuses", () => {
  test("splits the list into To do, In progress and Done, each folding away, with I for in progress", async ({ popup, openPopup }) => {
    await addTodos(popup, "Write notes", "Fix the bug", "Pay rent");

    // Only to-dos to do: no titles at all.
    await expect(header(popup, /^To do/)).toHaveCount(0);

    await row(popup, "Fix the bug").focus();
    await popup.keyboard.press("i");

    const fixing = row(popup, "Fix the bug");

    await expect(fixing).toHaveAccessibleName(/In progress/);
    await expect(fixing.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
    await expect(fixing.locator("[data-chip=status]")).toHaveText("In progress");
    await expect(header(popup, /^To do · 2$/)).toBeVisible();
    await expect(header(popup, /^In progress · 1$/)).toBeVisible();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Write notes", "Pay rent", "Fix the bug"]);

    await row(popup, "Pay rent").getByRole("checkbox").click();
    await expect(header(popup, /^Done · 1$/)).toBeVisible();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Write notes", "Fix the bug", "Pay rent"]);

    // Folded, and still folded next time.
    await header(popup, /^In progress/).click();
    await expect(header(popup, /^In progress/)).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Write notes", "Pay rent"]);
    await header(popup, /^To do/).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent"]);

    const reopened = await openPopup();

    await expect(header(reopened, /^To do/)).toHaveAttribute("aria-expanded", "false");
    await expect(header(reopened, /^In progress/)).toHaveAttribute("aria-expanded", "false");
    await header(reopened, /^To do/).click();
    await header(reopened, /^In progress/).click();

    // Checked off from in progress, it's done; unchecked, it's to do again, at no stage.
    await row(reopened, "Fix the bug").getByRole("checkbox").click();
    await expect.poll(async () => listedTexts(reopened)).toEqual(["Write notes", "Fix the bug", "Pay rent"]);
    await expect(header(reopened, /^In progress/)).toHaveCount(0);
    await row(reopened, "Fix the bug").getByRole("checkbox").click();
    await expect(row(reopened, "Fix the bug").locator("[data-chip=status]")).toHaveCount(0);

    // I takes it back and forth.
    await row(reopened, "Write notes").focus();
    await reopened.keyboard.press("i");
    await expect(row(reopened, "Write notes").locator("[data-chip=status]")).toBeVisible();
    await reopened.keyboard.press("i");
    await expect(row(reopened, "Write notes").locator("[data-chip=status]")).toHaveCount(0);
  });

  test("sets stages of one's own from the menu or the chip, and keeps a to-do's status when its stage goes", async ({ popup }) => {
    await addTodos(popup, "Ship the release");
    await addStage(popup, "doing", "Review");
    await addStage(popup, "done", "Shipped");

    await pickStatus(popup, "Ship the release", "Review");

    const task = row(popup, "Ship the release");
    const chip = task.locator("[data-chip=status]");

    await expect(chip).toHaveText("Review");
    await expect(header(popup, /^In progress · 1$/)).toBeVisible();

    // The chip opens the same choices.
    await chip.click();
    await expect(popup.getByRole("menuitemradio", { name: "Review", exact: true })).toHaveAttribute("aria-checked", "true");
    await popup.getByRole("menuitemradio", { name: "Shipped", exact: true }).click();
    await expect(header(popup, /^Done · 1$/)).toBeVisible();
    await expect(chip).toHaveText("Shipped");
    await expect(task.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");

    // The full view says where it stands, and its form changes it.
    await task.locator("[data-chip=status]").click();
    await popup.getByRole("menuitemradio", { name: "Review", exact: true }).click();
    await task.focus();
    await popup.keyboard.press("v");

    const view = popup.getByRole("dialog", { name: "To-do" });

    await expect(view.locator("[data-view-status]")).toContainText("In progress · Review");
    await view.getByRole("button", { name: "Edit", exact: true }).click();
    await choose(view, "Status", "Done › Shipped");
    await view.getByRole("button", { name: "Save" }).click();
    await expect(view.locator("[data-view-status]")).toContainText("Done · Shipped");
    await popup.keyboard.press("Escape");

    // Its stage deleted, it stays done.
    await popup.getByRole("button", { name: "Settings" }).click();
    await popup.getByRole("button", { name: "Delete Shipped" }).click();
    await popup.keyboard.press("Escape");
    await expect(header(popup, /^Done · 1$/)).toBeVisible();
    await expect(task.locator("[data-chip=status]")).toHaveCount(0);
  });

  test("moves a repeating to-do to its next date when set to done, starting over as to do", async ({ popup }) => {
    await addTodos(popup, "Water the plants every day");
    await pickStatus(popup, "Water the plants", "In progress");
    await expect(header(popup, /^In progress · 1$/)).toBeVisible();

    await pickStatus(popup, "Water the plants", "Done");
    await expect(header(popup, /^In progress/)).toHaveCount(0);
    await expect(header(popup, /^Done/)).toHaveCount(0);
    await expect(row(popup, "Water the plants").locator("[data-chip=due]")).toContainText("Tomorrow");
  });
});
