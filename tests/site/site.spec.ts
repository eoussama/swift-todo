import type { Page } from "@playwright/test";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { test as base, expect } from "@playwright/test";



// The website, as built into `.output/site`. Motion is reduced, so sections
// show without waiting for their entrance and examples type in at once.

const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const errors: Array<string> = [];

    page.on("pageerror", error => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await use(page);
    expect(errors, "errors on the page").toEqual([]);
  },
});

const demo = (page: Page) => page.getByRole("region", { name: "Swift TODO demo" });

test("reads fine without JavaScript, as rendered at build time", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your to-dos, one click away.");

  for (const name of ["Thirty seconds, start to done", "Just type it", "Small list, no small features", "Five skins, light and dark", "Get Swift TODO", "Questions, answered"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }

  await expect(demo(page).getByRole("checkbox")).toHaveCount(3);
  // Without the inline player, the trailer is a plain link to YouTube.
  await expect(page.getByRole("link", { name: /Play the Swift TODO trailer/ })).toHaveAttribute("href", "https://youtu.be/Hq2HmWK0GEY");
  await context.close();
});

test("loads nothing from other sites until the trailer plays, then plays it in place", async ({ page }) => {
  const elsewhere: Array<string> = [];

  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "localhost") {
      elsewhere.push(request.url());
    }
  });
  await page.route("https://www.youtube-nocookie.com/**", async route => route.fulfill({ contentType: "text/html", body: "<p>Trailer</p>" }));

  await page.goto("/");
  await page.evaluate(async () => document.fonts.ready);
  await page.mouse.wheel(0, 20_000);
  await page.waitForLoadState("networkidle");
  expect(elsewhere).toEqual([]);

  await page.getByRole("link", { name: /Play the Swift TODO trailer/ }).click();

  const player = page.locator("iframe[title='Swift TODO trailer']");

  await expect(player).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/Hq2HmWK0GEY\?autoplay=1/);
  await expect(player.contentFrame().getByText("Trailer")).toBeVisible();
});

test("reads dates as you type with the extension's parser, and celebrates when all is done", async ({ page }) => {
  await page.goto("/");

  const popup = demo(page);

  // The sample dates appear once the page knows today's date.
  await expect(popup.getByRole("listitem").first()).toContainText(/Today 3:00\sPM/);

  await page.getByRole("button", { name: "Call Sam tomorrow 6pm" }).click();
  await expect(popup.getByLabel("New to-do")).toHaveValue("Call Sam tomorrow 6pm");
  // Times are formatted by the browser, with a narrow space before PM.
  await expect(popup.getByRole("status")).toContainText(/Tomorrow 6:00\sPM/);

  await popup.getByLabel("New to-do").press("Enter");
  await expect(popup.getByLabel("New to-do")).toHaveValue("");
  await expect(popup.getByRole("listitem").first()).toContainText("Call Sam");
  await expect(popup.getByRole("listitem").first()).toContainText(/Tomorrow 6:00\sPM/);
  await expect(popup.getByText("0 of 4 done")).toBeVisible();

  // Checked-off rows move to the bottom, so take the first open one each time.
  for (let left = 4; left > 0; left--) {
    await expect(popup.getByRole("checkbox", { checked: false })).toHaveCount(left);
    await popup.getByRole("checkbox", { checked: false }).first().check();
  }

  await expect(popup.getByText("All done!")).toBeVisible();

  await popup.getByRole("button", { name: "Start over" }).click();
  await expect(popup.getByText("0 of 3 done")).toBeVisible();
});

test("moves a repeating to-do to its next date when checked off", async ({ page }) => {
  await page.goto("/");

  const popup = demo(page);
  const input = popup.getByLabel("New to-do");

  await input.fill("Water the plants every 3 days #home");
  await expect(popup.getByRole("status")).toContainText("Every 3 days");
  await input.press("Enter");

  const row = popup.getByRole("listitem").filter({ hasText: "Water the plants" });

  await expect(row.getByText("#home")).toBeVisible();
  // Checking it moves it along instead, so it stays unchecked.
  await row.getByRole("checkbox").click();
  await expect(popup.getByRole("status")).toHaveText(/^Next: /);
  await expect(row.getByRole("checkbox")).not.toBeChecked();
});

