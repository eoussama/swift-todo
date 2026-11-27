import AxeBuilder from "@axe-core/playwright";

import { addTodos, expect, row, rowAction, settled, test, typeTime } from "./fixtures";



// The app's own dropdowns, steppers, calendars and time fields, used from the keyboard as well as the mouse.
const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe("the app's own controls", () => {
  test("steps a number with its buttons and arrows, within its range, and keeps only digits", async ({ popup }) => {
    await addTodos(popup, "Gym");
    await rowAction(row(popup, "Gym"), "Repeat…");

    const dialog = popup.getByRole("dialog", { name: "Repeat" });

    await dialog.getByText("Custom", { exact: true }).click();

    const every = dialog.getByRole("spinbutton", { name: "Every" });
    const fewer = dialog.getByRole("button", { name: "Fewer" });
    const more = dialog.getByRole("button", { name: "More" });

    // Custom starts at every 2; 1 is the floor.
    await expect(every).toHaveValue("2");
    await fewer.click();
    await expect(every).toHaveValue("1");
    await expect(fewer).toBeDisabled();
    await every.press("ArrowDown");
    await expect(every).toHaveValue("1");
    await more.click();
    await more.click();
    await expect(every).toHaveValue("3");
    await expect(every).toHaveAttribute("aria-valuenow", "3");

    await every.press("ArrowDown");
    await expect(every).toHaveValue("2");
    await every.press("ArrowUp");
    await every.press("ArrowUp");
    await expect(every).toHaveValue("4");

    // Letters are dropped and the length stops at the largest number's.
    await every.fill("a12345");
    await expect(every).toHaveValue("123");
    await every.fill("999");
    await expect(more).toBeDisabled();
    await every.press("ArrowUp");
    await expect(every).toHaveValue("999");

    // Nothing to save while the field is empty.
    await every.fill("");
    await expect(every).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();

    await every.fill("3");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(row(popup, "Gym")).toHaveAccessibleName(/repeats Every 3 days/);
  });

  test("opens a dropdown, picks with arrows or by typing, and gives focus back", async ({ popup }) => {
    await addTodos(popup, "Gym");
    await rowAction(row(popup, "Gym"), "Repeat…");

    const dialog = popup.getByRole("dialog", { name: "Repeat" });

    await dialog.getByText("Custom", { exact: true }).click();

    const unit = dialog.getByRole("combobox", { name: "Unit" });

    await unit.focus();
    await popup.keyboard.press("Enter");
    await expect(popup.getByRole("listbox")).toBeVisible();
    await expect(popup.getByRole("option", { name: "days" })).toHaveAttribute("aria-selected", "true");

    // Axe also checks the open list.
    await settled(popup);
    expect((await new AxeBuilder({ page: popup }).withTags(WCAG).analyze()).violations).toEqual([]);

    await popup.keyboard.press("ArrowDown");
    await popup.keyboard.press("Enter");
    await expect(popup.getByRole("listbox")).toBeHidden();
    await expect(unit).toHaveText("weeks");
    await expect(unit).toBeFocused();

    await popup.keyboard.press("ArrowDown");
    await expect(popup.getByRole("listbox")).toBeVisible();
    await popup.keyboard.type("h");
    await popup.keyboard.press("Enter");
    await expect(unit).toHaveText("hours");

    // Escape closes the list without changing it, and leaves the dialog open.
    await popup.keyboard.press("Enter");
    await popup.keyboard.press("ArrowDown");
    await popup.keyboard.press("Escape");
    await expect(popup.getByRole("listbox")).toBeHidden();
    await expect(unit).toHaveText("hours");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(row(popup, "Gym")).toHaveAccessibleName(/repeats Every 2 hours/);
  });

  test("moves through the calendar by month and with arrow keys, and steps a time with arrows", async ({ popup }) => {
    await addTodos(popup, "Book dentist");
    await rowAction(row(popup, "Book dentist"), "Schedule…");

    const dialog = popup.getByRole("dialog", { name: "Schedule" });
    const calendar = dialog.getByRole("application");
    const month = await calendar.getAttribute("aria-label");

    expect(month).toMatch(/^Date /);
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(calendar).not.toHaveAttribute("aria-label", month!);
    await dialog.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(calendar).toHaveAttribute("aria-label", month!);

    // Today starts selected; clicking it again keeps it, and → then Enter picks tomorrow.
    const today = dialog.locator("[data-calendar-day][data-today]");

    await today.click();
    await expect(dialog.locator("[role=gridcell][data-selected]")).toHaveCount(1);
    await popup.keyboard.press("ArrowRight");
    await popup.keyboard.press("Enter");
    await expect(today).not.toHaveAttribute("data-selected");

    await dialog.getByRole("switch", { name: "Add a time" }).click();

    const time = dialog.getByRole("group", { name: "Time" });

    await typeTime(time, "09:15");
    await time.getByRole("spinbutton").first().click();
    await popup.keyboard.press("ArrowUp");

    await settled(popup);
    expect((await new AxeBuilder({ page: popup }).withTags(WCAG).analyze()).violations).toEqual([]);

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(row(popup, "Book dentist")).toHaveAccessibleName(/due Tomorrow 10:15\sAM/);
  });

  test("picks a date from the full view's calendar, which shows no issues while open", async ({ popup }) => {
    await addTodos(popup, "Renew passport");
    await rowAction(row(popup, "Renew passport"), "View in full");

    const view = popup.getByRole("dialog", { name: "To-do" });

    await view.getByRole("button", { name: "Edit" }).click();
    await view.getByRole("button", { name: /^Date: / }).click();

    const calendar = popup.getByRole("application", { name: /^Date / });

    await expect(calendar).toBeVisible();
    await settled(popup);
    expect((await new AxeBuilder({ page: popup }).withTags(WCAG).analyze()).violations).toEqual([]);

    await calendar.locator("[data-calendar-day][data-today]").focus();
    await popup.keyboard.press("ArrowRight");
    await popup.keyboard.press("Enter");
    await expect(calendar).toBeHidden();
    await view.getByRole("button", { name: "Save" }).click();
    await expect(view.getByText("Tomorrow", { exact: false })).toBeVisible();
  });
});

