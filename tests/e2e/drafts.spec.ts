import { addTodos, expect, listedTexts, row, rowAction, test } from "./fixtures";



// Closing the popup keeps what wasn't saved yet: it opens again just as it was left.
test.describe("closing the popup", () => {
  test("keeps the to-do being written, until it's added", async ({ popup, openPopup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Groceries:");
    await input.press("Shift+Enter");
    await input.pressSequentially("milk");
    await popup.close();

    const next = await openPopup();
    const kept = next.getByLabel("New to-do");

    await expect(kept).toHaveValue("Groceries:\nmilk");
    // Typing carries on at the end.
    await next.keyboard.type(", eggs");
    await kept.press("Enter");
    await expect.poll(async () => listedTexts(next)).toEqual(["Groceries:\nmilk, eggs"]);
    await next.close();

    await expect((await openPopup()).getByLabel("New to-do")).toHaveValue("");
  });

  test("keeps a to-do being edited, open where it was", async ({ popup, openPopup }) => {
    await addTodos(popup, "Water the plants");
    await popup.getByText("Water the plants").click();
    await popup.getByLabel("Edit to-do").pressSequentially(" and the herbs");
    await popup.close();

    const next = await openPopup({ restored: true });
    const editor = next.getByLabel("Edit to-do");

    await expect(editor).toHaveValue("Water the plants and the herbs");
    await expect(editor).toBeFocused();
    await editor.press("Enter");
    await expect.poll(async () => listedTexts(next)).toEqual(["Water the plants and the herbs"]);
    await next.close();

    // Saved, it's done with.
    await expect((await openPopup()).getByLabel("Edit to-do")).toHaveCount(0);
  });

  test("keeps the full view's edit form, until it's saved or left", async ({ popup, openPopup }) => {
    await addTodos(popup, "Plan the trip");
    await rowAction(row(popup, "Plan the trip"), "View in full");
    await popup.getByRole("dialog", { name: "To-do" }).getByRole("button", { name: "Edit" }).click();
    await popup.getByRole("dialog", { name: "To-do" }).getByRole("textbox", { name: "Edit to-do" }).fill("Plan the trip to Lisbon");
    await popup.getByRole("dialog", { name: "To-do" }).getByText("Pin to the top").click();
    await popup.close();

    let next = await openPopup({ restored: true });
    let view = next.getByRole("dialog", { name: "To-do" });

    await expect(view.getByRole("textbox", { name: "Edit to-do" })).toHaveValue("Plan the trip to Lisbon");
    await expect(view.getByRole("checkbox", { name: "Pin to the top" })).toBeChecked();
    await view.getByRole("button", { name: "Save" }).click();
    await expect(row(next, "Plan the trip to Lisbon")).toHaveAccessibleName(/pinned/);
    // Still open, reading: closed now, it stays closed.
    await view.getByRole("button", { name: "Close" }).click();
    await expect(view).toBeHidden();
    await next.close();

    next = await openPopup();
    view = next.getByRole("dialog", { name: "To-do" });
    await expect(view).toHaveCount(0);
  });

  test("keeps a dialog open on its to-do, with what was picked or typed", async ({ popup, openPopup }) => {
    await addTodos(popup, "Read the article");
    await rowAction(row(popup, "Read the article"), "Add a link…");
    await popup.getByRole("textbox", { name: "Web address" }).fill("example.com/article");
    await popup.close();

    let next = await openPopup({ restored: true });
    const link = next.getByRole("dialog", { name: "Link" });

    await expect(link.getByRole("textbox", { name: "Web address" })).toHaveValue("example.com/article");
    await link.getByRole("button", { name: "Save" }).click();
    await expect(row(next, "Read the article")).toHaveAccessibleName(/links to example\.com/);

    await rowAction(row(next, "Read the article"), "Schedule…");

    const schedule = next.getByRole("dialog", { name: "Schedule" });

    await schedule.getByRole("button", { name: "Tomorrow" }).click();
    await schedule.getByRole("switch").click();
    await next.close();

    next = await openPopup({ restored: true });

    const again = next.getByRole("dialog", { name: "Schedule" });

    await expect(again.getByRole("switch")).toBeChecked();
    await again.getByRole("button", { name: "Save" }).click();
    await expect(row(next, "Read the article")).toHaveAccessibleName(/due Tomorrow/);
    await next.close();

    await expect((await openPopup()).getByRole("dialog")).toHaveCount(0);
  });

  test("keeps the settings open, and a list name being typed", async ({ popup, openPopup }) => {
    await popup.getByRole("button", { name: "New list" }).click();
    await popup.getByRole("textbox", { name: "New list" }).fill("Groc");
    await popup.close();

    let next = await openPopup({ restored: true });
    const name = next.getByRole("textbox", { name: "New list" });

    await expect(name).toHaveValue("Groc");
    await expect(name).toBeFocused();
    await name.pressSequentially("eries");
    await name.press("Enter");
    await expect(next.getByRole("tab", { name: "Groceries" })).toBeVisible();

    await next.getByRole("button", { name: "Settings" }).click();

    const settings = next.getByRole("dialog", { name: "Settings" });

    await settings.getByRole("textbox", { name: "Name of list Groceries" }).fill("Shopping");
    await next.close();

    next = await openPopup({ restored: true });

    const kept = next.getByRole("dialog", { name: "Settings" });

    await expect(kept).toBeVisible();
    await expect(kept.getByRole("textbox", { name: "Name of list Groceries" })).toHaveValue("Shopping");
    await kept.getByRole("textbox", { name: "Name of list Groceries" }).press("Enter");
    await expect(next.getByRole("tab", { name: "Shopping" })).toBeVisible();
    await kept.getByRole("button", { name: "Back to the list" }).click();
    await next.close();

    await expect((await openPopup()).getByRole("dialog")).toHaveCount(0);
  });
});

test("opens fresh after more than five minutes away, with nothing kept", async ({ popup, context, extensionId }) => {
  await popup.getByLabel("New to-do").fill("Half a thought");
  await popup.getByRole("button", { name: "Settings" }).click();
  await popup.close();

  // Six minutes on, as far as the popup can tell: its last look at the clock is set back before it starts.
  const next = await context.newPage();

  await next.addInitScript(() => localStorage.setItem("swift-todo:draft:seen", String(Date.now() - 6 * 60_000)));
  await next.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(next.getByLabel("New to-do")).toBeFocused();
  await expect(next.getByLabel("New to-do")).toHaveValue("");
  await expect(next.getByRole("dialog")).toHaveCount(0);
});
