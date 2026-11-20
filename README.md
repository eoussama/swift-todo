<p align="center">
  <img width="100" src="./assets/logo.png" alt="Swift TODO logo">
</p>

<h1 align="center">Swift TODO</h1>
<p align="center">A quick to-do list in your browser toolbar, synced with your browser account.</p>

<p align="center">
    <a href="https://github.com/eoussama/swift-todo/releases" target="_blank"><img src="https://img.shields.io/github/v/tag/eoussama/swift-todo" alt="Latest tag" /></a>
    <a href="https://github.com/eoussama/swift-todo/blob/master/LICENSE" target="_blank"><img src="https://img.shields.io/github/license/eoussama/swift-todo" alt="License" /></a>
    <img src="https://img.shields.io/github/languages/code-size/eoussama/swift-todo" alt="Code size" />
</p>

## Description

Swift TODO is a browser extension for jotting down things to do on the fly. Click the toolbar icon (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>), type, press <kbd>Enter</kbd>, and get back to what you were doing.

- Add, edit, check off, reorder and delete to-dos, with undo.
- Synced across your devices through your browser account, with no sign-up and no server of ours.
- No limit on the number of to-dos. Browser sync holds a few hundred; past that, new to-dos are kept on the device, and you choose which ones stay synced. When sync isn't available, everything is kept on the device.
- Fully usable from the keyboard, with a light and dark theme that follows your system.

Works in **Chrome**, **Edge** and **Firefox** (140 or later).

## Installation

Store listings for version 2 are on the way. Until then, download the zip for your browser from the [latest release](https://github.com/eoussama/swift-todo/releases) and load it:

- **Chrome / Edge**: unzip it, open `chrome://extensions` (or `edge://extensions`), turn on *Developer mode*, then click *Load unpacked* and pick the unzipped folder.
- **Firefox**: open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on…* and pick the zip.

## Development

Requires Node.js 24 or later and pnpm 12.

```bash
git clone https://github.com/eoussama/swift-todo.git
cd swift-todo
pnpm install
pnpm dev            # Chrome, with hot reload
pnpm dev:edge       # Edge
pnpm dev:firefox    # Firefox
```

### Scripts

- `pnpm check` – Run every check: dependency audit, lint, type check, tests with coverage thresholds, builds for all browsers and Mozilla's add-on linter
- `pnpm build` / `build:edge` / `build:firefox` / `build:all` – Build the extension into `.output/`
- `pnpm zip` / `zip:edge` / `zip:firefox` / `zip:all` – Build and package store-ready zips
- `pnpm lint` – Lint the codebase with [@eoussama/dx](https://github.com/eoussama/dx)
- `pnpm fix` – Lint and auto-fix issues
- `pnpm lint:firefox` – Run Mozilla's add-on linter on the Firefox build
- `pnpm typecheck` – Type check the codebase, Svelte components included
- `pnpm test` – Run the unit tests (`test:coverage` for a coverage report)
- `pnpm test:e2e` – Run the end-to-end tests against the built Chrome extension

### Stack

[WXT](https://wxt.dev), [Svelte 5](https://svelte.dev), [Tailwind CSS 4](https://tailwindcss.com), [shadcn-svelte](https://shadcn-svelte.com) on [Bits UI](https://bits-ui.com), [@eoussama/core](https://github.com/eoussama/core), [Vitest](https://vitest.dev) and [Playwright](https://playwright.dev).

## Contributing

Contributions are welcome. Please read the [contributing guidelines](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md) first, and report security issues as described in the [security policy](SECURITY.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
