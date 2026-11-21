import { addTodos, expect, listedTexts, row, test } from "./fixtures";



test.describe("everyday use", () => {
  test("shows the empty state first", async ({ popup }) => {
    await expect(popup.getByRole("heading", { name: "Nothing to do yet" })).toBeVisible();
    await expect(popup.getByText("Your list is empty")).toBeVisible();
  });

  test("adds, checks off, edits and deletes with undo", async ({ popup }) => {
    await addTodos(popup, "Buy oat milk", "Water the plants");
    await expect(popup.getByText("2 to-dos left")).toBeVisible();

    await row(popup, "Buy oat milk").getByRole("checkbox").click();
    await expect(popup.getByText("1 to-do left")).toBeVisible();

    await popup.getByText("Water the plants").dblclick();
    await popup.getByLabel("Edit to-do").fill("Water the plants and the herbs");
    await popup.getByLabel("Edit to-do").press("Enter");
    await expect(row(popup, "Water the plants and the herbs")).toBeVisible();

    await row(popup, "Buy oat milk").hover();
    await row(popup, "Buy oat milk").getByRole("button", { name: "Delete" }).click();
    await expect(popup.getByText("Deleted “Buy oat milk”")).toBeVisible();
    expect(await listedTexts(popup)).toEqual(["Water the plants and the herbs"]);

    await popup.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["Buy oat milk", "Water the plants and the herbs"]);
  });

  test("clears done to-dos, with undo", async ({ popup }) => {
    await addTodos(popup, "A", "B", "C");
    await row(popup, "A").getByRole("checkbox").click();
    await row(popup, "C").getByRole("checkbox").click();

    await popup.getByRole("button", { name: "Clear 2 done" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["B"]);

    await popup.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => listedTexts(popup)).toEqual(["A", "B", "C"]);
  });

  test("refuses blank to-dos and counts down near the length limit", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");

    await input.fill("   ");
    await expect(popup.getByRole("button", { name: "Add to-do" })).toBeDisabled();

    await input.fill("x".repeat(460));
    await expect(popup.getByText("40 characters left")).toBeVisible();
    await expect(input).toHaveAttribute("maxlength", "500");
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

    await popup.keyboard.press("Space");
    await expect(row(popup, "A").getByRole("checkbox")).toBeChecked();

    await popup.keyboard.press("F2");
    await popup.keyboard.press("Control+a");
    await popup.keyboard.type("A, renamed");
    await popup.keyboard.press("Enter");
    await expect(row(popup, "A, renamed")).toBeFocused();

    await popup.keyboard.press("Delete");
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "C"]);
    await expect(row(popup, "C")).toBeFocused();

    await popup.keyboard.press("Control+z");
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "A, renamed", "C"]);

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

    await popup.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await popup.mouse.down();

    // Move in small, spaced steps: the drag library reacts on timers, not on single events.
    for (let step = 1; step <= 12; step++) {
      await popup.mouse.move(handle!.x + 4, handle!.y + (target!.y + target!.height - handle!.y) * step / 12, { steps: 3 });
      await popup.waitForTimeout(40);
    }

    await popup.mouse.up();
    await expect.poll(async () => listedTexts(popup)).toEqual(["B", "C", "A"]);

    const reopened = await openPopup();

    await expect.poll(async () => listedTexts(reopened)).toEqual(["B", "C", "A"]);
  });
});
