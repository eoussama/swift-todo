import { addTodos, row, test } from "./fixtures";

const state = async (popup) => popup.evaluate(() => JSON.stringify({
  menus: [...document.querySelectorAll("[data-slot=dropdown-menu-content]")].map(el => (el as HTMLElement).dataset.state),
  body: getComputedStyle(document.body).pointerEvents,
  triggers: [...document.querySelectorAll("[aria-label='More actions']")].map(el => el.getAttribute("aria-expanded")),
}));

test("probe uncovered trigger", async ({ popup }) => {
  const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta"];
  await addTodos(popup, ...names);
  for (const first of names) {
    const fb = await row(popup, first).getByRole("button", { name: "More actions" }).boundingBox();
    await popup.mouse.move(fb!.x + 5, fb!.y + 5);
    await popup.mouse.down(); await popup.mouse.up();
    await popup.waitForTimeout(300);
    const menu = await popup.locator("[data-slot=dropdown-menu-content]").boundingBox();
    for (const second of names) {
      if (second === first) continue;
      const sb = await row(popup, second).getByRole("button", { name: "More actions" }).boundingBox();
      const cx = sb!.x + sb!.width / 2, cy = sb!.y + sb!.height / 2;
      const covered = cx >= menu!.x && cx <= menu!.x + menu!.width && cy >= menu!.y && cy <= menu!.y + menu!.height;
      if (!covered && cy > 150 && cy < 520) {
        console.log("menu", first, JSON.stringify(menu), "uncovered", second);
        await popup.mouse.move(cx, cy, { steps: 3 });
        await popup.mouse.down(); await popup.mouse.up();
        await popup.waitForTimeout(400);
        console.log("result", await state(popup));
        return;
      }
    }
    await popup.keyboard.press("Escape");
    await popup.waitForTimeout(300);
  }
  console.log("always covered");
});
