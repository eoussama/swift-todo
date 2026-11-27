import type { TPrefs, TSkin } from "./prefs/prefs";

import { DEFAULT_PREFS, parsePrefs, SKINS } from "./prefs/prefs";
import { isOneOf } from "./values";



export type TAppearance = Pick<TPrefs, "skin" | "accent" | "theme">;
export type TResolvedTheme = "light" | "dark";

/** What the progress bar in the header is drawn as. */
export type TWritingTool = "pencil" | "marker" | "chalk" | "quill" | "ballpoint" | "bar";

/** Each skin's writing tool: its own hand, writing on its own page. */
export const SKIN_TOOLS: Readonly<Record<TSkin, TWritingTool>> = Object.freeze({
  notepad: "pencil",
  sticky: "marker",
  chalk: "chalk",
  scroll: "quill",
  minimal: "ballpoint",
  aurora: "bar",
});

/**
 * Reads the skin painted on the page, as {@link applyAppearance} set it.
 *
 * @param root The root element.
 * @returns The skin, or the default when none was painted.
 */
export function paintedSkin(root: Pick<HTMLElement, "dataset">): TSkin {
  const skin = root.dataset.skin;

  return isOneOf(SKINS, skin) ? skin : DEFAULT_PREFS.skin;
}

/**
 * Where the popup keeps a copy of the appearance, in page `localStorage`, so
 * it can paint the right skin before the settings load from extension storage.
 */
export const APPEARANCE_CACHE_KEY = "swift-todo:appearance";

/**
 * Picks light or dark.
 *
 * @param theme The theme setting.
 * @param systemDark Whether the system prefers dark.
 * @returns The theme to show.
 */
export function resolveTheme(theme: TPrefs["theme"], systemDark: boolean): TResolvedTheme {
  if (theme === "system") {
    return systemDark ? "dark" : "light";
  }

  return theme;
}

/**
 * Applies a skin, accent and theme to the page: the stylesheets key off
 * `data-skin`, `data-accent` and `data-theme` on the root element.
 *
 * @param root The root element.
 * @param appearance The skin, accent and theme setting.
 * @param systemDark Whether the system prefers dark.
 * @returns The theme shown.
 */
export function applyAppearance(root: HTMLElement, appearance: TAppearance, systemDark: boolean): TResolvedTheme {
  const theme = resolveTheme(appearance.theme, systemDark);

  root.dataset.skin = appearance.skin;
  root.dataset.accent = appearance.accent;
  root.dataset.theme = theme;

  return theme;
}

/**
 * Reads the cached appearance, falling back to the defaults.
 *
 * @param storage Page storage.
 * @returns The appearance.
 */
export function readCachedAppearance(storage: Pick<Storage, "getItem">): TAppearance {
  try {
    // Nothing cached reads as "null", which gives the defaults.
    const prefs = parsePrefs(JSON.parse(String(storage.getItem(APPEARANCE_CACHE_KEY))));

    return { skin: prefs.skin, accent: prefs.accent, theme: prefs.theme };
  }
  catch {
    return { skin: DEFAULT_PREFS.skin, accent: DEFAULT_PREFS.accent, theme: DEFAULT_PREFS.theme };
  }
}

/**
 * Caches the appearance for the next time the popup opens.
 *
 * @param storage Page storage.
 * @param appearance The appearance.
 */
export function cacheAppearance(storage: Pick<Storage, "setItem">, appearance: TAppearance): void {
  try {
    storage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify({ skin: appearance.skin, accent: appearance.accent, theme: appearance.theme }));
  }
  catch {
    // Storage can be unavailable; the popup then just repaints once settings load.
  }
}
