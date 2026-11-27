import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { addTodos, expect, listedTexts, row, test } from "./fixtures";



test.describe("everyday use", () => {
  test("shows a fresh page first", async ({ popup }) => {
    await expect(popup.getByRole("heading", { name: "Nothing to do… yet" })).toBeVisible();
    await expect(popup.getByText("A fresh page")).toBeVisible();
  });

  test("adds, checks off, edits and erases with undo", async ({ popup }) => {
    await addTodos(popup, "Buy oat milk", "Water the plants");
    await expect(popup.getByText("0 of 2 done")).toBeVisible();

    await row(popup, "Buy oat milk").getByRole("checkbox").click();
    await expect(popup.getByText("1 of 2 done")).toBeVisible();
    await expect(popup.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");

    // Checked to-dos move down to the "Done" section.
    await expect.poll(async () => listedTexts(popup)).toEqual(["Water the plants", "Buy oat milk"]);

    await popup.getByText("Water the plants").dblclick();
    await popup.getByLabel("Edit to-do").fill("Water the plants and the herbs");
    await popup.getByLabel("Edit to-do").press("Enter");
    await expect(row(popup, "Water the plants and the herbs")).toBeVisible();

    await row(popup, "Buy oat milk").hover();
    await row(popup, "Buy oat milk").getByRole("button", { name: "Erase" }).click();
    await expect(popup.getByText("Moved “Buy oat milk” to the trash")).toBeVisible();
    expect(await listedTexts(popup)).toEqual(["Water the plants and the herbs"]);

    await popup.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Water the plants and the herbs", "Buy oat milk"]);
  });

  test("shows one line of a long to-do, all of it while Shift is held, and edits all of it", async ({ popup }) => {
    const text = "Pick up the dry cleaning, then call the plumber about the kitchen sink, and book a table at the new place";
    const height = async (): Promise<number> => (await row(popup, text).boundingBox())!.height;

    await addTodos(popup, text);

    const line = row(popup, text);
    const short = await height();

    // One line (and the rule under it), cut short.
    expect(short).toBe(45);
    await expect(line.locator("[data-todo-text]")).toHaveCSS("text-overflow", "ellipsis");

    // Held over it, Shift shows all of it, and the row's buttons step aside.
    await line.hover();
    await popup.keyboard.down("Shift");
    await expect.poll(height).toBeGreaterThan(short);
    await expect(line.getByRole("button", { name: "Erase" })).toBeHidden();

    const whole = await height();

    await popup.keyboard.up("Shift");
    await expect.poll(height).toBe(short);

    // Shift as a modifier (a capital) doesn't open it up.
    await popup.keyboard.down("Shift");
    await popup.keyboard.press("KeyA");
    await popup.waitForTimeout(500);
    expect(await height()).toBe(short);
    await popup.keyboard.up("Shift");

    // From the keyboard too, on the row picked with the arrows.
    await popup.mouse.move(0, 0);
    await popup.getByLabel("New to-do").press("ArrowDown");
    await expect(line).toBeFocused();
    await popup.keyboard.down("Shift");
    await expect.poll(height).toBe(whole);
    await popup.keyboard.up("Shift");
    await expect.poll(height).toBe(short);

    // Edited, the whole text shows, over the lines it takes when held open.
    await popup.getByText(text).dblclick();
    await expect(popup.getByLabel("Edit to-do")).toBeFocused();
    expect(await height()).toBe(whole);
  });

  test("shows all of a to-do with the key picked in settings", async ({ popup }) => {
    const text = "Pick up the dry cleaning, then call the plumber about the kitchen sink, and book a table at the new place";
    const height = async (): Promise<number> => (await row(popup, text).boundingBox())!.height;

    await addTodos(popup, text);
    await popup.getByRole("button", { name: "Settings" }).click();
    await popup.getByRole("radio", { name: "Alt" }).check({ force: true });
    await popup.getByRole("button", { name: "Back to the list" }).click();

    await row(popup, text).hover();
    await popup.keyboard.down("Shift");
    await popup.waitForTimeout(500);
    expect(await height()).toBe(45);
    await popup.keyboard.up("Shift");

    await popup.keyboard.down("Alt");
    await expect.poll(height).toBeGreaterThan(45);
    await popup.keyboard.up("Alt");

    // The shortcuts list says which key.
    await popup.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(popup.getByText("Hold to see all of a to-do")).toBeVisible();
    await expect(popup.getByLabel("Alt / ⌥")).toBeVisible();
  });

  test("writes a to-do over several lines with Shift+Enter", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("Groceries:");
    await input.press("Shift+Enter");
    await input.pressSequentially("milk");
    await input.press("Shift+Enter");
    await input.pressSequentially("eggs tomorrow");
    await input.press("Enter");
    await expect(input).toHaveValue("");
    // The date is understood from the last line, and the lines stay.
    await expect.poll(async () => listedTexts(popup)).toEqual(["Groceries:\nmilk\neggs"]);
    // Its name reads the lines as one.
    await expect(row(popup, "Groceries: milk eggs")).toHaveAccessibleName(/due Tomorrow/);

    // In place, Shift+Enter adds a line and Enter saves.
    await popup.getByText("Groceries:").dblclick();

    const editor = popup.getByLabel("Edit to-do");

    await editor.press("Shift+Enter");
    await editor.pressSequentially("bread");
    await editor.press("Enter");
    await expect.poll(async () => listedTexts(popup)).toEqual(["Groceries:\nmilk\neggs\nbread"]);

    // In full, every line shows.
    await row(popup, "Groceries: milk eggs bread").press("v");
    await expect(popup.getByRole("dialog", { name: "To-do" }).locator("[data-view-text]")).toHaveText("Groceries:\nmilk\neggs\nbread");
  });

  test("celebrates when the last to-do is done", async ({ popup }) => {
    await addTodos(popup, "Only one");
    await row(popup, "Only one").getByRole("checkbox").click();

    await expect(popup.getByText("All done!")).toBeVisible();
    await expect(popup.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  test("erases done to-dos, with undo", async ({ popup }) => {
    await addTodos(popup, "A", "B", "C");
    await row(popup, "A").getByRole("checkbox").click();
    await row(popup, "C").getByRole("checkbox").click();
    await expect(popup.getByRole("button", { name: "Done · 2" })).toHaveAttribute("aria-expanded", "true");

    await popup.getByRole("button", { name: "Erase all done to-dos" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["B"]);

    await popup.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "A", "C"]);
  });

  test("folds the Done section away, and remembers it", async ({ popup, openPopup }) => {
    await addTodos(popup, "A", "B");
    await row(popup, "B").getByRole("checkbox").click();

    const toggle = popup.getByRole("button", { name: "Done · 1" });

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(await listedTexts(popup)).toEqual(["A"]);

    const reopened = await openPopup();

    await expect(reopened.getByRole("button", { name: "Done · 1" })).toHaveAttribute("aria-expanded", "false");
    expect(await listedTexts(reopened)).toEqual(["A"]);
  });

  test("refuses blank to-dos and counts down near the length limit", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("   ");
    await expect(popup.getByRole("button", { name: "Add to-do" })).toBeDisabled();

    await input.fill("x".repeat(460));
    await expect(popup.getByText("40 characters left")).toBeVisible();
    await expect(input).toHaveAttribute("maxlength", "500");
  });

  test("shows the keyboard shortcuts on click, with or without hovering", async ({ popup }) => {
    const button = popup.getByRole("button", { name: "Keyboard shortcuts" });
    const list = popup.getByText("Move between to-dos");

    await button.click();
    await expect(list).toBeVisible();

    await popup.keyboard.press("Escape");
    await expect(list).toBeHidden();

    // A tap on a touch screen: a click with no hover first.
    await popup.mouse.move(0, 0);
    await button.dispatchEvent("click");
    await expect(list).toBeVisible();
  });

  test("shows the version, linking to its release notes", async ({ popup }) => {
    const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8")) as { version: string };
    const link = popup.getByRole("link", { name: `v${version}, release notes (opens in a new tab)` });

    await expect(link).toHaveText(`v${version}`);
    await expect(link).toHaveAttribute("href", `https://github.com/eoussama/swift-todo/releases/tag/v${version}`);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("names every icon-only control in a tooltip, and keeps the header buttons apart", async ({ popup }) => {
    await addTodos(popup, "Water the plants", "Call Sam");
    // The preview chip's ✕ shows while a date is typed.
    await popup.getByLabel("New to-do").fill("Pay rent tomorrow");
    await expect(popup.getByRole("button", { name: "Keep the words as typed" })).toBeVisible();

    // The + button adds what's typed, like Enter.
    await popup.getByRole("button", { name: "Add to-do" }).click();
    await expect(row(popup, "Pay rent")).toBeVisible();
    await popup.getByLabel("New to-do").fill("Pay rent tomorrow");

    const untipped = await popup.evaluate(() => [...document.querySelectorAll("button:not([role=checkbox]), [aria-label='Drag to reorder']")]
      .filter(control => control.textContent.trim() === "" && !control.hasAttribute("data-tooltip-trigger"))
      .map(control => control.outerHTML.slice(0, 120)));

    expect(untipped, "icon-only controls without a tooltip").toEqual([]);

    // By text: the previous tooltip can still be fading out when the next one opens.
    const tip = (text: string) => popup.locator("[data-slot=tooltip-content]", { hasText: text });

    await popup.getByRole("button", { name: "Settings" }).hover();
    await expect(tip("Settings")).toBeVisible();

    await row(popup, "Call Sam").hover();
    await row(popup, "Call Sam").getByRole("button", { name: "More actions" }).hover();
    await expect(tip("More actions")).toBeVisible();

    const focus = await popup.getByRole("button", { name: "Focus mode" }).boundingBox();
    const settings = await popup.getByRole("button", { name: "Settings" }).boundingBox();

    expect(settings!.x - (focus!.x + focus!.width), "gap between the header buttons").toBeGreaterThanOrEqual(6);
  });
});

test.describe("trash", () => {
  test("keeps erased to-dos in the trash, to restore or delete for good", async ({ popup }) => {
    await addTodos(popup, "Keep me", "Restore me", "Forget me");

    for (const text of ["Restore me", "Forget me"]) {
      await row(popup, text).hover();
      await row(popup, text).getByRole("button", { name: "Erase" }).click();
    }

    // The trash starts folded.
    const trash = popup.getByRole("button", { name: "Trash · 2" });

    await expect(trash).toHaveAttribute("aria-expanded", "false");
    await trash.click();

    const trashed = popup.getByRole("list", { name: "Deleted to-dos" });

    await expect(trashed.getByRole("group")).toHaveCount(2);

    await trashed.getByRole("group", { name: "Restore me, in the trash" }).getByRole("button", { name: "Restore" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Keep me", "Restore me"]);

    await trashed.getByRole("group", { name: "Forget me, in the trash" }).getByRole("button", { name: "Delete forever" }).click();
    await expect(popup.getByRole("button", { name: /^Trash/ })).toHaveCount(0);
  });

  test("asks for a second click before emptying the trash", async ({ popup }) => {
    await addTodos(popup, "A", "B");
    await popup.keyboard.press("ArrowDown");
    await popup.keyboard.press("Delete");
    await expect(row(popup, "B")).toBeFocused();
    await popup.keyboard.press("Delete");

    await expect(popup.getByRole("button", { name: "Trash · 2" })).toBeVisible();
    await expect(popup.getByRole("heading", { name: "Nothing to do… yet" })).toHaveCount(0);

    await popup.getByRole("button", { name: "Empty trash" }).click();
    await expect(popup.getByRole("button", { name: "Trash · 2" })).toBeVisible();

    // Two clicks within 6 seconds; retry the pair if a slow run misses the window.
    await expect(async () => {
      const empty = popup.getByRole("button", { name: "Empty trash" });

      if (await empty.isVisible()) {
        await empty.click();
      }

      await popup.getByRole("button", { name: "Click again to empty" }).click({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(popup.getByRole("heading", { name: "Nothing to do… yet" })).toBeVisible();
  });
});

test.describe("keyboard", () => {
  test("navigates, checks off, reorders, deletes and undoes without a mouse", async ({ popup }) => {
    await addTodos(popup, "A", "B", "C");

    await popup.keyboard.press("ArrowDown");
    await expect(row(popup, "A")).toBeFocused();

    await popup.keyboard.press("Alt+ArrowDown");
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "A", "C"]);
    await expect(row(popup, "A")).toBeFocused();

    // Space checks A off; it lingers, then moves to "Done" and focus stays on the same spot (now C).
    await popup.keyboard.press("Space");
    await expect(row(popup, "A").getByRole("checkbox")).toBeChecked();
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "C", "A"]);
    await expect(row(popup, "C")).toBeFocused();

    await popup.keyboard.press("F2");
    await popup.keyboard.press("Control+a");
    await popup.keyboard.type("C, renamed");
    await popup.keyboard.press("Enter");
    await expect(row(popup, "C, renamed")).toBeFocused();

    await popup.keyboard.press("Delete");
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "A"]);
    await expect(row(popup, "A")).toBeFocused();

    await popup.keyboard.press("Control+z");
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "C, renamed", "A"]);

    await popup.keyboard.press("/");
    await expect(popup.getByLabel("New to-do")).toBeFocused();
  });

  test("cancels an edit with Escape and leaves the list as one tab stop", async ({ popup }) => {
    await addTodos(popup, "A", "B");
    await popup.keyboard.press("ArrowDown");
    await popup.keyboard.press("Enter");
    await popup.keyboard.type(" changed");
    await popup.keyboard.press("Escape");

    await expect(row(popup, "A")).toBeFocused();
    expect(await listedTexts(popup)).toEqual(["A", "B"]);

    await popup.keyboard.press("Tab");
    await expect(popup.locator("[data-todo-row]:focus")).toHaveCount(0);
  });
});

test.describe("drag and drop", () => {
  test("reorders with the drag handle and keeps the order", async ({ popup, openPopup }) => {
    await addTodos(popup, "A", "B", "C");
    await row(popup, "A").hover();

    const handle = await row(popup, "A").getByLabel("Drag to reorder").boundingBox();
    const target = await row(popup, "C").boundingBox();

    const startY = handle!.y + handle!.height / 2;
    const endY = target!.y + target!.height * 0.8;

    await popup.mouse.move(handle!.x + handle!.width / 2, startY);
    await popup.mouse.down();
    await popup.waitForTimeout(80);

    // Move in small, spaced steps: the drag library reacts on timers, not on single events.
    for (let step = 1; step <= 16; step++) {
      await popup.mouse.move(handle!.x + handle!.width / 2, startY + (endY - startY) * step / 16, { steps: 4 });
      await popup.waitForTimeout(50);
    }

    await popup.waitForTimeout(150);

    await popup.mouse.up();
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "C", "A"]);

    const reopened = await openPopup();

    await expect.poll(async () => listedTexts(reopened)).toEqual(["B", "C", "A"]);
  });
});