test.describe("row menus", () => {
  test("keeps one open at a time", async ({ popup }) => {
    await addTodos(popup, "Alpha", "Beta");

    const open = popup.locator("[data-slot=dropdown-menu-content][data-state=open]");

    await row(popup, "Alpha").hover();
    await row(popup, "Alpha").getByRole("button", { name: "More actions" }).click();
    await expect(open).toHaveCount(1);

    // Another row's menu (M on it) takes over, and keeps the focus.
    await row(popup, "Beta").evaluate(element => element.dispatchEvent(new KeyboardEvent("keydown", { key: "m", bubbles: true })));
    await expect(open).toHaveCount(1);
    await expect(row(popup, "Alpha").getByRole("button", { name: "More actions" })).toHaveAttribute("aria-expanded", "false");
    await expect(row(popup, "Beta").getByRole("button", { name: "More actions" })).toHaveAttribute("aria-expanded", "true");
    await expect(open.getByRole("menuitem", { name: "View in full" })).toBeFocused();

    // Closed, the focus goes back to its row.
    await popup.keyboard.press("Escape");
    await expect(open).toHaveCount(0);
    await expect(row(popup, "Beta")).toBeFocused();
  });
});

test.describe("menus from the pointer", () => {
  test("open a row's menu on right-click, close Move to list once left, and red erasing on tabs", async ({ popup }) => {
    await addTodos(popup, "Alpha", "Beta");

    const alpha = row(popup, "Alpha");
    const text = popup.getByText("Alpha");
    const box = (await text.boundingBox())!;

    // Right-click on the row: its menu, at the pointer.
    await text.click({ button: "right" });

    const menu = popup.locator("[data-slot=dropdown-menu-content][data-state=open]");

    await expect(menu).toHaveCount(1);
    await expect(alpha.getByRole("button", { name: "More actions" })).toHaveAttribute("aria-expanded", "true");
    expect(Math.abs((await menu.boundingBox())!.x - (box.x + box.width / 2))).toBeLessThan(40);

    // Move to list opens on hover, and closes once the pointer leaves it, even off the menu.
    const moveTo = popup.getByRole("menuitem", { name: "Move to list" });
    const sub = popup.locator("[data-slot=dropdown-menu-sub-content]");
    const item = (await moveTo.boundingBox())!;

    await moveTo.hover();
    await expect(sub).toBeVisible();
    await popup.mouse.move(item.x - 30, item.y + item.height / 2, { steps: 4 });
    await expect(sub).toBeHidden();
    await popup.keyboard.press("Escape");

    // The pin's tooltip names its key.
    await rowAction(alpha, "Pin to the top");
    await alpha.locator("[data-chip=pin]").hover();
    await expect(popup.locator("[data-slot=tooltip-content]", { hasText: "Unpin" }).locator("kbd")).toHaveText("P");

    // On a tab's menu, erasing is red like a row's Erase.
    await popup.getByRole("tab", { name: "Inbox" }).click({ button: "right" });
    await expect(popup.getByRole("menuitem", { name: "Erase all to-dos" })).toHaveClass(/text-destructive/);
    await expect(popup.getByRole("menuitem", { name: "Mark all as done" })).not.toHaveClass(/text-destructive/);
  });
});
