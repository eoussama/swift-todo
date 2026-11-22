const NOTE = " (opens in a new tab)";

// Says so once per link: in its label when it has one, else in words after its text.
function mark(link: HTMLAnchorElement): void {
  const label = link.getAttribute("aria-label");

  if (label !== null) {
    if (!label.endsWith(NOTE)) {
      link.setAttribute("aria-label", `${label}${NOTE}`);
    }
  }
  else if (link.querySelector("[data-new-tab]") === null) {
    const note = document.createElement("span");

    note.className = "visually-hidden";
    note.dataset.newTab = "";
    note.textContent = NOTE;
    link.append(note);
  }
}

/**
 * Links that open another tab say so to screen readers, as in the extension,
 * including links that only start opening one later (the hero's button learns
 * the visitor's browser after the page starts).
 */
export function markNewTabs(): void {
  const markAll = (): void => {
    for (const link of document.querySelectorAll<HTMLAnchorElement>("a[target=\"_blank\"]")) {
      mark(link);
    }
  };

  markAll();
  new MutationObserver(markAll).observe(document.body, { subtree: true, childList: true, attributeFilter: ["target"] });
}
