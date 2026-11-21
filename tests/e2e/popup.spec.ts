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
    const link = popup.getByRole("link", { name: `v${version}, release notes` });

    await expect(link).toHaveText(`v${version}`);
    await expect(link).toHaveAttribute("href", `https://github.com/eoussama/swift-todo/releases/tag/v${version}`);
    await expect(link).toHaveAttribute("target", "_blank");
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

    await popup.getByRole("button", { name: "Click again to empty" }).click();
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
