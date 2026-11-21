export type TBrowser = "chrome" | "edge" | "firefox";

/**
 * Store pages. Until a listing is live, its buttons point at the GitHub
 * release instead and the install section says how to load the zip; paste
 * the store's URL here once it is.
 */
export const STORES: Record<TBrowser, string | null> = {
  chrome: null,
  edge: null,
  firefox: null,
};

export const BROWSERS: ReadonlyArray<{ id: TBrowser; name: string; note: string }> = [
  { id: "chrome", name: "Chrome", note: "And Brave, Vivaldi, Opera" },
  { id: "edge", name: "Edge", note: "Microsoft Edge Add-ons" },
  { id: "firefox", name: "Firefox", note: "Version 140 or later" },
];

/** The extension's version, from package.json. */
export const VERSION = __VERSION__;
export const SITE = "https://swift-todo.ouss.es";
export const REPO = "https://github.com/eoussama/swift-todo";
export const RELEASE = `${REPO}/releases/latest`;
export const INSTALL_GUIDE = `${REPO}#installation`;
/** The privacy policy page, made from PRIVACY.md; the stores link to it. */
export const PRIVACY = "/privacy/";
export const CHANGELOG = `${REPO}/blob/master/CHANGELOG.md`;
export const LICENSE = `${REPO}/blob/master/LICENSE`;
export const ISSUES = `${REPO}/issues`;
export const AUTHOR = "https://ouss.es";

export const TRAILER = {
  id: "Hq2HmWK0GEY",
  url: "https://youtu.be/Hq2HmWK0GEY",
  // No cookies until the video plays, and nothing at all from YouTube before the click.
  embed: "https://www.youtube-nocookie.com/embed/Hq2HmWK0GEY?autoplay=1&rel=0&modestbranding=1",
};

/**
 * Where a browser's install button goes.
 *
 * @param browser The browser.
 * @returns The store page, or the latest release while there's none.
 */
export function installUrl(browser: TBrowser): string {
  return STORES[browser] ?? RELEASE;
}

/**
 * Guesses the visitor's browser, to offer its button first.
 *
 * @param agent The user agent.
 * @returns The browser, or null for one Swift TODO doesn't run in (Safari, phones).
 */
export function detectBrowser(agent: string): TBrowser | null {
  if (/Android|iPhone|iPad/i.test(agent)) {
    return null;
  }

  if (/Edg\//.test(agent)) {
    return "edge";
  }

  if (/Firefox\//.test(agent)) {
    return "firefox";
  }

  return /Chrome\//.test(agent) ? "chrome" : null;
}
