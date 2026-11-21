import type { TResolvedTheme } from "./appearance";
import type { TodoStore } from "./todos/todos.svelte";

import { applyAppearance, cacheAppearance, readCachedAppearance } from "./appearance";



const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Paints the cached skin right away, before anything mounts.
 *
 * @returns The theme shown.
 */
export function paintCachedAppearance(): TResolvedTheme {
  return applyAppearance(document.documentElement, readCachedAppearance(localStorage), matchMedia(DARK_QUERY).matches);
}

/**
 * Keeps the page's skin, accent and theme in step with the settings and the
 * system theme. Call it while a component initializes.
 *
 * @param store The store holding the settings.
 * @returns The theme shown, for components that need it (toasts).
 */
export function useAppearance(store: TodoStore): { readonly theme: TResolvedTheme } {
  const query = matchMedia(DARK_QUERY);
  let systemDark = $state(query.matches);
  let theme = $state<TResolvedTheme>(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  $effect(() => {
    const listener = (event: MediaQueryListEvent): void => {
      systemDark = event.matches;
    };

    query.addEventListener("change", listener);

    return () => query.removeEventListener("change", listener);
  });

  $effect(() => {
    // Until the settings load, the cached appearance stays.
    if (!store.ready) {
      return;
    }

    const appearance = { skin: store.prefs.skin, accent: store.prefs.accent, theme: store.prefs.theme };

    theme = applyAppearance(document.documentElement, appearance, systemDark);
    cacheAppearance(localStorage, appearance);
  });

  return {
    get theme() {
      return theme;
    },
  };
}
