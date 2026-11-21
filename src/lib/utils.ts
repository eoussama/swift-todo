import type { ClassValue } from "clsx";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";



/**
 * Joins class names and resolves conflicting Tailwind classes, last one wins.
 *
 * @param inputs Class names, arrays or condition maps.
 * @returns The merged class string.
 */
export function cn(...inputs: Array<ClassValue>): string {
  return twMerge(clsx(inputs));
}

/* eslint-disable ts/no-explicit-any -- shadcn-svelte helper types match any `child`/`children` prop. */
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
/* eslint-enable ts/no-explicit-any */
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Puts a trigger's props (a tooltip's, say) under an element's own: the
 * element's values win, and when both handle an event, both run, the
 * trigger's first.
 *
 * @param trigger The props the trigger needs on the element.
 * @param own The element's own props.
 * @returns The props to spread on the element.
 */
export function mergeProps(trigger: Record<string, unknown>, own: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...trigger, ...own };

  for (const [key, handler] of Object.entries(own)) {
    const first = trigger[key];

    if (key.startsWith("on") && typeof handler === "function" && typeof first === "function") {
      merged[key] = (...args: Array<unknown>) => {
        first(...args);
        handler(...args);
      };
    }
  }

  return merged;
}
