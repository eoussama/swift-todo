# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.2] - 2026-11-27

### Added

- **Several lines**: <kbd>Shift</kbd>+<kbd>Enter</kbd> starts a new line in a to-do, in the input, when editing in place and in the full view. Markdown and copied text keep the lines under the to-do.
- **Hold to see it all**: each to-do shows one line, cut short, with its date and marks still in view. Holding <kbd>Shift</kbd> over one, or on the one picked with the arrow keys, shows all of it, and the wheel still scrolls. The key can be Alt, Ctrl or none instead, in Settings › Appearance.
- **Nothing lost on closing**: closing the popup keeps the to-do being written, a to-do being edited, the dialog left open (and what was typed or picked in it), the settings, and list names being typed, until they're saved or closed. After more than five minutes away, it opens fresh.
- **Links**: hovering a to-do's link icon shows the address, and clicking it opens the page. Copy link sits under Copy text in the row menu, and beside the link in the full view.
- Each skin writes the progress bar with its own tool: a felt-tip marker on the sticky board, chalk on the chalkboard, a quill on the scroll and a ballpoint on Minimal.
- Toasts have a close button at their right end.
- **List tab menus**: right-click a list tab, or click the open one again, to mark all its to-dos as done, erase them all, or delete the list, after confirming. Done and erased ones can be undone.
- **Clickable chips**: a to-do's date opens Schedule, its repeat mark (naming the rule) opens Repeat, its Today chip goes to the Today tab, the pin unpins, and the not-synced mark syncs it.
- **See it whole**: a to-do cut short gets an arrow that opens it in place, and folds it back; left alone for a few seconds, it folds back by itself.
- One-time tips point out what's easy to miss: how to see a long to-do whole, the tabs' menus, and the row menu's key.
- **Add with details**: once something is written, a button joined to the add button (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>) opens the full form for it, with the date and repeat understood from the text, to add it from there.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> on a to-do copies its text.
- <kbd>Ctrl</kbd>+<kbd>.</kbd> opens the settings and <kbd>Ctrl</kbd>+<kbd>?</kbd> the shortcuts.
- Right-click a to-do for its menu, as from ⋯.
- Settings sections fold away from their titles (all but About), and stay folded on the device.

### Changed

- Editing a to-do in place uses as many lines as it shows, instead of squeezing it onto one, and a single click on its text starts it (hidden text still needs Enter or Edit).
- Hovering a row shows only its menu and drag handle; View and Edit show near its end, and Erase moved into the menu, along with Edit. Menu items name their keys.
- The keyboard shortcuts open in a dialog on click, grouped, and list the mouse's ways too. Tooltips and menu items with a shortcut show its keys.
- Dragging across a to-do's text selects it, rather than starting to edit.
- A to-do just added scrolls into view at the end of a long list.
- Links take a light tint of the accent on hover.
- Tabs with nothing left to do (empty, or all done) step back, muted.
- A list's icon field in settings says what it takes, an emoji, a symbol, or a letter or number, and shows a + while empty.

### Fixed

- Only one row menu opens at a time.
- A list made from the tabs no longer pulls the view or the focus away when another tab was picked, another name is being typed, or the settings opened while it saved.
- The ruled lines run across an empty page, behind its note.
- A quick second click on a toast (a double-click on Undo) no longer lands on the list behind it.

## [2.1.0] - 2026-11-22

### Added

