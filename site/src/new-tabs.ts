/**
 * Links that open another tab say so to screen readers, as in the extension:
 * in words after the text, or in the label when they have one.
 */
export function markNewTabs(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[target=\"_blank\"]")) {
    const label = link.getAttribute("aria-label");

    if (label !== null) {
      link.setAttribute("aria-label", `${label} (opens in a new tab)`);
    }
    else {
      const note = document.createElement("span");

      note.className = "visually-hidden";
      note.textContent = " (opens in a new tab)";
      link.append(note);
    }
  }
}
