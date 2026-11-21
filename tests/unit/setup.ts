import { beforeEach, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";



// The fake browser has no messages: echo the message name, with any substitutions, so text stays checkable.
beforeEach(() => {
  vi.spyOn(fakeBrowser.i18n, "getMessage").mockImplementation((name: string, substitutions?: string | Array<string | number>) => (
    substitutions === undefined ? name : `${name}(${[substitutions].flat().join(",")})`
  ));
});
