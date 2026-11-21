import { addTodos, expect, listedTexts, row, rowAction, test } from "./fixtures";



test.describe("lists", () => {
  test("adds lists as tabs, files new to-dos in the open list, and remembers it", async ({ popup, openPopup }) => {
    await addTodos(popup, "In the inbox");

    await popup.getByRole("button", { name: "New list" }).click();
    await popup.keyboard.type("Work");
    await popup.keyboard.press("Enter");

    const work = popup.getByRole("tab", { name: "Work" });

    await expect(work).toHaveAttribute("aria-selected", "true");

    const input = popup.getByLabel("New to-do");

    await input.fill("Write the report");
    await input.press("Enter");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Write the report"]);

    await popup.getByRole("tab", { name: "Inbox" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["In the inbox"]);

    await popup.getByRole("tab", { name: "All" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["In the inbox", "Write the report"]);

    // Arrow keys move between tabs.
    await popup.getByRole("tab", { name: "All" }).press("End");
    await expect(work).toBeFocused();
    await expect(work).toHaveAttribute("aria-selected", "true");

    const reopened = await openPopup();

    await expect(reopened.getByRole("tab", { name: "Work" })).toHaveAttribute("aria-selected", "true");
  });

  test("moves a to-do to another list from its menu", async ({ popup }) => {
    await popup.getByRole("button", { name: "New list" }).click();
    await popup.keyboard.type("Home");
    await popup.keyboard.press("Enter");
    await popup.getByRole("tab", { name: "Inbox" }).click();
    await addTodos(popup, "Water the plants");

    await row(popup, "Water the plants").hover();
    await row(popup, "Water the plants").getByRole("button", { name: "More actions" }).click();
    await popup.getByRole("menuitem", { name: "Move to list" }).click();
    await popup.getByRole("menuitemradio", { name: "Home" }).click();

    await expect.poll(async () => listedTexts(popup)).toEqual([]);
    await popup.getByRole("tab", { name: "Home" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Water the plants"]);
  });

  test("manages lists in settings", async ({ popup }) => {
    for (const name of ["Work", "Home"]) {
      await popup.getByRole("button", { name: "New list" }).click();
      await popup.keyboard.type(name);
      await popup.keyboard.press("Enter");
    }

    await addTodos(popup, "Fix the sink");
    await popup.getByRole("button", { name: "Settings" }).click();

    const settings = popup.getByRole("dialog", { name: "Settings" });

    await settings.getByLabel("Name of list Home").fill("House");
    await settings.getByLabel("Name of list Home").press("Enter");
    await settings.getByRole("button", { name: "Move House up" }).click();
    // Deleting takes two clicks within 3 seconds; retry the pair if a slow run misses the window.
    await expect(async () => {
      const remove = settings.getByRole("button", { name: "Delete House" });

      if (await remove.isVisible()) {
        await remove.click();
      }

      await settings.getByRole("button", { name: "Click again to delete" }).click({ timeout: 1_000 });
      await expect(settings.getByLabel(/^Name of list/)).toHaveCount(1, { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await settings.getByLabel("Add a list").fill("Errands");
    await settings.getByRole("button", { name: "Add a list" }).click();
    await expect(settings.getByLabel(/^Name of list/)).toHaveCount(2);

    await settings.getByRole("button", { name: "Back to the list" }).click();
    await expect(popup.getByRole("tab")).toHaveText(["All", "Inbox", "Work", "Errands"]);

    // The deleted list's to-do is back in the Inbox.
    await popup.getByRole("tab", { name: "Inbox" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Fix the sink"]);
  });
});

test.describe("tags", () => {
  test("shows #tags as chips that filter the list", async ({ popup }) => {
    await addTodos(popup, "Draft #q3 plan", "Buy milk #home", "Review #q3 numbers");

    await row(popup, "Draft #q3 plan").getByRole("button", { name: "Show only #q3" }).click();
    await expect(popup.getByText("Showing #q3")).toBeVisible();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Draft #q3 plan", "Review #q3 numbers"]);

    await popup.getByRole("button", { name: "Show all tags" }).click();
    await expect.poll(async () => listedTexts(popup)).toHaveLength(3);
  });

  test("suggests tags while typing, and Tab completes", async ({ popup }) => {
    await addTodos(popup, "Read #books");

    const input = popup.getByLabel("New to-do");

    await input.fill("Lend #bo");
    await expect(popup.getByRole("group", { name: "Tag suggestions" }).getByRole("button", { name: "#books" })).toBeVisible();
    await input.press("Tab");
    await expect(input).toHaveValue("Lend #books ");
    await expect(input).toBeFocused();
  });
});

test.describe("row menu", () => {
  test("opens from the keyboard with M and returns focus to the row", async ({ popup }) => {
    await addTodos(popup, "A");
    await popup.keyboard.press("ArrowDown");
    await popup.keyboard.press("m");

    await expect(popup.getByRole("menuitem", { name: "Move to list" })).toBeVisible();
    await popup.keyboard.press("Escape");
    await expect(row(popup, "A")).toBeFocused();
  });

  test("keeps a to-do on the device from the menu", async ({ popup }) => {
    await addTodos(popup, "Private");
    await rowAction(row(popup, "Private"), "Keep on this device only");
    await expect(row(popup, "Private")).toHaveAccessibleName(/on this device only$/);
  });
});
