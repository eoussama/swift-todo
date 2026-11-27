import { addTodos, expect, listedTexts, row, rowAction, test } from "./fixtures";



test.describe("hidden to-dos", () => {
  test("shows dots instead of the text everywhere, until revealed for the moment", async ({ popup, openPopup }) => {
    await addTodos(popup, "Wi-Fi password: hunter2", "Buy milk");

    const secret = row(popup, "Wi-Fi password: hunter2");

    await rowAction(secret, "Hide the text");

    const hidden = popup.getByRole("group", { name: /^Hidden to-do,/ });

    await expect(hidden).toBeVisible();
    await expect.poll(async () => listedTexts(popup)).toEqual(["", "Buy milk"]);
    await expect(popup.locator("[data-hidden-text] svg.scribble")).toHaveCount(1);
    await expect(popup.getByText("hunter2")).toHaveCount(0);

    // A peek, from the eye button.
    await hidden.hover();
    await hidden.getByRole("button", { name: "Show the text" }).click();
    await expect(secret).toBeVisible();
    await expect(secret.getByRole("button", { name: "Hide the text again" })).toHaveAttribute("aria-pressed", "true");

    // Hidden again, its link's icon doesn't give the address away either.
    await secret.getByRole("button", { name: "Hide the text again" }).click();
    await rowAction(hidden, "Add a link…");
    await popup.getByRole("textbox", { name: "Web address" }).fill("router.example/admin");
    await popup.getByRole("button", { name: "Save" }).click();
    await hidden.getByRole("button", { name: "Open the link (opens in a new tab)" }).hover();
    await expect(popup.locator("[data-slot=tooltip-content]", { hasText: "Open the link" })).toBeVisible();
    await expect(popup.getByText("router.example")).toHaveCount(0);

    // Opening the popup again hides it again.
    const again = await openPopup();

    await expect(again.getByRole("group", { name: /^Hidden to-do,/ })).toBeVisible();
    await expect(again.getByText("hunter2")).toHaveCount(0);
  });

  test("keeps the text out of the full view, dialogs, toasts, the trash and focus mode, and copies it all the same", async ({ popup }) => {
    await addTodos(popup, "Door code 4512 today");
    await rowAction(row(popup, "Door code 4512"), "Hide the text");

    const hidden = popup.getByRole("group", { name: /^Hidden to-do,/ });
    const view = popup.getByRole("dialog", { name: "To-do" });

    await popup.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => void ((globalThis as unknown as { copied: string }).copied = text) } });
    });

    await rowAction(hidden, "View in full");
    await expect(view.locator("[data-view-text]")).toHaveText("Hidden to-do");
    await view.getByRole("button", { name: "Copy" }).click();
    expect(await popup.evaluate(() => (globalThis as unknown as { copied: string }).copied)).toBe("Door code 4512");
    await view.getByRole("button", { name: "Show the text" }).click();
    await expect(view.locator("[data-view-text]")).toHaveText("Door code 4512");
    await popup.keyboard.press("Escape");

    await rowAction(hidden, "Schedule…");
    await expect(popup.getByRole("dialog", { name: "Schedule" })).toContainText("When is “Hidden to-do” due?");
    await popup.keyboard.press("Escape");

    const card = popup.getByRole("region", { name: "Focus on one to-do" });

    await popup.getByRole("button", { name: "Focus mode" }).click();
    await expect(card.getByRole("heading")).toHaveText("Hidden to-do");
    await card.getByRole("button", { name: "Show the text" }).click();
    await expect(card.getByRole("heading")).toHaveText("Door code 4512");
    await popup.getByRole("button", { name: "Back to the list" }).click();

    await hidden.focus();
    await popup.keyboard.press("Delete");
    await expect(popup.getByText("Moved “Hidden to-do” to the trash")).toBeVisible();
    await popup.getByRole("button", { name: /Trash/ }).click();
    await expect(popup.getByRole("group", { name: "Hidden to-do, in the trash" }).locator("svg.scribble")).toHaveCount(1);
    await expect(popup.getByText("Door code")).toHaveCount(0);
  });

  test("is turned off again from the menu or the edit form", async ({ popup }) => {
    await addTodos(popup, "PIN 1234");
    await rowAction(row(popup, "PIN 1234"), "Hide the text");

    const hidden = popup.getByRole("group", { name: /^Hidden to-do,/ });

    await rowAction(hidden, "Stop hiding the text");
    await expect(row(popup, "PIN 1234")).toBeVisible();

    await rowAction(row(popup, "PIN 1234"), "View in full");

    const view = popup.getByRole("dialog", { name: "To-do" });

    await view.getByRole("button", { name: "Edit" }).click();
    await view.getByLabel("Hide the text").check();
    await view.getByRole("button", { name: "Save" }).click();
    await expect(view.locator("[data-view-text]")).toHaveText("Hidden to-do");
    await view.getByRole("button", { name: "Edit" }).click();
    await expect(view.getByRole("textbox", { name: "Edit to-do" })).toHaveValue("PIN 1234");
    await view.getByLabel("Hide the text").uncheck();
    await view.getByRole("button", { name: "Save" }).click();
    await popup.keyboard.press("Escape");
    await expect(row(popup, "PIN 1234")).toBeVisible();
  });
});
