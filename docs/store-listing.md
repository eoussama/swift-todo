# Store listing

Text and answers for the Chrome Web Store, Microsoft Edge Add-ons and Firefox Add-ons (AMO). Upload the zips from the GitHub release: `chrome` for Chrome, `edge` for Edge, and `firefox` plus `sources` for Firefox.

## Name

Swift TODO

## Summary

Chrome allows 132 characters, AMO 250.

> A quick to-do list in your browser toolbar. Add, check off and reorder to-dos in seconds, synced with your browser account.

## Description

> Swift TODO keeps a to-do list one click away. Click the toolbar icon (or press Alt+Shift+T), type, press Enter, and get back to what you were doing.
>
> • Add, edit, check off and reorder to-dos, by drag and drop or from the keyboard.
> • Undo a delete with one click, or Ctrl+Z.
> • Synced across your devices through your browser account. No sign-up, no servers, no tracking.
> • No limit on the number of to-dos. Browser sync holds a few hundred; past that, new to-dos stay on your device until you make room, and you choose which ones stay synced.
> • Fully usable from the keyboard and with screen readers.
> • Light and dark themes that follow your system.
>
> Swift TODO is free and open source: https://github.com/eoussama/swift-todo

## Category

- Chrome Web Store: Productivity → Tools
- Edge Add-ons: Productivity
- Firefox Add-ons: Other (tags: productivity, to-do, tasks)

## Single purpose (Chrome)

> Keep a short to-do list in the browser toolbar, synced through the browser account.

## Permission justifications (Chrome, Edge)

- **storage**: Saves the user's to-dos with the browser's extension storage, synced through their browser account.
- **alarms**: Finishes writing recent changes to sync shortly after the popup closes, while staying within the browser's sync rate limits.

No host permissions are requested, and the extension runs no remote code.

## Data usage (Chrome privacy practices)

- Collected data: none. To-dos stay in the browser's own storage and are synced by the browser, not sent to the developer.
- Certify all three statements: not sold to third parties, not used for unrelated purposes, not used for creditworthiness or lending.
- Privacy policy URL: https://github.com/eoussama/swift-todo/blob/master/PRIVACY.md

## Data collection (Firefox)

The manifest declares `data_collection_permissions: { required: ["none"] }`, so AMO shows that no data is collected.

## Notes for reviewers (Firefox)

> Built with WXT, Svelte and Tailwind CSS. To rebuild from the sources zip: install Node.js 24 and pnpm 12, run `pnpm install`, then `pnpm zip:firefox`. The output is in `.output/firefox-mv3`.
>
> The one `innerHTML` warning from the linter comes from Svelte's runtime, which builds its templates from static, compile-time strings. User text is only ever set as text.

## Screenshots

1280 × 800 for Chrome and Edge; AMO accepts any size. Suggested shots: the list with a few done to-dos (light), the same in dark, the sync toggle and capacity meter, and the keyboard shortcuts.
