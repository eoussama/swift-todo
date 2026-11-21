import { describe, expect, it } from "vitest";

import { parseLink } from "~/lib/todos/model";

import { createDevice } from "./helpers";



describe("parseLink", () => {
  it("takes web addresses as typed, adding https:// when it's missing", () => {
    expect(parseLink("https://example.com/a?b=1")).toEqual({ url: "https://example.com/a?b=1", title: null });
    expect(parseLink("  http://example.com  ")).toEqual({ url: "http://example.com/", title: null });
    expect(parseLink("example.com/recipe")).toEqual({ url: "https://example.com/recipe", title: null });
    expect(parseLink("HTTPS://Example.com")).toEqual({ url: "https://example.com/", title: null });
    // With the scheme typed, a host without a dot is fine.
    expect(parseLink("http://localhost:3000/x")).toEqual({ url: "http://localhost:3000/x", title: null });
    expect(parseLink("example.com:8080/x")).toEqual({ url: "https://example.com:8080/x", title: null });
    // A scheme further along, or a colon in the path, doesn't make one at the start.
    expect(parseLink("example.com/go?to=https://other.org")).toEqual({ url: "https://example.com/go?to=https://other.org", title: null });
    expect(parseLink("example.com/a:b")).toEqual({ url: "https://example.com/a:b", title: null });
  });

  it("refuses anything that isn't an http(s) address", () => {
    for (const input of ["", "   ", "notes", "two words.com", "javascript:alert(1)", "ftp://example.com", "mailto:a@b.com", "https://", "file:///etc/passwd", "localhost:3000", "https://user:pass@example.com", "https://user@example.com", "https://:pass@example.com", "example.com/a b", "https://example.com/a b", "example.com:/page", "web2.example.com:/page"]) {
      expect(parseLink(input), input).toBeNull();
    }
  });
});

describe("a to-do's link", () => {
  it("is set, changed and removed through updates, with the same checks as a captured page", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Try the recipe");
    const link = async () => (await device.repository.load()).todos[0]?.source;

    await device.repository.update(todo.id, { source: { url: "https://example.com/recipe", title: null } });
    expect(await link()).toEqual({ url: "https://example.com/recipe", title: null });

    await device.repository.update(todo.id, { source: { url: "https://example.com/recipe", title: "  The   recipe " } });
    expect(await link()).toEqual({ url: "https://example.com/recipe", title: "The recipe" });

    // An unsafe address is dropped rather than stored.
    await device.repository.update(todo.id, { source: { url: "javascript:alert(1)", title: null } });
    expect(await link()).toBeNull();

    await device.repository.update(todo.id, { source: { url: "https://example.com/other", title: null } });
    await device.repository.flush();
    // The same link again changes nothing.
    await device.repository.update(todo.id, { source: { url: "https://example.com/other", title: null } });
    expect((await device.repository.load()).todos[0]?.pending).toBe(false);

    // A new address with the same (or no) title is still a change.
    await device.repository.flush();
    await device.repository.update(todo.id, { source: { url: "https://example.com/third", title: null } });
    expect(await link()).toEqual({ url: "https://example.com/third", title: null });
    expect((await device.repository.load()).todos[0]?.pending).toBe(true);

    await device.repository.update(todo.id, { source: null });
    expect(await link()).toBeNull();
  });
});
