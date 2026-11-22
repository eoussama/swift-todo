import { addTodos, expect, row, rowAction, test } from "./fixtures";



// When a control goes away or moves after it's used, the keyboard focus goes somewhere sensible, never back to the page.
test.describe("focus after an action", () => {
  test("clearing the tag filter, closing the new-list field, and stopping the timer", async ({ popup }) => {
    await addTodos(popup, "Draft #q3 plan");

    await row(popup, "Draft #q3 plan").getByRole("button", { name: "Show only #q3" }).click();
    await popup.getByRole("button", { name: "Show all tags" }).focus();
    await popup.keyboard.press("Enter");
    await expect(popup.getByLabel("New to-do")).toBeFocused();

    await popup.getByRole("button", { name: "New list" }).click();
    await popup.keyboard.type("Errands");
    await popup.keyboard.press("Escape");
    await expect(popup.getByRole("button", { name: "New list" })).toBeFocused();
    await expect(popup.getByRole("tab")).toHaveText(["All", "Today", "Inbox"]);

    await popup.getByRole("button", { name: "Focus mode" }).click();
    await popup.getByRole("button", { name: /^Start a \d+-minute timer$/ }).click();
    await expect(popup.getByRole("button", { name: "Stop" })).toBeFocused();
    await popup.keyboard.press("Enter");
    await expect(popup.getByRole("button", { name: /^Start a \d+-minute timer$/ })).toBeFocused();
  });

  test("stepping a number to its limit keeps the focus on the button", async ({ popup }) => {
    await addTodos(popup, "Gym");
    await rowAction(row(popup, "Gym"), "Repeat…");

    const dialog = popup.getByRole("dialog", { name: "Repeat" });

    await dialog.getByText("Custom", { exact: true }).click();
    await dialog.getByRole("spinbutton", { name: "Every" }).fill("998");

    const more = dialog.getByRole("button", { name: "More" });

    await more.focus();
    await popup.keyboard.press("Enter");
    await popup.keyboard.press("Enter");
    await expect(dialog.getByRole("spinbutton", { name: "Every" })).toHaveValue("999");
    await expect(more).toBeDisabled();
    await expect(more).toBeFocused();
  });

  test("moving and deleting lists in settings, and a refused rename", async ({ popup }) => {
    for (const name of ["One", "Two", "Three"]) {
      await popup.getByRole("button", { name: "New list" }).click();
      await popup.keyboard.type(name);
      await popup.keyboard.press("Enter");
    }

    await popup.getByRole("button", { name: "Settings" }).click();

    const settings = popup.getByRole("dialog", { name: "Settings" });

    // Moved down twice from the keyboard, the button keeps the focus.
    const order = async () => settings.getByLabel(/^Name of list/).evaluateAll(fields => fields.map(field => (field as HTMLInputElement).value));

    await settings.getByRole("button", { name: "Move One down" }).focus();
    await popup.keyboard.press("Enter");
    await expect.poll(order).toEqual(["Two", "One", "Three"]);
    await expect(settings.getByRole("button", { name: "Move One down" })).toBeFocused();
    await popup.keyboard.press("Enter");
    await expect.poll(order).toEqual(["Two", "Three", "One"]);
    await expect(settings.getByRole("button", { name: "Move One down" })).toBeFocused();
    await expect(settings.getByRole("button", { name: "Move One down" })).toBeDisabled();

    // An emptied name comes back.
    await settings.getByLabel("Name of list Two").fill("");
    await settings.getByLabel("Name of list Two").press("Enter");
    await expect(settings.getByLabel("Name of list Two")).toHaveValue("Two");

    // Deleting from the keyboard moves the focus to the list now in its place.
    await settings.getByRole("button", { name: "Delete Two" }).focus();
    await popup.keyboard.press("Enter");
    await expect(settings.getByRole("button", { name: "Click again to delete Two" })).toBeFocused();
    await popup.keyboard.press("Enter");
    await expect(settings.getByLabel("Name of list Three")).toBeFocused();
  });

  test("leaving the edit form in the full view gives the focus back to Edit", async ({ popup }) => {
    await addTodos(popup, "Call the plumber");
    await rowAction(row(popup, "Call the plumber"), "View in full");

    const view = popup.getByRole("dialog", { name: "To-do" });

    await view.getByRole("button", { name: "Edit" }).click();
    await popup.keyboard.press("Escape");
    await expect(view.getByRole("button", { name: "Edit" })).toBeFocused();
  });
});
