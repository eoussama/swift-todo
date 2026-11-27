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

    // The menu and its submenu stay fully inside the narrow popup.
    const viewport = await popup.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));

    for (const menu of [popup.getByRole("menu").first(), popup.getByRole("menu").last()]) {
      const box = (await menu.boundingBox())!;

      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }

    await popup.getByRole("menuitemradio", { name: "Home" }).click();

    await expect.poll(async () => listedTexts(popup)).toEqual([]);
    await popup.getByRole("tab", { name: "Home" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Water the plants"]);
  });

  test("keeps a list name being typed when lists change elsewhere", async ({ popup, worker, storage }) => {
    for (const name of ["Home", "Work"]) {
      await popup.getByRole("button", { name: "New list" }).click();
      await popup.keyboard.type(name);
      await popup.keyboard.press("Enter");
    }

    await popup.getByRole("button", { name: "Settings" }).click();

    const settings = popup.getByRole("dialog", { name: "Settings" });

    await settings.getByLabel("Name of list Home").fill("Hou");

    // Once both lists have reached sync, another device renames the other one.
    await expect.poll(async () => (await storage("sync")).lists, { timeout: 10_000 }).toHaveLength(2);
    await worker.evaluate(async () => {
      const sync = (globalThis as unknown as { chrome: { storage: { sync: { get: (key: string) => Promise<{ lists: Array<{ n: string }> }>; set: (items: object) => Promise<void> } } } }).chrome.storage.sync;
      const { lists } = await sync.get("lists");

      await sync.set({ lists: lists.map(list => (list.n === "Work" ? { ...list, n: "Job" } : list)) });
    });

    await expect(settings.getByLabel("Name of list Job")).toHaveValue("Job");
    await expect(settings.getByLabel("Name of list Home")).toHaveValue("Hou");
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
    // Deleting takes two clicks within 6 seconds; retry the pair if a slow run misses the window.
    await expect(async () => {
      const remove = settings.getByRole("button", { name: "Delete House" });

      if (await remove.isVisible()) {
        await remove.click();
      }

      await settings.getByRole("button", { name: "Click again to delete House" }).click({ timeout: 1_000 });
      await expect(settings.getByLabel(/^Name of list/)).toHaveCount(1, { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await settings.getByLabel("Add a list").fill("Errands");
    await settings.getByRole("button", { name: "Add a list" }).click();
    await expect(settings.getByLabel(/^Name of list/)).toHaveCount(2);

    await settings.getByRole("button", { name: "Back to the list" }).click();
    await expect(popup.getByRole("tab")).toHaveText(["All", "Today", "Inbox", "Work", "Errands"]);

    // The deleted list's to-do is back in the Inbox.
    await popup.getByRole("tab", { name: "Inbox" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Fix the sink"]);
  });

  test("scrolls the tabs only sideways, fading the edges that have more", async ({ popup }) => {
    for (const name of ["Groceries", "Paperwork", "Side project", "Holidays"]) {
      await popup.getByRole("button", { name: "New list" }).click();
      await popup.keyboard.type(name);
      await popup.keyboard.press("Enter");
      // A new list's tab is selected once it's saved; clicking another tab before that would lose to it.
      await expect(popup.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    }

    const strip = popup.getByRole("tablist").locator("..");
    const state = async () => strip.evaluate(element => ({
      vertical: element.scrollHeight > element.clientHeight,
      left: element.scrollLeft,
      mask: getComputedStyle(element).maskImage,
    }));

    await popup.getByRole("tab", { name: "All" }).click();
    await expect.poll(async () => (await state()).left).toBe(0);
    await expect.poll(async () => (await state()).mask).toContain("calc(100% - 28px)");

    const start = await state();

    expect(start.vertical).toBe(false);
    expect(start.mask).not.toMatch(/rgb\(0, 0, 0\) 28px/);

    // The mouse wheel scrolls the tabs sideways.
    await strip.hover();
    await popup.mouse.wheel(0, 400);
    await expect.poll(async () => (await state()).left).toBeGreaterThan(0);
    await expect.poll(async () => (await state()).mask).toMatch(/rgb\(0, 0, 0\) 28px/);
    expect((await state()).vertical).toBe(false);

    // Clickable things show the pointer.
    for (const target of [popup.getByRole("tab", { name: "All" }), popup.getByRole("button", { name: "Settings" })]) {
      expect(await target.evaluate(element => getComputedStyle(element).cursor)).toBe("pointer");
    }
  });
});

test.describe("tags", () => {
  test("shows #tags as chips that filter the list", async ({ popup }) => {
    await addTodos(popup, "Draft #q3 plan", "Buy milk #home", "Review #q3 numbers");

    await row(popup, "Draft #q3 plan").getByRole("button", { name: "Show only #q3" }).click();
    await expect(popup.locator("span", { hasText: "Showing #q3" })).toBeVisible();
    // And said once, by the status that's always there.
    await expect(popup.getByRole("status").filter({ hasText: "Showing #q3" })).toHaveCount(1);
    await expect.poll(async () => listedTexts(popup)).toEqual(["Draft #q3 plan", "Review #q3 numbers"]);

    await popup.getByRole("button", { name: "Show all tags" }).click();
    await expect.poll(async () => listedTexts(popup)).toHaveLength(3);

    // The row menu offers the same filter, for keyboard users.
    await rowAction(row(popup, "Buy milk #home"), "Show only #home");
    await expect(popup.locator("span", { hasText: "Showing #home" })).toBeVisible();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Buy milk #home"]);
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

test.describe("list tab menus", () => {
  test("mutes tabs with nothing left to do, and checks off, erases or deletes from a right-click, after asking", async ({ popup }) => {
    await popup.getByRole("button", { name: "New list" }).click();
    await popup.keyboard.type("Groceries");
    await popup.keyboard.press("Enter");
    await addTodos(popup, "Milk", "Eggs");

    const tab = popup.getByRole("tab", { name: "Groceries" });
    const ask = popup.getByRole("dialog");

    // Empty, or all done: the tab steps back.
    await expect(popup.getByRole("tab", { name: "Inbox" })).toHaveAttribute("data-quiet", "");
    await expect(tab).not.toHaveAttribute("data-quiet");

    // Checked off together, after asking; Undo brings them back.
    await tab.click({ button: "right" });
    await popup.getByRole("menuitem", { name: "Mark all as done" }).click();
    await expect(ask.getByRole("heading", { name: "Mark all as done?" })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Cancel" })).toBeFocused();
    await ask.getByRole("button", { name: "Mark all done" }).click();
    await expect(popup.getByText("Checked off 2 to-dos")).toBeVisible();
    await expect(tab).toHaveAttribute("data-quiet", "");
    await popup.getByRole("button", { name: "Undo" }).click();
    await expect(tab).not.toHaveAttribute("data-quiet");

    // Cancelled, nothing happens.
    await tab.click({ button: "right" });
    await popup.getByRole("menuitem", { name: "Erase all to-dos" }).click();
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Milk", "Eggs"]);

    // Erased into the trash.
    await tab.click({ button: "right" });
    await popup.getByRole("menuitem", { name: "Erase all to-dos" }).click();
    await ask.getByRole("button", { name: "Erase all" }).click();
    await expect(popup.getByText("Moved 2 to-dos to the trash")).toBeVisible();
    await expect(popup.locator("[data-todo-row]")).toHaveCount(0);
    await expect(popup.getByRole("button", { name: "Trash · 2" })).toBeVisible();

    // The list itself goes too.
    await tab.click({ button: "right" });
    await popup.getByRole("menuitem", { name: "Delete list" }).click();
    await expect(ask.getByText("“Groceries” goes away, and its to-dos move to the Inbox.")).toBeVisible();
    await ask.getByRole("button", { name: "Delete list" }).click();
    await expect(tab).toHaveCount(0);

    // The views that aren't lists can't be deleted.
    await popup.getByRole("tab", { name: "All" }).click({ button: "right" });
    await expect(popup.getByRole("menuitem", { name: "Mark all as done" })).toBeVisible();
    await expect(popup.getByRole("menuitem", { name: "Delete list" })).toHaveCount(0);
  });
});

test.describe("the open tab", () => {
  test("opens the same menu when clicked again, or with Enter, and gives the focus back", async ({ popup }) => {
    await popup.getByRole("button", { name: "New list" }).click();
    await popup.keyboard.type("Groceries");
    await popup.keyboard.press("Enter");
    await addTodos(popup, "Milk");

    const tab = popup.getByRole("tab", { name: "Groceries" });

    await expect(tab).toHaveAttribute("aria-haspopup", "menu");
    // A tab that isn't open opens its list instead.
    await expect(popup.getByRole("tab", { name: "Inbox" })).not.toHaveAttribute("aria-haspopup");

    await tab.click();
    await expect(tab).toHaveAttribute("aria-expanded", "true");
    await expect(popup.getByRole("menuitem")).toHaveText(["Mark all as done", "Erase all to-dos", "Delete list"]);
    await popup.keyboard.press("Escape");
    await expect(tab).toBeFocused();

    await popup.keyboard.press("Enter");
    await popup.getByRole("menuitem", { name: "Mark all as done" }).click();
    await expect(popup.getByRole("dialog").getByRole("heading", { name: "Mark all as done?" })).toBeVisible();
  });
});

test.describe("chips", () => {
  test("open what changes them: the date, the repeat, Today, the pin and sync", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Water plants every 3 days");
    await input.press("Enter");
    await input.fill("Call mom");
    await input.press("Enter");

    const plants = row(popup, "Water plants");
    const mom = row(popup, "Call mom");

    await plants.locator("[data-chip=due]").click();
    await expect(popup.getByRole("dialog", { name: "Schedule" })).toBeVisible();
    await popup.keyboard.press("Escape");

    // The repeat mark names the rule.
    await plants.locator("[data-chip=repeat]").hover();
    await expect(popup.locator("[data-slot=tooltip-content]", { hasText: "Every 3 days" })).toBeVisible();
    await plants.locator("[data-chip=repeat]").click();
    await expect(popup.getByRole("dialog", { name: "Repeat" })).toBeVisible();
    await popup.keyboard.press("Escape");

    await rowAction(mom, "Add to Today");
    await mom.locator("[data-chip=today]").click();
    await expect(popup.getByRole("tab", { name: "Today" })).toHaveAttribute("aria-selected", "true");

    await rowAction(mom, "Pin to the top");
    await mom.locator("[data-chip=pin]").click();
    await expect(mom).not.toHaveAccessibleName(/pinned/);

    // None of them starts editing the text.
    await expect(popup.getByLabel("Edit to-do")).toHaveCount(0);

    // A click on the text does.
    await popup.getByText("Call mom").click();
    await expect(popup.getByLabel("Edit to-do")).toBeFocused();
  });
});

test.describe("settings sections", () => {
  test("fold from their titles, stay folded next time, except About", async ({ popup, openPopup }) => {
    await popup.getByRole("button", { name: "Settings" }).click();

    const settings = popup.getByRole("dialog", { name: "Settings" });
    const appearance = settings.getByRole("button", { name: "Appearance" });

    await expect(appearance).toHaveAttribute("aria-expanded", "true");
    await appearance.click();
    await expect(appearance).toHaveAttribute("aria-expanded", "false");
    await expect(settings.getByText("Accent color")).toBeHidden();
    await expect(settings.getByRole("button", { name: "About" })).toHaveCount(0);
    await expect(settings.getByRole("heading", { name: "About" })).toBeVisible();
    await settings.getByRole("button", { name: "Back to the list" }).click();
    await popup.close();

    const next = await openPopup();

    await next.getByRole("button", { name: "Settings" }).click();
    await expect(next.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Appearance" })).toHaveAttribute("aria-expanded", "false");
    await expect(next.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Lists" })).toHaveAttribute("aria-expanded", "true");
  });
});
