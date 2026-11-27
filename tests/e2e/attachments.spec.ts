import type { Locator, Page } from "@playwright/test";
import { Buffer } from "node:buffer";

import { addTodos, expect, row, test } from "./fixtures";



type TFile = { name: string; type: string; size?: number; text?: string; picture?: boolean };

/**
 * Pastes files (and text, if given) onto an element, as a screenshot or files
 * copied in a file manager would be.
 *
 * @param target Where it's pasted.
 * @param files The files.
 * @param text Text on the clipboard alongside, if any.
 * @returns Whether the page took the paste (prevented the browser's own).
 */
async function paste(target: Locator, files: Array<TFile>, text?: string): Promise<boolean> {
  return target.evaluate(async (element, { files, text }) => {
    const data = new DataTransfer();

    for (const file of files) {
      let part: BlobPart = file.text ?? new Uint8Array(file.size ?? 1);

      if (file.picture === true) {
        const canvas = new OffscreenCanvas(40, 30);
        const context = canvas.getContext("2d")!;

        context.fillStyle = "#3b82f6";
        context.fillRect(0, 0, 40, 30);
        part = await canvas.convertToBlob({ type: "image/png" });
      }

      data.items.add(new File([part], file.name, { type: file.type }));
    }

    if (text !== undefined) {
      data.setData("text/plain", text);
    }

    return !element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, { files, text });
}

/**
 * Counts the attachments stored on the device.
 *
 * @param page The popup.
 * @returns How many there are.
 */
async function stored(page: Page): Promise<number> {
  return page.evaluate(async () => new Promise<number>((resolve) => {
    const request = indexedDB.open("swift-todo-files");

    request.addEventListener("success", () => {
      const count = request.result.transaction("meta").objectStore("meta").count();

      count.addEventListener("success", () => {
        request.result.close();
        resolve(count.result);
      });
    });
  }));
}

const SCREENSHOT = { name: "image.png", type: "image/png", picture: true };

test.describe("attachments", () => {
  test("attaches a pasted screenshot to a to-do, shows it with a paperclip, and keeps it on the device", async ({ popup, openPopup }) => {
    await addTodos(popup, "Fix the login bug", "Other");

    const target = row(popup, "Fix the login bug");

    await target.focus();
    expect(await paste(target, [SCREENSHOT, { name: "report.csv", type: "text/csv", text: "a,b" }])).toBe(true);
    await expect(popup.getByText("Attached 2 files")).toBeVisible();

    const chip = target.locator("[data-chip=files]");

    await expect(chip).toHaveText("2");
    await expect(chip).toHaveAccessibleName("2 files attached");
    await expect(target).toHaveAccessibleName(/2 files attached/);
    await expect(row(popup, "Other").locator("[data-chip=files]")).toHaveCount(0);

    // The chip opens the full view, which lists them; the screenshot is named for when it came.
    await chip.click();

    const view = popup.getByRole("dialog", { name: "To-do" });
    const list = view.getByRole("list", { name: "Attachments" });

    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("listitem").first()).toHaveAttribute("data-attachment", /^Screenshot \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.png$/);
    await expect(list.getByRole("listitem").nth(1)).toContainText("report.csv");
    await expect(list.getByRole("listitem").nth(1)).toContainText("3 bytes");
    await expect(view.getByText("They stay on this device, not synced.")).toBeVisible();

    // A picture shows big, from its thumbnail.
    await expect(list.locator("img")).toHaveJSProperty("complete", true);
    await list.getByRole("button", { name: /^See Screenshot/ }).click();

    const preview = popup.getByRole("dialog", { name: /^Screenshot/ });

    await expect(preview.locator("img[data-preview]")).toBeVisible();
    expect(await preview.locator("img[data-preview]").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(40);
    await preview.getByRole("button", { name: "Close" }).click();
    await expect(preview).toHaveCount(0);

    // Downloaded under its name.
    const downloading = popup.waitForEvent("download");

    await list.getByRole("listitem").nth(1).getByRole("button", { name: "Download" }).click();
    expect((await downloading).suggestedFilename()).toBe("report.csv");

    // Still there next time, with the full view left open coming back, and its files.
    const reopened = await openPopup({ restored: true });
    const again = reopened.getByRole("dialog", { name: "To-do" });

    await expect(again.getByRole("list", { name: "Attachments" }).getByRole("listitem")).toHaveCount(2);
    await expect(again.getByRole("button", { name: "Copy", exact: true })).toBeFocused();
    await reopened.keyboard.press("Escape");
    await expect(row(reopened, "Fix the login bug").locator("[data-chip=files]")).toHaveText("2");
  });

  test("removes a file only on a second click", async ({ popup }) => {
    await addTodos(popup, "Taxes");
    await row(popup, "Taxes").focus();
    await paste(row(popup, "Taxes"), [{ name: "receipt.pdf", type: "application/pdf" }]);
    await row(popup, "Taxes").locator("[data-chip=files]").click();

    const item = popup.getByRole("listitem").filter({ hasText: "receipt.pdf" });

    await item.getByRole("button", { name: "Remove" }).click();
    await expect(item.getByRole("button", { name: "Remove for good?" })).toBeVisible();
    await item.getByRole("button", { name: "Remove for good?" }).click();
    await expect(item).toHaveCount(0);
    await popup.keyboard.press("Escape");
    await expect(row(popup, "Taxes").locator("[data-chip=files]")).toHaveCount(0);
    expect(await stored(popup)).toBe(0);
  });

  test("leaves pasted text to be text, and says why a file wasn't attached", async ({ popup }) => {
    await addTodos(popup, "Budget");

    const target = row(popup, "Budget");

    await target.focus();
    // Cells from a spreadsheet come with a picture of them: they're text.
    expect(await paste(target, [SCREENSHOT], "1\t2")).toBe(false);
    expect(await paste(target, [{ name: "huge.zip", type: "application/zip", size: 10 * 1024 * 1024 + 1 }, { name: "blank.txt", type: "text/plain", size: 0 }])).toBe(true);
    await expect(popup.getByText("“huge.zip” is over 10 MB")).toBeVisible();
    await expect(popup.getByText("“blank.txt” is empty")).toBeVisible();
    await expect(target.locator("[data-chip=files]")).toHaveCount(0);
  });

  test("holds files pasted in the input until the to-do is added, also from its full form", async ({ popup }) => {
    const input = popup.getByLabel("New to-do");
    const pending = popup.locator("[data-pending-files]");

    await input.fill("Review the mockups");
    expect(await paste(input, [{ name: "mockup.fig", type: "" }, { name: "notes.txt", type: "text/plain" }])).toBe(true);
    await expect(pending.getByRole("listitem")).toHaveText(["mockup.fig", "notes.txt"]);
    await pending.getByRole("button", { name: "Don't attach notes.txt" }).click();
    await expect(pending.getByRole("listitem")).toHaveText(["mockup.fig"]);

    await input.press("Enter");
    await expect(row(popup, "Review the mockups").locator("[data-chip=files]")).toHaveText("1");
    await expect(pending).toHaveCount(0);

    // Through the full form, the files come along and can be added to there too.
    await input.fill("Plan the trip");
    await paste(input, [{ name: "tickets.pdf", type: "application/pdf" }]);
    await input.press("Control+Enter");

    const form = popup.getByRole("dialog", { name: "New to-do" });

    // Laid out as in the full view, with the files waiting listed, and Attach.
    const files = form.getByRole("list", { name: "Attachments" }).getByRole("listitem");

    await expect(form.getByRole("button", { name: "Attach files" })).toBeVisible();
    await expect(files).toHaveCount(1);
    await expect(files.first()).toHaveAttribute("data-attachment", "tickets.pdf");
    await paste(form.getByLabel("Edit to-do"), [{ name: "map.png", type: "image/png", picture: true }, { name: "draft.txt", type: "text/plain" }]);
    await expect(files).toHaveCount(3);
    await expect(files.nth(1).locator("img")).toBeVisible();
    // Not stored yet: removed at once, with nothing to download.
    await expect(files.nth(2).getByRole("button", { name: "Download" })).toHaveCount(0);
    await files.nth(2).getByRole("button", { name: "Remove" }).click();
    await expect(files).toHaveCount(2);
    await form.getByRole("button", { name: "Add to-do" }).click();
    await expect(row(popup, "Plan the trip").locator("[data-chip=files]")).toHaveText("2");
  });

  test("attaches files dropped on a to-do, or picked from its menu", async ({ popup }) => {
    await addTodos(popup, "Contract");

    const target = row(popup, "Contract");

    await target.evaluate((element) => {
      const data = new DataTransfer();

      data.items.add(new File(["signed"], "contract.pdf", { type: "application/pdf" }));
      element.dispatchEvent(new DragEvent("dragover", { dataTransfer: data, bubbles: true, cancelable: true }));
      element.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
    });
    await expect(target.locator("[data-chip=files]")).toHaveText("1");

    const choosing = popup.waitForEvent("filechooser");

    await target.hover();
    await target.getByRole("button", { name: "More actions" }).click();
    await popup.getByRole("menuitem", { name: "Attach a file" }).click();
    await (await choosing).setFiles([{ name: "annex.txt", mimeType: "text/plain", buffer: Buffer.from("annex") }]);
    await expect(target.locator("[data-chip=files]")).toHaveText("2");
  });

  test("hides a hidden to-do's files with its text, and deletes them with it for good", async ({ popup }) => {
    await addTodos(popup, "Secret plan", "Keep");
    await row(popup, "Secret plan").focus();
    await paste(row(popup, "Secret plan"), [{ name: "plan.txt", type: "text/plain" }]);
    await row(popup, "Keep").focus();
    await paste(row(popup, "Keep"), [{ name: "keep.txt", type: "text/plain" }]);

    const secret = row(popup, "Secret plan");

    await secret.hover();
    await secret.getByRole("button", { name: "More actions" }).click();
    await popup.getByRole("menuitem", { name: "Hide the text" }).click();

    const hidden = popup.getByRole("group", { name: /^Hidden to-do,/ });

    await hidden.locator("[data-chip=files]").click();

    const view = popup.getByRole("dialog", { name: "To-do" });

    await expect(view.getByText("1 file, hidden with the text")).toBeVisible();
    await expect(view.getByText("plan.txt")).toHaveCount(0);
    await view.getByRole("button", { name: "Show" }).click();
    await expect(view.getByText("plan.txt")).toBeVisible();
    await popup.keyboard.press("Escape");

    // In the trash, they're kept, to come back with it; deleted for good, they go.
    await hidden.focus();
    await popup.keyboard.press("Delete");
    await popup.getByRole("button", { name: "Trash · 1" }).click();
    expect(await stored(popup)).toBe(2);
    await popup.getByRole("list", { name: "Deleted to-dos" }).getByRole("button", { name: "Delete forever" }).click();
    await expect.poll(async () => stored(popup)).toBe(1);
  });
});
