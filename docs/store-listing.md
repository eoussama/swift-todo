# Store listing

Text and answers for the Chrome Web Store, Microsoft Edge Add-ons and Firefox Add-ons (AMO). Upload the zips from the GitHub release: `chrome` for Chrome, `edge` for Edge, and `firefox` plus `sources` for Firefox.

## Name

Swift TODO

## Summary

Chrome allows 132 characters, AMO 250.

> A quick to-do list in your browser toolbar. Add, check off and reorder to-dos in seconds, synced with your browser account.

## Description

> Swift TODO keeps a to-do list one click away. Click the toolbar icon (or press Alt+Shift+L), type, press Enter, and get back to what you were doing.
>
> • Add, edit, check off and reorder to-dos, by drag and drop or from the keyboard.
> • To do, in progress and done, each in its own section, with stages of your own (like "Review" or "Waiting").
> • Sort them into lists and tag them with #words. Sort each list your way: by hand, newest, oldest, due date or A to Z.
> • Paste a screenshot or drop files on a to-do. Attachments stay on your device.
> • Type dates and repeats naturally: "call Sam tomorrow 3pm", "water plants every 3 days".
> • Optional reminders, a daily summary, and a toolbar badge for what's due.
> • A Today view, and a focus mode with a timer.
> • Right-click selected text on any page to add it, with a link back.
> • Export to JSON, Markdown or CSV, and import a backup.
> • Six skins (Notepad, Sticky board, Chalkboard, Scroll, Minimal, Aurora), light and dark, with accent colors.
> • Undo a delete with one click, or Ctrl+Z.
> • Synced across your devices through your browser account. No sign-up, no servers, no tracking.
> • No limit on the number of to-dos. Browser sync holds a few hundred; past that, new to-dos stay on your device until you make room, and you choose which ones stay synced.
> • Fully usable from the keyboard and with screen readers.
>
> Swift TODO is free and open source: https://to.ouss.es/swift-todo/source
> If it saves you time, you can leave a tip: https://to.ouss.es/tip

## Store pages

| Store | Link |
| --- | --- |
| Chrome Web Store | https://to.ouss.es/swift-todo/chrome |
| Microsoft Edge Add-ons | https://to.ouss.es/swift-todo/edge |
| Firefox Add-ons | https://to.ouss.es/swift-todo/firefox |

Everything links to the short links, which the redirector counts; a store page that changes is updated there alone. The website's buttons and its structured data take them from [`site/stores.json`](../site/stores.json), as in nitfree and kol-pt; a store left as `""` there sends its buttons to the GitHub release instead.

## Website and trailer

- Website (Chrome's and Edge's "Official URL" or "Website", AMO's "Homepage"): https://swift-todo.ouss.es
- Support (AMO's "Support site"): https://to.ouss.es/swift-todo/support
- Tips (AMO's "Contributions URL", which adds a "Support this developer" button; Chrome and Edge have no such field, so it's at the end of the description): https://to.ouss.es/tip
- Promo video (Chrome and Edge only accept a YouTube link, so not the short one): https://youtu.be/Hq2HmWK0GEY
- Trailer link to share anywhere else: https://to.ouss.es/swift-todo/trailer

## Category

- Chrome Web Store: Productivity → Workflow & Planning
- Edge Add-ons: Productivity
- Firefox Add-ons: Other (tags: productivity, to-do, tasks)

## Single purpose (Chrome)

> Keep a short to-do list in the browser toolbar, synced through the browser account.

## Permission justifications (Chrome, Edge)

- **storage**: Saves the user's to-dos with the browser's extension storage, synced through their browser account.
- **alarms**: Finishes writing recent changes to sync shortly after the popup closes, while staying within the browser's sync rate limits; wakes up for due reminders, the daily summary and the focus timer.
- **contextMenus**: Adds "Add to Swift TODO" to the right-click menu on selected text.
- **activeTab** and **scripting**: When the user picks "Add to Swift TODO", reads the selected text on that tab (with its line breaks, so each line becomes a to-do). Nothing runs on pages otherwise.
- **notifications** (optional): Requested only when the user turns reminders on, to show due reminders, the daily summary and the end of a focus timer.

No host permissions are requested, and the extension runs no remote code.

## Data usage (Chrome privacy practices)

- Collected data: none. To-dos stay in the browser's own storage and are synced by the browser, not sent to the developer.
- Certify all three statements: not sold to third parties, not used for unrelated purposes, not used for creditworthiness or lending.
- Privacy policy URL: https://swift-todo.ouss.es/privacy/ (the same text as [PRIVACY.md](../PRIVACY.md), which the page is built from)

## Data collection (Firefox)

The manifest declares `data_collection_permissions: { required: ["none"] }`, so AMO shows that no data is collected.

## Notes for reviewers (Firefox)

> Built with WXT, Svelte and Tailwind CSS. To rebuild from the sources zip: install Node.js 24 and pnpm 12, run `pnpm install`, then `pnpm zip:firefox`. The output is in `.output/firefox-mv3`.
>
> The add-on has no `innerHTML` assignments, and the linter reports no warnings: Svelte is set to build the DOM node by node (`fragments: "tree"`), and the drag-and-drop library's one `innerHTML = ""` is replaced with `textContent = ""` at build time (both in `wxt.config.ts`). User text is only ever set as text.

## Screenshots

Five 1280 × 800 screenshots, the icons, the promo tiles and the trailer for all three stores are in [branding/](../branding/README.md), with a table of which file goes where.
