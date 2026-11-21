// @vitest-environment happy-dom
import type { TodoStore } from "~/lib/todos/todos.svelte";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCENT_SWATCHES, contrastRatio } from "~/lib/accents";
import { APPEARANCE_CACHE_KEY, applyAppearance, cacheAppearance, readCachedAppearance, resolveTheme } from "~/lib/appearance";
import { paintCachedAppearance, useAppearance } from "~/lib/appearance.svelte";
import { ACCENTS, DEFAULT_PREFS } from "~/lib/prefs/prefs";

import { flush, reactive, withEffects } from "./effects.svelte";



function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));

  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("accent colors", () => {
  const css = readFileSync(resolve(import.meta.dirname, "../../src/assets/skins/accents.css"), "utf8");

  it("pair every fill with text at 4.5:1 or more", () => {
    for (const accent of ACCENTS) {
      for (const tone of ["light", "dark"] as const) {
        const swatch = ACCENT_SWATCHES[accent][tone];

        expect(contrastRatio(swatch.fill, swatch.text), `${accent} ${tone}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("match the stylesheet", () => {
    for (const accent of ACCENTS) {
      const light = ACCENT_SWATCHES[accent].light;
      const dark = ACCENT_SWATCHES[accent].dark;

      expect(css).toContain(`:root[data-accent="${accent}"] { --primary: ${light.fill}; --primary-foreground: ${light.text}; }`);

      if (dark.fill !== light.fill) {
        expect(css).toContain(`:root[data-accent="${accent}"]:is([data-theme="dark"], [data-skin="chalk"]) { --primary: ${dark.fill}; --primary-foreground: ${dark.text}; }`);
      }
      else {
        expect(dark).toEqual(light);
      }
    }
  });

  it("measures contrast like WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#0a0a0a", "#ffffff")).toBeCloseTo(19.8, 1);
  });
});

describe("appearance", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves the theme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("sets the root attributes", () => {
    const root = { dataset: {} as Record<string, string> } as HTMLElement;

    expect(applyAppearance(root, { skin: "scroll", accent: "teal", theme: "system" }, true)).toBe("dark");
    expect(root.dataset).toEqual({ skin: "scroll", accent: "teal", theme: "dark" });
  });

  it("caches the appearance, and reads it back defensively", () => {
    const storage = memoryStorage();
    const defaults = { skin: DEFAULT_PREFS.skin, accent: DEFAULT_PREFS.accent, theme: DEFAULT_PREFS.theme };

    expect(readCachedAppearance(storage)).toEqual(defaults);

    cacheAppearance(storage, { skin: "chalk", accent: "rose", theme: "dark", reminders: true } as never);
    expect(JSON.parse(storage.data.get(APPEARANCE_CACHE_KEY)!)).toEqual({ skin: "chalk", accent: "rose", theme: "dark" });
    expect(readCachedAppearance(storage)).toEqual({ skin: "chalk", accent: "rose", theme: "dark" });

    storage.data.set(APPEARANCE_CACHE_KEY, "{not json");
    expect(readCachedAppearance(storage)).toEqual(defaults);

    storage.data.set(APPEARANCE_CACHE_KEY, JSON.stringify({ skin: "neon" }));
    expect(readCachedAppearance(storage)).toEqual(defaults);
  });

  it("survives storage that refuses writes", () => {
    expect(() => cacheAppearance({ setItem: () => {
      throw new Error("quota");
    } }, DEFAULT_PREFS)).not.toThrow();
  });

  function stubPage(options: { dark: boolean; cached?: Record<string, string>; theme?: string }) {
    const listeners = new Set<(event: { matches: boolean }) => void>();
    const root = { dataset: { ...(options.theme === undefined ? {} : { theme: options.theme }) } as Record<string, string> };
    const storage = memoryStorage(options.cached);

    vi.stubGlobal("document", { documentElement: root });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("matchMedia", () => ({
      matches: options.dark,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
    }));

    return { root, storage, listeners };
  }

  it("paints the cached appearance before mounting", () => {
    const { root } = stubPage({ dark: true, cached: { [APPEARANCE_CACHE_KEY]: JSON.stringify({ skin: "sticky", accent: "sky", theme: "system" }) } });

    expect(paintCachedAppearance()).toBe("dark");
    expect(root.dataset).toEqual({ skin: "sticky", accent: "sky", theme: "dark" });
  });

  it("follows the settings once loaded, and the system theme", () => {
    const { root, storage, listeners } = stubPage({ dark: false, theme: "dark" });
    const store = reactive({ ready: false, prefs: { ...DEFAULT_PREFS, skin: "minimal" as const } });
    let appearance: { readonly theme: string } | undefined;

    const stop = withEffects(() => {
      appearance = useAppearance(store.current as unknown as TodoStore);
    });

    // Not loaded yet: the cached look stays.
    expect(appearance?.theme).toBe("dark");
    expect(root.dataset.skin).toBeUndefined();

    store.current.ready = true;
    flush();
    expect(root.dataset).toEqual({ skin: "minimal", accent: "mint", theme: "light" });
    expect(appearance?.theme).toBe("light");
    expect(storage.data.has(APPEARANCE_CACHE_KEY)).toBe(true);

    for (const listener of listeners) {
      listener({ matches: true });
    }

    flush();
    expect(root.dataset.theme).toBe("dark");
    expect(appearance?.theme).toBe("dark");

    stop();
    expect(listeners.size).toBe(0);
  });

  it("starts light when nothing was painted", () => {
    stubPage({ dark: false });

    let appearance: { readonly theme: string } | undefined;
    const stop = withEffects(() => {
      appearance = useAppearance({ ready: false, prefs: DEFAULT_PREFS } as unknown as TodoStore);
    });

    expect(appearance?.theme).toBe("light");
    stop();
  });
});
