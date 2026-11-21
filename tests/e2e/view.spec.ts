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

  test("opens from the row's View button too, and copies the text from the menu", async ({ popup }) => {
    // Chromium can't grant clipboard access to an extension page, so the copy is recorded instead.
    await popup.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => void ((globalThis as unknown as { copied: string }).copied = text) } });
    });

    const input = popup.getByLabel("New to-do");

    await input.fill(LONG);
    await input.press("Enter");

    const long = popup.getByRole("group", { name: /^Write the quarterly report/ });

    await long.hover();
    await long.getByRole("button", { name: "View in full" }).click();
    await expect(popup.getByRole("dialog", { name: "To-do" }).locator("[data-view-text]")).toHaveText(LONG);
    await popup.keyboard.press("Escape");

    await rowAction(long, "Copy text");
    await expect(popup.getByText("Copied")).toBeVisible();
    expect(await popup.evaluate(() => (globalThis as unknown as { copied: string }).copied)).toBe(LONG);
  });

  test("edits the details too: date and time, repeat, list, link and Today, saved together", async ({ popup }) => {
    await popup.getByRole("button", { name: "New list" }).click();
    await popup.keyboard.type("Work");
    await popup.keyboard.press("Enter");
    await popup.getByRole("tab", { name: "All" }).click();

    const input = popup.getByLabel("New to-do");

    await input.fill("Send the invoice");
    await input.press("Enter");

    const invoice = row(popup, "Send the invoice");
    const dialog = popup.getByRole("dialog", { name: "To-do" });

    await rowAction(invoice, "View in full");
    await dialog.getByRole("button", { name: "Edit" }).click();

    // Ten days out, so it isn't "today" and the Today pin shows on its own.
    const later = new Date();

    later.setDate(later.getDate() + 10);

    const day = [later.getFullYear(), later.getMonth() + 1, later.getDate()].map(part => String(part).padStart(2, "0")).join("-");

    await expect(dialog.getByLabel("Time")).toBeDisabled();
    await dialog.getByLabel("Date").fill(day);
    await dialog.getByLabel("Time").fill("09:30");
    await dialog.getByLabel("Repeats").selectOption({ label: "Every month" });
    await dialog.getByLabel("List").selectOption({ label: "Work" });
    await dialog.getByLabel("Web address").fill("not a link");
    await dialog.getByLabel("Add to Today").check();
    await dialog.getByRole("button", { name: "Save" }).click();

    // A bad link holds the save back, with the reason.
    await expect(dialog.getByRole("alert")).toHaveText("Type a web address, like example.com/page.");
    await dialog.getByLabel("Web address").fill("example.com/invoices");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog.locator("[data-view-text]")).toHaveText("Send the invoice");
    await expect(dialog.getByRole("definition").filter({ hasText: /9:30/ })).toBeVisible();
    await expect(dialog.getByText("Every month")).toBeVisible();
    await expect(dialog.getByRole("definition").filter({ hasText: "Work" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "example.com" })).toBeVisible();
    await expect(dialog.getByText("Added to Today")).toBeVisible();
    await popup.keyboard.press("Escape");

    await expect(invoice).toHaveAccessibleName(/9:30.*repeats Every month.*added to Today.*links to example\.com/);

    // And back: no date, no repeat, the Inbox, no link, off Today.
    await rowAction(invoice, "View in full");
    await dialog.getByRole("button", { name: "Edit" }).click();
    await dialog.getByLabel("Date").fill("");
    await dialog.getByLabel("Repeats").selectOption({ label: "Doesn't repeat" });
    await dialog.getByLabel("List").selectOption({ label: "Inbox" });
    await dialog.getByLabel("Web address").fill("");
    await dialog.getByLabel("Add to Today").uncheck();
    await dialog.getByRole("button", { name: "Save" }).click();
    await popup.keyboard.press("Escape");
    await expect(invoice).toHaveAccessibleName(/^Send the invoice, not done, (synced|saving to sync|on this device)/);
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

test.describe("links", () => {
  test("adds a link to any to-do, opens it, changes it and removes it", async ({ popup, context }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Try the lasagna recipe");
    await input.press("Enter");

    const recipe = row(popup, "Try the lasagna recipe");
    const dialog = popup.getByRole("dialog", { name: "Link" });
    const address = dialog.getByRole("textbox", { name: "Web address" });

    await rowAction(recipe, "Add a link…");
    await address.fill("not a link");
    await address.press("Enter");
    await expect(dialog.getByRole("alert")).toHaveText("Type a web address, like example.com/page.");
    await expect(dialog.getByRole("button", { name: "Remove link" })).toHaveCount(0);

    await address.fill("example.com/lasagna");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(recipe).toHaveAccessibleName(/links to example\.com/);

    // Opens in a new tab.
    const opened = context.waitForEvent("page");

    await rowAction(recipe, "Open the link");
    expect((await opened).url()).toBe("https://example.com/lasagna");

    await rowAction(recipe, "View in full");
    await expect(popup.getByRole("dialog", { name: "To-do" }).getByRole("button", { name: "example.com" })).toBeVisible();
    await popup.keyboard.press("Escape");

    await rowAction(recipe, "Edit the link…");
    await expect(address).toHaveValue("https://example.com/lasagna");
    await dialog.getByRole("button", { name: "Remove link" }).click();
    await expect(recipe).not.toHaveAccessibleName(/links to/);
    await recipe.hover();
    await recipe.getByRole("button", { name: "More actions" }).click();
    await expect(popup.getByRole("menuitem", { name: "Open the link" })).toHaveCount(0);
    await expect(popup.getByRole("menuitem", { name: "Add a link…" })).toBeVisible();
  });
});
