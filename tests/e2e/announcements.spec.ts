import { addTodos, expect, row, rowAction, test, typeTime } from "./fixtures";



test.describe("what the popup says, and when", () => {
  test("announces tag completion, keeps the sync status quiet, and marks links that open a tab", async ({ popup }) => {
    await addTodos(popup, "Read #books");

    const input = popup.getByLabel("New to-do");
    const status = popup.locator("form p.sr-only[role=status]");

    await input.fill("Buy #bo");
    await expect(status).toContainText("Tab completes #books. Type more letters for another tag.");
    await input.press("Tab");
    await expect(status).toContainText("Added #books.");
    await input.press("x");
    await expect(status).not.toContainText("Added");

    // The sync status is read when reached, not announced at every save.
    await expect(popup.locator("footer [aria-live]")).toHaveCount(0);

    await popup.getByRole("button", { name: "Settings" }).click();
    await expect(popup.getByRole("link", { name: "Release notes (opens in a new tab)", exact: true })).toBeVisible();
    await expect(popup.getByRole("link", { name: "Source code (opens in a new tab)", exact: true })).toBeVisible();
    await expect(popup.getByRole("link", { name: "Leave a tip (opens in a new tab)", exact: true })).toHaveAttribute("href", "https://to.ouss.es/tip");
  });

  test("waits for a whole time before saving, and says why", async ({ popup }) => {
    await addTodos(popup, "Gym");
    await rowAction(row(popup, "Gym"), "Schedule…");

    const dialog = popup.getByRole("dialog", { name: "Schedule" });
    const save = dialog.getByRole("button", { name: "Save" });

    await dialog.getByRole("button", { name: "Tomorrow" }).click();
    await dialog.getByRole("switch", { name: "Add a time" }).click();

    const time = dialog.getByRole("group", { name: "Time" });

    await typeTime(time, "09:00");
    await expect(save).toBeEnabled();

    // Emptying the hour leaves a part-time: not saved as the old 9:00.
    await time.getByRole("spinbutton").first().click();
    await popup.keyboard.press("Backspace");
    await popup.keyboard.press("Backspace");
    await expect(save).toBeDisabled();
    // Said in a status that's always there, so it's announced as it appears.
    await expect(dialog.getByRole("status").filter({ hasText: "Fill in the whole time to save." })).toBeVisible();
    await expect(save).toHaveAttribute("aria-describedby", "schedule-time-hint");

    await popup.keyboard.type("10");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(row(popup, "Gym")).toHaveAccessibleName(/due Tomorrow 10:00\sAM/);
  });

  test("lets the edit form save once the date with a part-time is removed", async ({ popup }) => {
    await addTodos(popup, "Gym tomorrow 9am");
    await rowAction(row(popup, "Gym"), "View in full");

    const view = popup.getByRole("dialog", { name: "To-do" });
    const save = view.getByRole("button", { name: "Save" });

    await view.getByRole("button", { name: "Edit" }).click();
    await view.getByRole("group", { name: "Time" }).getByRole("spinbutton").first().click();
    await popup.keyboard.press("Backspace");
    await popup.keyboard.press("Backspace");
    await expect(save).toBeDisabled();
    await expect(view.getByRole("alert").filter({ hasText: "Fill in the whole time to save." })).toBeVisible();

    await view.getByRole("button", { name: /^Date: / }).click();
    await popup.getByRole("button", { name: "Remove date" }).click();
    await expect(save).toBeEnabled();
    await expect(view.getByText("Fill in the whole time to save.")).toHaveCount(0);
    await save.click();
    await popup.keyboard.press("Escape");
    await expect(row(popup, "Gym")).toHaveAccessibleName(/^Gym, not done, (synced|saving to sync)/);
  });

  test("offers both stepper buttons while the number is empty", async ({ popup }) => {
    await addTodos(popup, "Gym");
    await rowAction(row(popup, "Gym"), "Repeat…");

    const dialog = popup.getByRole("dialog", { name: "Repeat" });

    await dialog.getByText("Custom", { exact: true }).click();
    await dialog.getByRole("spinbutton", { name: "Every" }).fill("");
    await expect(dialog.getByRole("button", { name: "Fewer" })).not.toHaveAttribute("aria-disabled", "true");
    await expect(dialog.getByRole("button", { name: "More" })).not.toHaveAttribute("aria-disabled", "true");
    await dialog.getByRole("button", { name: "More" }).click();
    await expect(dialog.getByRole("spinbutton", { name: "Every" })).toHaveValue("1");
    await expect(dialog.getByRole("button", { name: "Fewer" })).toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("west of UTC", () => {
  test.use({ timezoneId: "America/New_York" });

  test("shows the day picked on the edit form's date button, not the day before", async ({ popup }) => {
    await addTodos(popup, "Dentist");
    await rowAction(row(popup, "Dentist"), "Schedule…");
    await popup.getByRole("dialog", { name: "Schedule" }).getByRole("button", { name: "Tomorrow" }).click();
    await popup.getByRole("dialog", { name: "Schedule" }).getByRole("button", { name: "Save" }).click();

    // Tomorrow, as the popup sees it in New York.
    const tomorrow = await popup.evaluate(() => {
      const date = new Date();

      date.setDate(date.getDate() + 1);

      return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
    });

    await rowAction(row(popup, "Dentist"), "View in full");

    const view = popup.getByRole("dialog", { name: "To-do" });

    await view.getByRole("button", { name: "Edit" }).click();
    await expect(view.getByRole("button", { name: /^Date: / })).toHaveAccessibleName(`Date: ${tomorrow}`);
  });
});
