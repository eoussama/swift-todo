import type { TTodo } from "./model";



/**
 * A `#tag`: starts with a letter or digit, then letters, digits, `_` or `-`,
 * up to 32 characters. It must not follow a letter, digit, `_` or `#`, so
 * "C#" and "a#b" aren't tags.
 */
const TAG_PATTERN = /(?<![\p{L}\p{N}_#])#([\p{L}\p{N}][\p{L}\p{N}_-]{0,31})/gu;

/** A `#` being typed at the caret, with the letters typed so far. */
const PARTIAL_TAG_PATTERN = /(?<![\p{L}\p{N}_#])#([\p{L}\p{N}_-]{0,32})$/u;

export type TTextSegment = { kind: "text"; value: string } | { kind: "tag"; value: string; tag: string };

/**
 * Normalizes a tag for comparing: lower case, without the `#`.
 *
 * @param tag A tag, with or without `#`.
 * @returns The normalized tag.
 */
export function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").toLocaleLowerCase();
}

/**
 * Finds the tags in a to-do's text.
 *
 * @param text The to-do text.
 * @returns The normalized tags, each once, in order of appearance.
 */
export function extractTags(text: string): Array<string> {
  return [...new Set([...text.matchAll(TAG_PATTERN)].map(match => normalizeTag(match[1]!)))];
}

/**
 * Splits text into plain parts and tags, for showing tags as chips.
 *
 * @param text The to-do text.
 * @returns The segments, in order.
 */
export function segmentText(text: string): Array<TTextSegment> {
  const segments: Array<TTextSegment> = [];
  let last = 0;

  for (const match of text.matchAll(TAG_PATTERN)) {
    if (match.index > last) {
      segments.push({ kind: "text", value: text.slice(last, match.index) });
    }

    segments.push({ kind: "tag", value: match[0], tag: normalizeTag(match[1]!) });
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }

  return segments;
}

/**
 * Lists every tag in use, most used first, then alphabetically.
 *
 * @param todos The to-dos to look at.
 * @returns The normalized tags.
 */
export function collectTags(todos: ReadonlyArray<Pick<TTodo, "text">>): Array<string> {
  const counts = new Map<string, number>();

  for (const todo of todos) {
    for (const tag of extractTags(todo.text)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b)).map(([tag]) => tag);
}

/**
 * Finds the tag being typed just before the caret, for suggestions.
 *
 * @param text The input text.
 * @param caret The caret position.
 * @returns What has been typed after `#` and where the `#` is, or `null`.
 */
export function tagQueryAt(text: string, caret: number): { query: string; start: number } | null {
  const match = PARTIAL_TAG_PATTERN.exec(text.slice(0, caret));

  return match === null ? null : { query: normalizeTag(match[1]!), start: match.index };
}

/**
 * Replaces the tag being typed with a complete one, followed by a space.
 *
 * @param text The input text.
 * @param start Where the `#` is.
 * @param caret The caret position.
 * @param tag The tag to insert, without `#`.
 * @returns The new text and caret position.
 */
export function completeTag(text: string, start: number, caret: number, tag: string): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(caret).replace(/^[\p{L}\p{N}_-]*/u, "");
  const inserted = `#${tag}${after.startsWith(" ") ? "" : " "}`;

  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}

/**
 * Suggests tags for what has been typed after `#`.
 *
 * @param tags Every tag in use, most used first.
 * @param query What has been typed after `#`.
 * @param limit How many to suggest.
 * @returns Matching tags, prefix matches first, without the exact match.
 */
export function suggestTags(tags: ReadonlyArray<string>, query: string, limit = 5): Array<string> {
  const q = normalizeTag(query);
  const prefix = tags.filter(tag => tag.startsWith(q) && tag !== q);
  const inner = tags.filter(tag => !tag.startsWith(q) && tag.includes(q));

  return [...prefix, ...inner].slice(0, limit);
}