- **Lists**: sort to-dos into lists, shown as tabs, with an "All" view. Lists are managed in settings (rename, add an emoji, reorder, delete), and to-dos move between them from the row menu.
- **Tags**: `#words` in a to-do become chips; clicking one shows only to-dos with that tag. Typing `#` suggests tags already in use.
- **Dates**: give a to-do a due date, with an optional time, by typing it ("call Sam tomorrow 3pm", "dentist next friday", "call back in 2 hours") or picking it from the row menu. A chip shows when it's due, in red once overdue.
- **Repeats**: to-dos can repeat every few minutes, hours, days, weeks or months, on weekdays, or on chosen days ("water plants every 3 days", "standup every weekday at 9am"). Checking one off moves it to its next date, keeping its time and its day of the month: one due on the 31st is back on the 31st after a shorter month.
- **Reminders**: optional notifications when to-dos are due (or up to an hour before), with Done and Snooze buttons in Chrome and Edge, a daily summary at a chosen time, and gentle nudges about overdue ones. The notifications permission is only requested when they're turned on.
- **Toolbar badge**: counts what's due today and overdue, or all open to-dos, or nothing.
- **Add from a page**: select text, right-click, and pick "Add to Swift TODO". Each line becomes a to-do, linked back to the page.
- **Export and import**: a JSON backup that can be imported again (adding to or replacing your to-dos), Markdown and CSV exports, and copying the current list as text.
- **Today**: a view of what's due or overdue, plus anything added to it from the row menu.
- **Focus mode**: one to-do at a time, with Done and Skip, and a focus timer that keeps running with the popup closed, counting down on the toolbar badge.
- **Skins**: Notepad, Sticky board, Chalkboard, Scroll, Minimal and Aurora, each in light and dark, with eight accent colors and a theme setting (system, light or dark). To-dos are written in each skin's own hand, and the accent leads highlights, hover, focus and selection.
- **View in full** (⋯ menu, a row button, or <kbd>V</kbd>): the whole to-do with nothing covering it, every detail, Copy, and an edit form for its text, date and time, repeat, list, link, Today, pin and hiding.
- **Pins**: pin a to-do to the top of its list (⋯ menu or <kbd>P</kbd>).
- **Hidden text**: hide a to-do's text, for passwords and secrets. It's scribbled over in the skin's style until revealed, and notifications say "A hidden to-do" instead. The text is still stored and synced as written, and kept in JSON backups; Markdown, CSV and copied text show it only as hidden.
- **Links**: give any to-do a link, and open it from the menu.
- **Repeat history**: each check-off of a repeating to-do is kept (the latest 30) and shown in its full view; it moves to the bottom when checked off, with Undo.
- **Copy** a to-do's text from its menu.
- **Settings**, in the popup: appearance, lists, reminders, focus, your data, and about.
- A row menu (⋯, or <kbd>M</kbd> on a row) for viewing, copying, pinning, scheduling, repeating, hiding, links, moving, Today and sync.
- Focus mode says so with a banner and a way back, remembers skipped to-dos, and takes a custom timer length.
- Every icon-only button has a tooltip.
- After "Add to Swift TODO", a short note on the page confirms it.
- The app's own dropdowns, date and time pickers, checkboxes and number steppers, in place of the browser's.
- The version shows at the bottom of the popup, linking to its release notes.

### Fixed

- The rounded Nunito font now shows in Chrome and Edge, which had been replacing it with the system font.
- Tag chips are readable in the dark theme.
- The shortcut to open the popup is now <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>. <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> is taken by Chrome and Edge, so it did nothing there.

### Changed

- New permissions, none of which shows a warning when the update installs: **context menus**, **active tab** and **scripting** for "Add to Swift TODO" (the selected text is read only when you pick it), and **notifications** as an optional permission, asked for only when reminders are turned on.
- The keyboard shortcuts list shows each action on the left and its keys on the right, as key caps.
- The keyboard shortcuts open on click as well as on hover, so they also work on touch screens.

## [2.0.0] - 2026-11-21

A full rewrite.

### Added

- Support for Edge and Firefox (140 or later), alongside Chrome.
- Sync across devices through the browser account, with no sign-up. Browser sync holds a few hundred to-dos; past that, new ones stay on the device and move to sync once there is room.
- A sync toggle on each to-do, to choose which ones stay synced when space runs short.
- Checking off to-dos, with a pencil that fills up as you go and a small celebration when everything is done.
- A "Done" section that collects checked to-dos, can be folded away, and erases them all at once.
- Reordering by drag and drop or with <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>.
- Undo after deleting or clearing to-dos.
- A trash on each device: erased to-dos can be restored or deleted for good, and are cleared after 30 days.
- Full keyboard control, and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> to open the popup.
- A dark theme that follows the system.
- A character counter near the 500-character limit.

### Changed

- New design, based on the extension icon: a ruled notepad on a desk, with a blueprint-style dark theme.
- To-dos are stored with the browser's extension storage instead of the popup's local storage.
- Built on Manifest V3, which Chrome requires.

### Removed

- The `activeTab` permission, which was never needed.
- Fonts and icons loaded from other websites; everything now ships with the extension.

## [1.1.1] - 2026-11-20

### Added

- Scrolling for long lists.

## [1.1.0] - 2018-05-22

First stable release, for Chrome.

[2.1.2]: https://github.com/eoussama/swift-todo/compare/v2.1.0...v2.1.2
[2.1.0]: https://github.com/eoussama/swift-todo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/eoussama/swift-todo/compare/v1.1.1...v2.0.0
[1.1.1]: https://github.com/eoussama/swift-todo/compare/1.1.0...v1.1.1
[1.1.0]: https://github.com/eoussama/swift-todo/releases/tag/1.1.0
