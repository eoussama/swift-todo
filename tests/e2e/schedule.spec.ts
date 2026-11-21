import { expect, row, rowAction, test } from "./fixtures";



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
    await dialog.getByLabel("Time", { exact: true }).fill("14:30");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(row(popup, "Book dentist")).toHaveAccessibleName(/due Tomorrow 2:30\sPM/);

    await rowAction(row(popup, "Book dentist"), "Schedule…");
    await popup.getByRole("dialog", { name: "Schedule" }).getByRole("button", { name: "No date" }).click();
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
    await popup.getByRole("radio", { name: "Off" }).check();
    await expect.poll(badge, { timeout: 10_000 }).toBe("");
  });
});
