import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { createTodoRepository } from "~/lib/todos/sync-repository";



describe("createTodoRepository", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("works against the browser storage APIs", async () => {
    const repository = createTodoRepository();

    await repository.add("Buy milk");
    await repository.flush();

    const stored = await fakeBrowser.storage.sync.get(null);
    const { todos, status } = await repository.load();

    expect(Object.keys(stored).filter(key => key.startsWith("t:"))).toHaveLength(1);
    expect(todos).toMatchObject([{ text: "Buy milk", location: "sync", pending: false }]);
    expect(status.mode).toBe("sync");
  });
});
