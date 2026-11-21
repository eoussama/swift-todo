# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-11-21

A full rewrite.

### Added

- Support for Edge and Firefox (140 or later), alongside Chrome.
- Sync across devices through the browser account, with no sign-up. Browser sync holds a few hundred to-dos; past that, new ones stay on the device and move to sync once there is room.
- A sync toggle on each to-do, to choose which ones stay synced when space runs short.
- Checking off to-dos, with a count of what's left and a button to clear the done ones.
- Reordering by drag and drop or with <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>.
- Undo after deleting or clearing to-dos.
- Full keyboard control, and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> to open the popup.
- A dark theme that follows the system.
- A character counter near the 500-character limit.

### Changed

- New design, based on the extension icon.
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

[2.0.0]: https://github.com/eoussama/swift-todo/compare/v1.1.1...v2.0.0
[1.1.1]: https://github.com/eoussama/swift-todo/compare/1.1.0...v1.1.1
[1.1.0]: https://github.com/eoussama/swift-todo/releases/tag/1.1.0
