/// <reference types="vite/client" />

/** A PNG served as WebP by `vite.config.ts`: its URL. */
declare module "*.png?webp" {
  const src: string;

  export default src;
}

/** The extension's version, set by `vite.config.ts`. */
declare const __VERSION__: string;

/** The store pages from `site/stores.json`, set by `vite.config.ts`; `""` for a store not live yet. */
declare const __STORES__: Record<"chrome" | "edge" | "firefox", string>;
