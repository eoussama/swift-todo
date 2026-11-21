import AxeBuilder from "@axe-core/playwright";

import { expect, row, rowAction, test } from "./fixtures";



test.describe("view in full", () => {
  const LONG = "Write the quarterly report for the board with every number from the third quarter, the hiring plan, the office move and next year's budget #work";

  test("shows a long to-do whole, with its details, and edits it there", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill(`${LONG} tomorrow 3pm`);
    await input.press("Enter");

    const long = popup.getByRole("group", { name: /^Write the quarterly report/ });

    await rowAction(long, "View in full");

    const dialog = popup.getByRole("dialog", { name: "To-do" });

    await expect(dialog.locator("[data-view-text]")).toHaveText(LONG);
    await expect(dialog.getByRole("definition").first()).toHaveText(/^Tomorrow 3:00\sPM$/);
    await expect(dialog.getByText("Inbox")).toBeVisible();

    const scan = await new AxeBuilder({ page: popup }).include("[role=dialog]").analyze();

    expect(scan.violations.map(violation => violation.id)).toEqual([]);

    // Edited in a roomy box: Enter saves, and the view shows the new text.
    await dialog.getByRole("button", { name: "Edit" }).click();

    const editor = dialog.getByRole("textbox", { name: "Edit to-do" });

    await expect(editor).toHaveValue(LONG);
    await editor.fill("Send the short version of the report #work");
    await editor.press("Enter");
    await expect(dialog.locator("[data-view-text]")).toHaveText("Send the short version of the report #work");

    await popup.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(row(popup, "Send the short version of the report #work")).toBeVisible();
  });

  test("opens with V on a row, and Escape leaves editing before closing", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Call the plumber about the kitchen sink");
    await input.press("Enter");
    await row(popup, "Call the plumber about the kitchen sink").focus();
    await popup.keyboard.press("v");

    const dialog = popup.getByRole("dialog", { name: "To-do" });

    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Edit" }).click();
    await dialog.getByRole("textbox", { name: "Edit to-do" }).fill("Something else");

    await popup.keyboard.press("Escape");
    await expect(dialog.getByRole("textbox")).toBeHidden();
    await expect(dialog.locator("[data-view-text]")).toHaveText("Call the plumber about the kitchen sink");

    await popup.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
