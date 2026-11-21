import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "@playwright/test";



// Store images for `branding/`, made from the icon and the showcase
// screenshots. Run with `pnpm branding`, after `pnpm showcase` if the
// screenshots changed.

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(ROOT, "branding");

/**
 * A file as a data URL, so the page needs no file access.
 *
 * @param path The file, from the repository root.
 * @param type Its media type.
 * @returns The data URL.
 */
function dataUrl(path: string, type: string): string {
  return `data:${type};base64,${readFileSync(resolve(ROOT, path)).toString("base64")}`;
}

/**
 * A showcase screenshot as a data URL.
 *
 * @param name Its file name, without the extension.
 * @returns The data URL.
 */
function shot(name: string): string {
  return dataUrl(`showcase/${name}.png`, "image/png");
}

const ICON = dataUrl("src/assets/icon.svg", "image/svg+xml");
const NUNITO = dataUrl("node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2", "font/woff2");
const CAVEAT = dataUrl("node_modules/@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2", "font/woff2");

// The Notepad skin's colors and fonts (src/assets/skins/notepad.css).
const BASE = `
  @font-face { font-family: "Nunito"; src: url(${NUNITO}) format("woff2"); font-weight: 200 1000; }
  @font-face { font-family: "Caveat"; src: url(${CAVEAT}) format("woff2"); font-weight: 400 700; }
  :root { --ink: #242c88; --sky: #caeafb; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body {
    position: relative;
    font-family: "Nunito", sans-serif;
    color: var(--ink);
    background: var(--sky) radial-gradient(rgb(36 44 136 / 0.1) 1.4px, transparent 1.7px) 0 0 / 20px 20px;
  }
  .hand { font-family: "Caveat", cursive; font-weight: 700; line-height: 1; }
  .popup {
    position: absolute;
    border: 3px solid var(--ink);
    border-radius: 18px;
    box-shadow: 0 9px 0 var(--ink);
    background: var(--sky);
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { width: 64px; height: 64px; }
  .brand span { font-size: 54px; }
  .underline {
    white-space: nowrap;
    padding: 0 6px;
    background: linear-gradient(transparent 62%, rgb(255 196 8 / 0.55) 62%, rgb(255 196 8 / 0.55) 92%, transparent 92%);
  }
  kbd { font: 700 0.85em "Nunito", sans-serif; border: 2px solid var(--ink); border-bottom-width: 4px; border-radius: 8px; padding: 0 8px; background: white; }
`;

interface IPlace {
  x: number;
  y: number;
  h: number;
  r?: number;
  z?: number;
}

interface IImage {
  file: string;
  width: number;
  height: number;
  transparent?: boolean;
  html: string;
}

/**
 * A popup screenshot, placed and turned.
 *
 * @param name The showcase screenshot.
 * @param place Where it goes, its height, its turn in degrees and its stacking.
 * @returns The HTML.
 */
function popup(name: string, place: IPlace): string {
  const { x, y, h, r = 0, z = 1 } = place;

  return `<img class="popup" src="${shot(name)}" style="left:${x}px;top:${y}px;height:${h}px;transform:rotate(${r}deg);z-index:${z}" alt="">`;
}

/**
 * A 1280x800 screenshot: a headline on the left, two popups on the right.
 *
 * @param title The headline.
 * @param body One or two sentences.
 * @param back The popup behind, on the right.
 * @param front The popup in front, on the left.
 * @param frontOnTop Whether the left popup covers the right one.
 * @returns The HTML.
 */
function feature(title: string, body: string, back: string, front: string, frontOnTop = true): string {
  return `
    <div style="position:absolute;left:84px;top:0;bottom:0;width:480px;display:flex;flex-direction:column;justify-content:center;gap:30px">
      <div class="brand"><img src="${ICON}" alt=""><span class="hand">Swift TODO</span></div>
      <h1 class="hand" style="font-size:84px">${title}</h1>
      <p style="font-size:27px;line-height:1.45;font-weight:600">${body}</p>
    </div>
    ${popup(back, { x: 858, y: 78, h: 590, r: 5, z: frontOnTop ? 1 : 2 })}
    ${popup(front, { x: 588, y: 100, h: 590, r: -3, z: frontOnTop ? 2 : 1 })}`;
}

