import { addTodos, expect, listedTexts, row, test } from "./fixtures";



/**
 * Lists the to-do keys in a storage area dump.
 *
 * @param items Everything stored in the area.
 * @returns The `t:<id>` keys.
 */
function todoKeys(items: Record<string, unknown>): Array<string> {
  return Object.keys(items).filter(key => key.startsWith("t:"));
}

test("writes to-dos to browser sync and shows them again after reopening", async ({ popup, openPopup, storage }) => {
  await addTodos(popup, "Reply to Sam", "Buy oat milk");

  await expect.poll(async () => todoKeys(await storage("sync")).length).toBe(2);
  await expect(popup.getByText("Synced", { exact: true })).toBeVisible();
  expect((await storage("sync")).meta).toEqual({ v: 1 });

  const reopened = await openPopup();

  expect(await listedTexts(reopened)).toEqual(["Reply to Sam", "Buy oat milk"]);
});

test("writes pending changes after the popup closes too soon", async ({ popup, openPopup, storage }) => {
  const input = popup.getByLabel("New to-do");

  await input.fill("Quick one");
  await input.press("Enter");
  await expect(row(popup, "Quick one")).toBeVisible();
  await popup.close();

  // Closed before the write to sync: the change waits in the local queue.
  expect(todoKeys(await storage("sync"))).toHaveLength(0);
  expect(Object.keys((await storage("local")).outbox as object)).toHaveLength(1);

  // Opening the popup again (or the background alarm) sends it.
  await openPopup();
  await expect.poll(async () => todoKeys(await storage("sync")).length).toBe(1);
});

test("keeps a to-do on this device, then syncs it again", async ({ popup, storage }) => {
  await addTodos(popup, "Gift ideas", "Groceries");
  await expect.poll(async () => todoKeys(await storage("sync")).length).toBe(2);

  await row(popup, "Gift ideas").hover();
  await row(popup, "Gift ideas").getByRole("button", { name: /^Synced\./ }).click();

  await expect(row(popup, "Gift ideas")).toHaveAccessibleName(/on this device only$/);
  await expect(popup.getByText("1 on this device only")).toBeVisible();
  await expect.poll(async () => todoKeys(await storage("local")).length).toBe(1);
  await expect.poll(async () => todoKeys(await storage("sync")).length).toBe(1);

  await row(popup, "Gift ideas").getByRole("button", { name: /^On this device only\./ }).click();
  await expect(row(popup, "Gift ideas")).toHaveAccessibleName(/(synced|saving to sync)$/);
  await expect.poll(async () => todoKeys(await storage("sync")).length).toBe(2);
  await expect.poll(async () => todoKeys(await storage("local")).length).toBe(0);
});

test.describe("when sync storage is nearly full", () => {
  test.beforeEach(async ({ seed }) => {
    const now = Date.now();
    const record = (text: string, position: string, extra: object = {}) => ({ t: text, d: 0, p: position, c: now, u: now, ...extra });
    // "Synced one" is long (about 3 KB), so keeping it on the device frees real space.
    const sync: Record<string, unknown> = { "meta": { v: 1 }, "t:synced0001": record("Synced one ".padEnd(3_000, "."), "a0") };

    // About 97% of the 100 KB quota: past the 95% line, so nothing new fits.
    // Positions "b" + two base-62 digits are valid fractional-indexing keys after "a…".
    const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    for (let i = 0; i < 173; i++) {
      const position = `b${digits[Math.floor(i / 62)]}${digits[i % 62]}`;

      sync[`t:filler${String(i).padStart(4, "0")}`] = record(`Older note ${i} `.padEnd(480, "."), position);
    }

    await seed({ sync, local: { "t:waiting0001": record("Waiting one", "a1") } });
  });

  test("shows the capacity meter and keeps new to-dos on the device", async ({ popup }) => {
    await expect(popup.getByRole("meter", { name: /Sync storage \d+% full/ })).toBeVisible();
    await expect(row(popup, "Waiting one")).toHaveAccessibleName(/on this device until sync has room$/);

    const input = popup.getByLabel("New to-do");

    await input.fill("Brand new");
    await input.press("Enter");
    await expect(row(popup, "Brand new")).toHaveAccessibleName(/on this device until sync has room$/);
  });

  test("explains why a to-do can't be synced, and syncs it once there is room", async ({ popup }) => {
    await row(popup, "Waiting one").getByRole("button", { name: /^On this device until sync has room/ }).click();
    await expect(popup.getByText("Sync storage is full. Keep another to-do on this device to make room.")).toBeVisible();

    // Its text is padded to about 3 KB, so match the start of its name.
    const big = popup.getByRole("group", { name: /^Synced one \.+, / });

    await big.hover();
    await big.getByRole("button", { name: /^Synced\./ }).click();
    await expect(big).toHaveAccessibleName(/on this device only$/);

    await row(popup, "Waiting one").getByRole("button", { name: /^On this device until sync has room/ }).click();
    await expect(row(popup, "Waiting one")).toHaveAccessibleName(/(synced|saving to sync)$/);
  });
});
