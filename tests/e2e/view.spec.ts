import AxeBuilder from "@axe-core/playwright";

import { choose, expect, pickDate, row, rowAction, settled, test, typeTime } from "./fixtures";



// The stored record of a to-do, by its text, from sync or the device.
async function stored(storage: (area: "sync" | "local") => Promise<Record<string, unknown>>, text: string): Promise<Record<string, unknown> | undefined> {
  const all = { ...(await storage("local")), ...(await storage("sync")) };

  return Object.values(all).find((value): value is Record<string, unknown> => typeof value === "object" && value !== null && (value as { t?: unknown }).t === text);
}

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

    await settled(popup);
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

  test("edits the details too: date and time, repeat, list, link and Today, saved together", async ({ popup, storage }) => {
    // A long walk through every field.
    test.slow();

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

    await expect(dialog.getByRole("group", { name: "Time" }).getByRole("spinbutton").first()).toHaveAttribute("aria-disabled", "true");
    await pickDate(dialog, "Date", day);
    await typeTime(dialog.getByRole("group", { name: "Time" }), "09:30");
    await choose(dialog, "Repeats", "Every month");
    await choose(dialog, "List", "Work");
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
    await expect(dialog).toBeHidden();

    await expect(invoice).toHaveAccessibleName(/9:30.*repeats Every month.*added to Today.*links to example\.com/);
    await expect.poll(async () => Object.keys((await stored(storage, "Send the invoice")) ?? {}).filter(key => ["l", "w", "r", "s", "y"].includes(key)).sort()).toEqual(["l", "r", "s", "w", "y"]);

    // And back: no date, no repeat, the Inbox, no link, off Today.
    await rowAction(invoice, "View in full");
    await dialog.getByRole("button", { name: "Edit" }).click();
    await dialog.getByRole("button", { name: /^Date: / }).click();
    await popup.getByRole("button", { name: "Remove date" }).click();
    await choose(dialog, "Repeats", "Doesn't repeat");
    await choose(dialog, "List", "Inbox");
    await dialog.getByLabel("Web address").fill("");
    await dialog.getByLabel("Add to Today").uncheck();
    await dialog.getByRole("button", { name: "Save" }).click();
    await popup.keyboard.press("Escape");
    await expect(invoice).toHaveAccessibleName(/^Send the invoice, not done, (synced|saving to sync|on this device)/);
    // Nothing of the old details is left in storage either.
    await expect.poll(async () => Object.keys((await stored(storage, "Send the invoice")) ?? {}).filter(key => ["l", "w", "r", "s", "y"].includes(key))).toEqual([]);
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
  test("adds a link to any to-do, opens it, changes it and removes it", async ({ popup, context, storage }) => {
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

    // Its icon on the row shows the address, and opens it too.
    const icon = recipe.getByRole("button", { name: "Open the link (opens in a new tab)" });

    await icon.hover();
    await expect(popup.locator("[data-slot=tooltip-content]", { hasText: "https://example.com/lasagna" })).toBeVisible();

    const fromIcon = context.waitForEvent("page");

    await icon.click();
    expect((await fromIcon).url()).toBe("https://example.com/lasagna");

    // Chromium can't grant clipboard access to an extension page, so copies are recorded instead.
    await popup.bringToFront();
    await popup.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => void ((globalThis as unknown as { copied: string }).copied = text) } });
    });
    const copied = async (): Promise<string> => popup.evaluate(() => (globalThis as unknown as { copied: string }).copied);

    // Copied from the menu, under Copy text.
    await recipe.hover();
    await recipe.getByRole("button", { name: "More actions" }).click();
    await expect(popup.getByRole("menuitem").nth(2)).toHaveText("Copy link");
    await popup.getByRole("menuitem", { name: "Copy link" }).click();
    await expect(popup.getByText("Copied the link")).toBeVisible();
    expect(await copied()).toBe("https://example.com/lasagna");

    // And in full, from beside the link.
    await popup.evaluate(() => ((globalThis as unknown as { copied: string }).copied = ""));
    await rowAction(recipe, "View in full");

    const view = popup.getByRole("dialog", { name: "To-do" });

    await expect(view.getByRole("button", { name: "example.com" })).toBeVisible();
    await view.getByRole("button", { name: "Copy link" }).click();
    await expect.poll(copied).toBe("https://example.com/lasagna");
    await popup.keyboard.press("Escape");

    await rowAction(recipe, "Edit the link…");
    await expect(address).toHaveValue("https://example.com/lasagna");
    await dialog.getByRole("button", { name: "Remove link" }).click();
    await expect(recipe).not.toHaveAccessibleName(/links to/);
    await expect.poll(async () => (await stored(storage, "Try the lasagna recipe"))?.s).toBeUndefined();
    await recipe.hover();
    await recipe.getByRole("button", { name: "More actions" }).click();
    await expect(popup.getByRole("menuitem", { name: "Open the link" })).toHaveCount(0);
    await expect(popup.getByRole("menuitem", { name: "Add a link…" })).toBeVisible();
  });
});
