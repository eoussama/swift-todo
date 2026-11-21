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
