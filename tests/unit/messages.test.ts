import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { errorMessage, truncate } from "~/lib/messages";
import { TodoError } from "~/lib/todos/errors";



describe("errorMessage", () => {
  beforeEach(() => {
    // The fake browser has no messages; echo the message name instead.
    vi.spyOn(fakeBrowser.i18n, "getMessage").mockImplementation((name: string) => name);
  });

  it("gives every refusal its own message, and a generic one for anything else", () => {
    const messages = (["empty", "not-found", "sync-full", "sync-unavailable"] as const)
      .map(code => errorMessage(new TodoError(code)));

    messages.push(errorMessage(new Error("boom")));

    expect(messages.every(message => message.length > 0)).toBe(true);
    expect(new Set(messages).size).toBe(messages.length);
  });
});

describe("truncate", () => {
  it("keeps short text as is", () => {
    expect(truncate("Buy milk")).toBe("Buy milk");
  });

  it("cuts long text at a word, with an ellipsis", () => {
    const result = truncate("Renew passport before March and check the photo requirements", 30);

    expect(result).toBe("Renew passport before March…");
    expect(Array.from(result).length).toBeLessThanOrEqual(30);
  });

  it("cuts mid-word when there is no good break", () => {
    expect(truncate("a".repeat(50), 10)).toBe(`${"a".repeat(9)}…`);
  });
});
