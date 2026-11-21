import type { Page } from "@playwright/test";

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";

import { addTodos, expect, listedTexts, test } from "./fixtures";



async function openData(popup: Page) {
  await popup.getByRole("button", { name: "Settings" }).click();

  return popup.getByRole("dialog", { name: "Settings" });
}

async function download(popup: Page, settings: ReturnType<Page["getByRole"]>, name: string): Promise<{ filename: string; text: string }> {
  const [file] = await Promise.all([popup.waitForEvent("download"), settings.getByRole("button", { name }).click()]);

  return { filename: file.suggestedFilename(), text: await readFile(await file.path(), "utf8") };
}

test.describe("your data", () => {
  test("exports a backup, Markdown and CSV", async ({ popup }) => {
    await addTodos(popup, "Plan #launch tomorrow", "=HYPERLINK(\"x\")");

    const settings = await openData(popup);
    const json = await download(popup, settings, "Backup (JSON)");

    expect(json.filename).toMatch(/^swift-todo-\d{4}-\d{2}-\d{2}\.json$/);

    const backup = JSON.parse(json.text) as { app: string; todos: Array<{ text: string; due: string | null }> };

    expect(backup.app).toBe("swift-todo");
    expect(backup.todos.map(todo => todo.text).sort()).toEqual(["=HYPERLINK(\"x\")", "Plan #launch"]);
    expect(backup.todos.find(todo => todo.text === "Plan #launch")?.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const markdown = await download(popup, settings, "Markdown");

    expect(markdown.filename).toMatch(/\.md$/);
    expect(markdown.text).toContain("## Inbox");
    expect(markdown.text).toMatch(/- \[ \] Plan #launch 📅 \d{4}-\d{2}-\d{2}/);

    const csv = await download(popup, settings, "CSV");

    expect(csv.text.split("\r\n")[0]).toBe("list,text,done,due,repeat,tags,source");
    expect(csv.text).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
  });

  test("imports a backup, adding or replacing", async ({ popup }) => {
    await addTodos(popup, "Already here");

    const backup = JSON.stringify({
      app: "swift-todo",
      version: 1,
      todos: [
        { id: "imported01", text: "From the backup", done: false, position: "a0", createdAt: 1, updatedAt: 1, list: "trip01" },
        { id: "imported02", text: "Done in the backup", done: true, position: "a1", createdAt: 1, updatedAt: 1 },
      ],
      lists: [{ id: "trip01", name: "Trip", emoji: null }],
    });
    const settings = await openData(popup);
    const file = { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(backup) };

    await settings.locator("#import-file").setInputFiles(file);
    await expect(settings.getByRole("status").filter({ hasText: "2 to-dos and 1 list in this backup." })).toBeVisible();
    await settings.getByRole("button", { name: "Add to my to-dos" }).click();
    await expect(popup.getByText("Imported 2 to-dos.")).toBeVisible();

    await settings.locator("#import-file").setInputFiles(file);
    await settings.getByRole("button", { name: "Add to my to-dos" }).click();
    await expect(popup.getByText("Nothing new to import.")).toBeVisible();

    await settings.locator("#import-file").setInputFiles(file);
    await settings.getByRole("button", { name: "Replace my to-dos" }).click();
    await popup.keyboard.press("Escape");

    await expect(popup.getByRole("tab", { name: /Trip/ })).toBeVisible();
    await expect.poll(async () => listedTexts(popup)).toEqual(["From the backup", "Done in the backup"]);
  });

  test("refuses a file that isn't a backup", async ({ popup }) => {
    const settings = await openData(popup);

    await settings.locator("#import-file").setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from("{\"hello\":1}") });
    await expect(popup.getByText("That file isn't a Swift TODO backup.")).toBeVisible();
    await expect(settings.getByRole("button", { name: "Add to my to-dos" })).toHaveCount(0);
  });
});
