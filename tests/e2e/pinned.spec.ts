import { addTodos, expect, listedTexts, row, rowAction, test } from "./fixtures";



test.describe("pinned to-dos", () => {
  test("sit at the top, from the menu or with P, until unpinned", async ({ popup }) => {
    await addTodos(popup, "Buy milk", "Call mom", "Pay rent");

    await rowAction(row(popup, "Pay rent"), "Pin to the top");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent", "Buy milk", "Call mom"]);
    await expect(row(popup, "Pay rent")).toHaveAccessibleName(/pinned/);
    await expect(row(popup, "Pay rent").locator("[data-pin]")).toHaveCount(1);

    await row(popup, "Call mom").focus();
    await popup.keyboard.press("p");
    // Pinned ones keep their list order among themselves.
    await expect.poll(async () => listedTexts(popup)).toEqual(["Call mom", "Pay rent", "Buy milk"]);

    // New to-dos still go below the pinned ones.
    await popup.getByLabel("New to-do").fill("Water plants");
    await popup.getByLabel("New to-do").press("Enter");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Call mom", "Pay rent", "Buy milk", "Water plants"]);

    await rowAction(row(popup, "Pay rent"), "Unpin");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Call mom", "Buy milk", "Pay rent", "Water plants"]);
  });

  test("move among themselves with Alt+arrows, and stop at the edge of the pinned group", async ({ popup }) => {
    await addTodos(popup, "One", "Two", "Three");
    await rowAction(row(popup, "Two"), "Pin to the top");
    await rowAction(row(popup, "Three"), "Pin to the top");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Two", "Three", "One"]);

    await row(popup, "Three").focus();
    await popup.keyboard.press("Alt+ArrowUp");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Three", "Two", "One"]);

    // The last pinned one doesn't drop below the line.
    await row(popup, "Two").focus();
    await popup.keyboard.press("Alt+ArrowDown");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Three", "Two", "One"]);
  });

  test("are pinned from the edit form, and show it in the full view", async ({ popup }) => {
    await addTodos(popup, "Buy milk", "Call mom");
    await rowAction(row(popup, "Call mom"), "View in full");

    const view = popup.getByRole("dialog", { name: "To-do" });

    await view.getByRole("button", { name: "Edit" }).click();
    await view.getByLabel("Pin to the top").check();
    await view.getByRole("button", { name: "Save" }).click();
    await expect(view.getByText("Pinned to the top")).toBeVisible();
    await popup.keyboard.press("Escape");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Call mom", "Buy milk"]);
  });

  test("stay pinned after the popup reopens, and through check-off, the trash and restoring", async ({ popup, openPopup }) => {
    await addTodos(popup, "Buy milk", "Call mom", "Pay rent");
    await rowAction(row(popup, "Pay rent"), "Pin to the top");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent", "Buy milk", "Call mom"]);
    await popup.close();

    const again = await openPopup();

    await expect.poll(async () => listedTexts(again)).toEqual(["Pay rent", "Buy milk", "Call mom"]);

    // Checked off, it goes to Done; unchecked, it's back on top.
    await row(again, "Pay rent").getByRole("checkbox").click();
    await expect.poll(async () => listedTexts(again)).toEqual(["Buy milk", "Call mom", "Pay rent"]);
    await row(again, "Pay rent").getByRole("checkbox").click();
    await expect.poll(async () => listedTexts(again)).toEqual(["Pay rent", "Buy milk", "Call mom"]);

    // Erased and restored, it's still pinned.
    await row(again, "Pay rent").focus();
    await again.keyboard.press("Delete");
    await expect.poll(async () => listedTexts(again)).toEqual(["Buy milk", "Call mom"]);
    await again.getByRole("button", { name: /^Trash/ }).click();
    await again.getByRole("button", { name: "Restore" }).click();
    await expect.poll(async () => listedTexts(again)).toEqual(["Pay rent", "Buy milk", "Call mom"]);
    await expect(row(again, "Pay rent")).toHaveAccessibleName(/pinned/);
  });

  test("keep unpinned ones from climbing above them with Alt+Up", async ({ popup }) => {
    await addTodos(popup, "One", "Two", "Three");
    await rowAction(row(popup, "Three"), "Pin to the top");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Three", "One", "Two"]);

    await row(popup, "One").focus();
    await popup.keyboard.press("Alt+ArrowUp");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Three", "One", "Two"]);
  });
});
