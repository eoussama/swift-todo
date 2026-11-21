/** The note's element ID, so a second capture replaces the first note. */
export const CAPTURE_TOAST_ID = "swift-todo-capture-toast";

/**
 * Shows a short note in the corner of the page after "Add to Swift TODO", so
 * it's clear the selection was added. It runs inside the page (through
 * `scripting.executeScript`), so it uses nothing but its arguments and the
 * page's DOM, and draws in a shadow root the page's own styles can't reach.
 * Screen readers hear the message.
 *
 * @param message What to say, like "Added to Swift TODO".
 * @param duration How long it stays, in milliseconds.
 */
export function showCaptureToast(message: string, duration = 2400): void {
  const id = "swift-todo-capture-toast";

  document.getElementById(id)?.remove();

  const host = document.createElement("div");

  host.id = id;

  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");

  // The Notepad skin's navy ink, white paper and mint check.
  style.textContent = `
    :host { all: initial; }
    .note {
      position: fixed; z-index: 2147483647; right: 20px; bottom: 20px;
      display: flex; gap: 10px; align-items: center; max-width: min(360px, calc(100vw - 40px));
      padding: 9px 16px 9px 9px; font: 700 15px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #242c88; background: #fff; border: 2px solid #242c88; border-radius: 14px;
      box-shadow: 0 4px 0 #242c88; animation: in 0.35s cubic-bezier(0.3, 1.4, 0.5, 1) both;
    }
    .note.out { animation: out 0.25s ease-in forwards; }
    .check {
      display: grid; flex: none; place-items: center; width: 26px; height: 26px; font-size: 14px;
      background: #39c89a; border: 2px solid #242c88; border-radius: 50%;
    }
    @keyframes in { from { opacity: 0; transform: translateY(16px) scale(0.92); } }
    @keyframes out { to { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .note, .note.out { animation: none; } }
  `;

  const note = document.createElement("div");

  note.className = "note";
  note.setAttribute("role", "status");

  const check = document.createElement("span");

  check.className = "check";
  check.setAttribute("aria-hidden", "true");
  check.textContent = "✓";

  const text = document.createElement("span");

  note.append(check, text);
  root.append(style, note);
  document.documentElement.append(host);

  // Filled in a moment later, so screen readers announce it as a change.
  setTimeout(() => {
    text.textContent = message;
  }, 30);

  setTimeout(() => {
    note.classList.add("out");
    setTimeout(() => host.remove(), 250);
  }, duration);
}
