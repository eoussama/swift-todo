// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { autosize } from "~/lib/autosize";



function textarea(scrollHeight: number, style = ""): HTMLTextAreaElement {
  const node = document.createElement("textarea");

  node.setAttribute("style", style);
  Object.defineProperty(node, "scrollHeight", { configurable: true, get: () => scrollHeight });
  document.body.append(node);

  return node;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("autosize", () => {
  it("sizes the text area to its text, borders included", () => {
    const node = textarea(66, "border-top: 2px solid; border-bottom: 3px solid");

    autosize(node);

    expect(node.style.height).toBe("71px");
  });

  it("counts no borders when there are none", () => {
    const node = textarea(44);

    autosize(node);

    expect(node.style.height).toBe("44px");
  });

  it("grows as text is typed, and when the text changes from code", () => {
    let height = 22;
    const node = textarea(0);

    Object.defineProperty(node, "scrollHeight", { configurable: true, get: () => height });

    const action = autosize(node, "a");

    height = 44;
    node.dispatchEvent(new Event("input"));
    expect(node.style.height).toBe("44px");

    height = 66;
    action.update();
    expect(node.style.height).toBe("66px");
  });

  it("stops following typing once removed", () => {
    let height = 22;
    const node = textarea(0);

    Object.defineProperty(node, "scrollHeight", { configurable: true, get: () => height });

    autosize(node).destroy();

    height = 88;
    node.dispatchEvent(new Event("input"));
    expect(node.style.height).toBe("22px");
  });
});
