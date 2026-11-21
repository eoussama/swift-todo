import AxeBuilder from "@axe-core/playwright";

import { addTodos, expect, row, test } from "./fixtures";



for (const colorScheme of ["light", "dark"] as const) {
  test(`has no detectable accessibility issues in the ${colorScheme} theme`, async ({ popup }) => {
    await popup.emulateMedia({ colorScheme });

    const empty = await new AxeBuilder({ page: popup }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

    expect(empty.violations).toEqual([]);

    await addTodos(popup, "Reply to Sam about the offsite", "Buy oat milk", "Water the plants");
    await row(popup, "Buy oat milk").getByRole("checkbox").click();
    await popup.keyboard.press("ArrowDown");

    const list = await new AxeBuilder({ page: popup }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();

    expect(list.violations).toEqual([]);
  });
}