const IMAGES: IImage[] = [
  // Icons. Chrome wants 96 pixels of art in the 128-pixel icon; Edge recommends 300 by 300.
  {
    file: "icons/icon-128.png",
    width: 128,
    height: 128,
    transparent: true,
    html: `<img src="${ICON}" style="position:absolute;left:16px;top:16px;width:96px;height:96px" alt="">`,
  },
  {
    file: "icons/icon-300.png",
    width: 300,
    height: 300,
    transparent: true,
    html: `<img src="${ICON}" style="position:absolute;left:10px;top:10px;width:280px;height:280px" alt="">`,
  },
  {
    file: "icons/icon-512.png",
    width: 512,
    height: 512,
    transparent: true,
    html: `<img src="${ICON}" style="width:512px;height:512px" alt="">`,
  },

  // Screenshots, 1280x800 for all three stores.
  {
    file: "screenshots/1-overview.png",
    width: 1280,
    height: 800,
    html: feature(
      `Your to-dos, <span class="underline">one click</span> away`,
      `Click the toolbar icon or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>, type, press <kbd>Enter</kbd>, and get back to what you were doing.`,
      "skin-notepad-dark",
      "overview",
    ),
  },
  {
    file: "screenshots/2-natural-language.png",
    width: 1280,
    height: 800,
    html: feature(
      `Just <span class="underline">type it</span>`,
      `“Call Sam tomorrow 6pm” gets a date, “water plants every 3 days” repeats, and a reminder tells you when it's due.`,
      "repeat",
      "natural-language",
    ),
  },
  {
    file: "screenshots/3-today-focus.png",
    width: 1280,
    height: 800,
    html: feature(
      `Today, then <span class="underline">focus</span>`,
      `See what's due today, then work through it one to-do at a time, with a timer.`,
      "focus",
      "today",
      false,
    ),
  },
  {
    file: "screenshots/4-skins.png",
    width: 1280,
    height: 800,
    html: `
      <div style="position:absolute;top:44px;left:0;right:0;text-align:center">
        <h1 class="hand" style="font-size:84px">Six skins, <span class="underline">light and dark</span></h1>
        <p style="font-size:27px;font-weight:600;margin-top:10px">Notepad, Sticky board, Chalkboard, Scroll, Minimal and Aurora, with eight accent colors.</p>
      </div>
      ${popup("overview", { x: 34, y: 262, h: 520, r: -7, z: 1 })}
      ${popup("skin-sticky-light", { x: 206, y: 250, h: 520, r: -4, z: 2 })}
      ${popup("skin-chalk-dark", { x: 378, y: 240, h: 520, r: -1.5, z: 3 })}
      ${popup("skin-scroll-light", { x: 550, y: 240, h: 520, r: 1.5, z: 3 })}
      ${popup("skin-minimal-dark", { x: 722, y: 250, h: 520, r: 4, z: 2 })}
      ${popup("skin-aurora-light", { x: 894, y: 262, h: 520, r: 7, z: 1 })}`,
  },
  {
    file: "screenshots/5-lists-sync.png",
    width: 1280,
    height: 800,
    html: feature(
      `Lists, #tags, and <span class="underline">sync</span>`,
      `Synced across your devices through your browser account. No sign-up, no servers, no tracking.`,
      "tag-filter",
      "list",
    ),
  },

  // Promo tiles: Chrome's small and marquee images, Edge's small and large tiles.
  {
    file: "promo/promo-small-440x280.png",
    width: 440,
    height: 280,
    html: `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
        <img src="${ICON}" style="width:118px;height:118px" alt="">
        <div class="hand" style="font-size:62px">Swift TODO</div>
      </div>`,
  },
  {
    file: "promo/promo-marquee-1400x560.png",
    width: 1400,
    height: 560,
    html: `
      <div style="position:absolute;left:96px;top:0;bottom:0;width:620px;display:flex;flex-direction:column;justify-content:center;gap:26px">
        <div class="brand" style="gap:22px"><img src="${ICON}" style="width:132px;height:132px" alt=""><span class="hand" style="font-size:104px">Swift TODO</span></div>
        <p style="font-size:32px;line-height:1.4;font-weight:600">A quick to-do list in your browser toolbar, synced with your browser account.</p>
      </div>
      ${popup("skin-chalk-dark", { x: 1080, y: 70, h: 600, r: 7, z: 1 })}
      ${popup("overview", { x: 790, y: 58, h: 600, r: -4, z: 2 })}`,
  },
];

for (const image of IMAGES) {
  test(image.file, async ({ page }) => {
    const background = image.transparent ? "body { background: transparent; }" : "";

    await page.setViewportSize({ width: image.width, height: image.height });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${background}</style></head><body>${image.html}</body></html>`);
    await page.evaluate(async () => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(img => img.complete));
    await page.screenshot({ path: resolve(OUT, image.file), omitBackground: Boolean(image.transparent) });
  });
}
