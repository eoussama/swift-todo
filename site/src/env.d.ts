/// <reference types="vite/client" />

/** A PNG served as WebP by `vite.config.ts`: its URL. */
declare module "*.png?webp" {
  const src: string;

  export default src;
}

/** The extension's version, set by `vite.config.ts`. */
declare const __VERSION__: string;
