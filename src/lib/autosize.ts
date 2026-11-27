/**
 * Grows a text area with its text, so it never scrolls inside: a to-do that
 * wraps over three lines is edited over three lines. A CSS `max-height` still
 * caps it, and it scrolls past that. Firefox has no `field-sizing: content`,
 * so the height is measured.
 *
 * @param node The text area.
 * @param _value The bound text, so the height follows changes made from code too.
 * @returns The action's update and teardown.
 */
export function autosize(node: HTMLTextAreaElement, _value?: string): { update: () => void; destroy: () => void } {
  const fit = (): void => {
    const style = getComputedStyle(node);
    // `box-sizing: border-box` counts the borders in the height; `scrollHeight` doesn't.
    const borders = (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0);

    node.style.height = "auto";
    node.style.height = `${node.scrollHeight + borders}px`;
  };

  fit();
  node.addEventListener("input", fit);

  return {
    update: fit,
    destroy: () => node.removeEventListener("input", fit),
  };
}