test("shows each skin, light and dark", async ({ page }) => {
  await page.goto("/");

  const skins = page.locator("#skins");

  await skins.getByRole("radio", { name: "Chalkboard" }).check();
  await skins.getByRole("radio", { name: "Dark" }).check();
  await expect(skins.locator(".caption")).toContainText("Chalk on a green board");
  await expect(skins.locator("img[src*='skin-chalk-dark']")).toHaveCount(1);

  await skins.getByRole("button", { name: "Next skin" }).click();
  await expect(skins.getByRole("radio", { name: "Minimal" })).toBeChecked();
});

test("offers the visitor's browser first", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Get it for Chrome" })).toHaveAttribute("href", "#install");

  const chrome = page.locator("#install li").filter({ hasText: "Chrome" });

  await expect(chrome.getByText("Your browser")).toBeVisible();
  await expect(chrome.getByRole("link", { name: "Download for Chrome" })).toHaveAttribute("href", "https://github.com/eoussama/swift-todo/releases/latest");
});

for (const scheme of ["light", "dark"] as const) {
  test(`has no detectable accessibility issues in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(async () => document.fonts.ready);

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map(node => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

for (const width of [320, 390, 768]) {
  test(`fits a ${width}-pixel screen without scrolling sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.evaluate(async () => document.fonts.ready);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("links to the privacy policy, a page made from PRIVACY.md", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy policy" }).click();
  await expect(page).toHaveURL("/privacy/");
  await expect(page).toHaveTitle("Privacy policy – Swift TODO");

  const policy = readFileSync(resolve(import.meta.dirname, "../../PRIVACY.md"), "utf8");
  const headings = [...policy.matchAll(/^#{1,6} (.+)$/gm)].map(match => match[1]!.trim());

  await expect(page.getByRole("heading")).toHaveText(headings);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
  await expect(page.locator("code", { hasText: "storage.sync" })).toBeVisible();
  await expect(page.getByRole("link", { name: "hi@ouss.es" })).toHaveAttribute("href", "mailto:hi@ouss.es");

  // The sections link back to the home page.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "FAQ" }).click();
  await expect(page).toHaveURL("/#faq");
});

test("opens links to other sites in a new tab, and the site's own in the same one", async ({ page }) => {
  for (const path of ["/", "/privacy/"]) {
    await page.goto(path);

    const links = await page.locator("a[href]").evaluateAll(anchors => anchors.map(anchor => ({
      href: anchor.getAttribute("href")!,
      target: anchor.getAttribute("target"),
      rel: anchor.getAttribute("rel") ?? "",
    })));
    const outside = links.filter(link => link.href.startsWith("http"));

    expect(outside.length, `links to other sites on ${path}`).toBeGreaterThan(0);

    for (const link of outside) {
      expect(link, link.href).toMatchObject({ target: "_blank", rel: expect.stringContaining("noopener") });
    }

    for (const link of links.filter(link => link.href.startsWith("/") || link.href.startsWith("#"))) {
      expect(link.target, link.href).toBeNull();
    }
  }
});

test("keeps a checked box checked-looking under the pointer", async ({ page }) => {
  await page.goto("/");

  // By text: checking a row moves it to the bottom.
  const box = demo(page).getByRole("listitem").filter({ hasText: "Send the quarterly report" }).locator(".box");

  await box.getByRole("checkbox").check();
  await box.hover();
  await expect(box.locator(".fake")).toHaveCSS("background-color", "rgb(57, 200, 154)");
});

test("draws reading progress as the extension's pencil, growing as the page scrolls", async ({ page }) => {
  await page.goto("/");

  const pencil = page.getByRole("banner").locator(".pencil");

  for (const part of [".eraser", ".band", ".body", ".tip"]) {
    await expect(pencil.locator(part)).toBeAttached();
  }

  const width = async () => pencil.locator(".grow").evaluate(element => element.getBoundingClientRect().width);
  const start = await width();

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: "instant" }));
  await expect.poll(width).toBeGreaterThan(start + 100);
});
