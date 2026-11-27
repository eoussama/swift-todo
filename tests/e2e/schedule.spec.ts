import { addTodos, expect, listedTexts, row, rowAction, test, typeTime } from "./fixtures";



test.describe("scheduling", () => {
  test("reads dates and repeats typed in the text", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Call Sam tomorrow 3pm");
    await expect(popup.getByRole("status").filter({ hasText: "Tomorrow" })).toBeVisible();
    await input.press("Enter");

    await expect(row(popup, "Call Sam")).toHaveAccessibleName(/due Tomorrow 3:00\sPM/);

    await input.fill("Water plants every 3 days");
    await input.press("Enter");
    await expect(row(popup, "Water plants")).toHaveAccessibleName(/repeats Every 3 days/);
  });

  test("keeps the words as typed when the preview is dismissed", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Read chapter monday");
    await popup.getByRole("button", { name: "Keep the words as typed" }).click();
    await input.press("Enter");

    await expect(row(popup, "Read chapter monday")).toHaveAccessibleName("Read chapter monday, not done, synced");
  });

  test("schedules from the row menu, and removes the date", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Book dentist");
    await input.press("Enter");

    await rowAction(row(popup, "Book dentist"), "Schedule…");

    const dialog = popup.getByRole("dialog", { name: "Schedule" });

    await dialog.getByRole("button", { name: "Tomorrow" }).click();
    await dialog.getByRole("switch", { name: "Add a time" }).click();
    await typeTime(dialog.getByRole("group", { name: "Time" }), "14:30");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(row(popup, "Book dentist")).toHaveAccessibleName(/due Tomorrow 2:30\sPM/);

    await rowAction(row(popup, "Book dentist"), "Schedule…");
    await popup.getByRole("dialog", { name: "Schedule" }).getByRole("button", { name: "Remove date" }).click();
    await expect(row(popup, "Book dentist")).toHaveAccessibleName("Book dentist, not done, synced");
  });

  test("repeats from the row menu, and moves to the next date when checked off", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Take vitamins");
    await input.press("Enter");

    await rowAction(row(popup, "Take vitamins"), "Repeat…");

    const dialog = popup.getByRole("dialog", { name: "Repeat" });

    await dialog.getByText("Every day", { exact: true }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(row(popup, "Take vitamins")).toHaveAccessibleName(/due Today, repeats Every day/);

    await row(popup, "Take vitamins").getByRole("checkbox").click();
    await expect(popup.getByText("Next: Tomorrow")).toBeVisible();
    await expect(row(popup, "Take vitamins")).toHaveAccessibleName(/not done, due Tomorrow, repeats Every day/);
  });

  test("logs each check-off of a repeating to-do, moves it to the bottom, and undoes both", async ({ popup }) => {
    await addTodos(popup, "Water plants every day", "Pay rent", "Read");

    const plants = row(popup, "Water plants");
    const view = popup.getByRole("dialog", { name: "To-do" });

    await plants.getByRole("checkbox").click();
    await expect(popup.getByText("Next: Tomorrow")).toBeVisible();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent", "Read", "Water plants"]);

    await rowAction(plants, "View in full");
    await expect(view.locator("[data-view-history]")).toContainText("Checked off once");
    await expect(view.locator("[data-view-history] li")).toHaveCount(1);
    await popup.keyboard.press("Escape");

    // Undo puts it back where it was, with its date and no check-off logged.
    await popup.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Water plants", "Pay rent", "Read"]);
    await expect(plants).toHaveAccessibleName(/due Today/);
    await rowAction(plants, "View in full");
    await expect(view.locator("[data-view-history]")).toHaveCount(0);
    await popup.keyboard.press("Escape");

    await plants.getByRole("checkbox").click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Pay rent", "Read", "Water plants"]);
    // Checked again (now for tomorrow): logged a second time, newest first.
    await plants.getByRole("checkbox").click();
    await rowAction(plants, "View in full");
    await expect(view.locator("[data-view-history]")).toContainText("Checked off 2 times");
    await expect(view.locator("[data-view-history] li")).toHaveCount(2);
  });

  test("sets a custom repeat on chosen weekdays", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Gym");
    await input.press("Enter");
    await rowAction(row(popup, "Gym"), "Repeat…");

    const dialog = popup.getByRole("dialog", { name: "Repeat" });

    await dialog.getByText("Custom", { exact: true }).click();
    await dialog.getByRole("button", { name: "Mon" }).click();
    await dialog.getByRole("button", { name: "Thu" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(row(popup, "Gym")).toHaveAccessibleName(/repeats Every Mon, Thu/);
  });
});

test.describe("toolbar badge", () => {
  test("counts what's due today, and turns off from settings", async ({ popup, worker }) => {
    const badge = async () => worker.evaluate(async () => (globalThis as unknown as { chrome: { action: { getBadgeText: (details: object) => Promise<string> } } }).chrome.action.getBadgeText({}));
    const input = popup.getByLabel("New to-do");

    await input.fill("Pay rent today");
    await input.press("Enter");
    await input.fill("Someday");
    await input.press("Enter");

    await expect.poll(badge, { timeout: 10_000 }).toBe("1");

    await popup.getByRole("button", { name: "Settings" }).click();
    await popup.getByRole("group", { name: "Toolbar badge" }).getByRole("radio", { name: "Off" }).check();
    await expect.poll(badge, { timeout: 10_000 }).toBe("");
  });
});

test.describe("reminder lead time", () => {
  test("shows a saved lead time that isn't one of the usual ones, in minutes or hours", async ({ seed, openPopup }) => {
    await seed({ sync: { prefs: { reminders: true, lead: 1 } } });

    let popup = await openPopup();

    await popup.getByRole("button", { name: "Settings" }).click();

    const when = popup.getByRole("combobox", { name: "When" });

    await expect(when).toHaveText("1 minute before");
    await when.click();
    await expect(popup.getByRole("option")).toHaveText(["At the due time", "1 minute before", "5 minutes before", "10 minutes before", "15 minutes before", "30 minutes before", "1 hour before"]);
    await popup.close();

    // Closed with the settings open, the popup opens with them again.
    await seed({ sync: { prefs: { reminders: true, lead: 120 } } });
    popup = await openPopup({ restored: true });
    await expect(popup.getByRole("combobox", { name: "When" })).toHaveText("2 hours before");
  });
});
