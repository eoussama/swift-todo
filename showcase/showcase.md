# Swift TODO showcase

A tour of what Swift TODO does, with screenshots from the Chrome build. The popup is 380 pixels wide, the same size as in the browser.

- [Your list](#your-list)
- [Type it naturally](#type-it-naturally)
- [Lists and tags](#lists-and-tags)
- [To do, in progress and done](#to-do-in-progress-and-done)
- [Sorting](#sorting)
- [Attachments](#attachments)
- [Dates and repeats](#dates-and-repeats)
- [The row menu](#the-row-menu)
- [Today and focus mode](#today-and-focus-mode)
- [Reminders and the badge](#reminders-and-the-badge)
- [Skins](#skins)
- [Settings](#settings)
- [Keyboard shortcuts](#keyboard-shortcuts)

## Your list

Click the toolbar icon (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>), type, press <kbd>Enter</kbd> (<kbd>Shift</kbd>+<kbd>Enter</kbd> for another line). Each to-do takes one line, cut short when it's long, with its `#tags`, its due date (in red once it's overdue), a ↻ when it repeats, a paperclip when files are attached, and a link icon when it came from a web page. Every chip opens what changes it: the date opens Schedule, the ↻ Repeat, the paperclip the to-do in full. The arrow at a long to-do's end opens it in place, and holding <kbd>Shift</kbd> over it shows it whole while held. Click a to-do's text to edit it. The pencil at the top (a marker, chalk, a quill or a pen, depending on the skin) shows how much is done.

<p align="center">
  <img src="./overview.png" width="300" alt="The popup in the Notepad skin, with to-dos showing tags, due dates, an overdue date in red, repeats and a link to a page">
  <img src="./skin-notepad-dark.png" width="300" alt="The same list in the dark Notepad skin">
</p>

## Type it naturally

Dates and repeats can be typed with the to-do: "call Sam tomorrow 6pm", "water plants every 3 days", "standup every weekday at 9am". A chip under the input shows what was understood before you press <kbd>Enter</kbd>; its ✕ keeps the words as plain text instead. Typing `#` suggests the tags you already use.

<p align="center">
  <img src="./natural-language.png" width="300" alt="Typing “Call Sam tomorrow 6pm #trip”, with a “Tomorrow 6:00 PM” chip under the input">
</p>

## Lists and tags

Lists are tabs over the page: All, Today, Inbox, and your own, each with an optional emoji. **All** shows every to-do. **Inbox** holds the ones that aren't in one of your lists: what you add from All or Inbox, and what's left when you delete a list. When there are more tabs than fit, the tabs scroll sideways and fade at the edge. Click a `#tag` to see only the to-dos with that tag, across every list.

<p align="center">
  <img src="./list.png" width="300" alt="The Home list selected, showing only its to-dos">
  <img src="./tag-filter.png" width="300" alt="The list filtered to #home, with a “Showing #home” bar">
</p>

## To do, in progress and done

Every to-do is to do, in progress or done, and the list shows each in its own section, each folding away from its title. Press <kbd>I</kbd> on a to-do to start it (its box fills halfway), or pick a status from its menu or from the chip after its text. Add stages of your own under each status in Settings › Stages, like "Review" or "Waiting" under In progress, or "Shipped" under Done; they sync with your settings.

<p align="center">
  <img src="./statuses.png" width="300" alt="A to-do's Status menu: To do, In progress with its stages Waiting and Review, and Done, over the In progress and Done sections">
  <img src="./settings-stages.png" width="300" alt="Stage settings: stages of your own under To do, In progress and Done">
</p>

## Sorting

Each list (and All, Today and Inbox) sorts its own way, from its tab's menu: by hand (the default, dragged into place), newest or oldest first, by due date, or A to Z. The choice syncs. Right-click a tab, or click the open one again, for its menu, which also checks off or erases a whole list.

<p align="center">
  <img src="./sorting.png" width="300" alt="The All tab's menu with Sort by open: My order, Newest first, Oldest first, Due date, A to Z">
</p>

## Attachments

Paste a screenshot onto a to-do (<kbd>Ctrl</kbd>+<kbd>V</kbd>), drop files on it, or pick them from its menu. Pasted or dropped in the input, they're attached once the to-do is added. The full view lists them: pictures as thumbnails that open big and copy, every file to download or remove. Attachments stay on the device, not synced or exported, up to 10 MB each.

<p align="center">
  <img src="./attachments.png" width="300" alt="A to-do in full, In progress at the Waiting stage, with a route map and train tickets attached">
</p>

## Dates and repeats

**Schedule…** and **Repeat…** in a to-do's menu open these pickers. A repeating to-do moves to its next date when you check it off, and a toast says when that is.

<p align="center">
  <img src="./schedule.png" width="300" alt="The Schedule dialog with Today, Tomorrow and Next week shortcuts, a calendar and an optional time">
  <img src="./repeat.png" width="300" alt="The Repeat dialog with presets and custom intervals">
</p>

## The row menu

Hover a to-do and click ⋯, right-click it, or press <kbd>M</kbd> on it for its menu: view it in full, edit it (in place, or in full), set its status, copy its text or link, pin it to the top, schedule it, repeat it, hide its text, give it a link, attach a file, add it to Today, move it up, down or to another list, keep it on this device only, erase it, or show only the to-dos with one of its #tags. Each item names its key. **View in full** (or <kbd>V</kbd>) opens the whole to-do with nothing covering it, along with its details and attachments; **Edit in full** (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>, also from a to-do's own editor) opens its whole form, which helps with long ones. **Hide the text** is for passwords and other secrets: the to-do is scribbled over in the list, focus mode and the trash, and notifications say "A hidden to-do" instead, until you reveal it with its eye button. It hides again next time. The text is still stored and synced as written, and kept in JSON backups; Markdown, CSV and copied text show it only as hidden. Any to-do can carry a link (**Add a link…**, then **Open the link**). To-dos added from a web page get one by themselves: select text on any page, right-click and choose **Add to Swift TODO**, and each line becomes a to-do linked to that page.

<p align="center">
  <img src="./row-menu.png" width="300" alt="A to-do's menu: View in full, Edit, Edit in full, Status, Copy text, Pin to the top, Schedule, Repeat, Hide the text, Add a link, Attach a file, and more below">
</p>

## Today and focus mode

**Today** gathers what's due or overdue, plus anything you added to it yourself. Focus mode (◎ in the header) shows one to-do at a time, with Done, Skip and a focus timer. The timer keeps running with the popup closed: the toolbar badge counts down the minutes, and a notification says when it's over.

<p align="center">
  <img src="./today.png" width="300" alt="The Today tab, with to-dos due today, overdue or added to Today">
  <img src="./focus.png" width="300" alt="Focus mode showing one to-do in large handwriting, with Done and Skip buttons and a 25:00 timer">
</p>

## Reminders and the badge

These happen outside the popup, so they aren't pictured here:

- **Due reminders:** a notification at the due time, or up to an hour before. In Chrome and Edge it has **Done** and **Snooze 10 min** buttons. When several are due at once, they arrive as one summary.
- **Daily summary:** at a time you choose, how many to-dos are open, due today and overdue.
- **Overdue nudges:** at most every few hours, during the day.
- **Toolbar badge:** counts what's due today and overdue (or every open to-do), and turns red when something is overdue.

Notifications are optional; the browser asks for permission the first time you turn one on.

## Skins

Six skins, each in light and dark, with eight accent colors that lead every highlight, hover and focus. To-dos are written in each skin's own hand: pencil, marker, chalk, ink, or plain type. The theme follows your system unless you pick one.

| Sticky board | Chalkboard |
| :---: | :---: |
| <img src="./skin-sticky-light.png" width="260" alt="Sticky board skin, light: a yellow sticky note on a cork board"> <img src="./skin-sticky-dark.png" width="260" alt="Sticky board skin, dark"> | <img src="./skin-chalk-light.png" width="260" alt="Chalkboard skin, light: a green board in a wooden frame"> <img src="./skin-chalk-dark.png" width="260" alt="Chalkboard skin, dark"> |

| Scroll | Minimal |
| :---: | :---: |
| <img src="./skin-scroll-light.png" width="260" alt="Scroll skin, light: parchment between wooden rollers, with a serif font"> <img src="./skin-scroll-dark.png" width="260" alt="Scroll skin, dark"> | <img src="./skin-minimal-light.png" width="260" alt="Minimal skin, light: flat, with the system font"> <img src="./skin-minimal-dark.png" width="260" alt="Minimal skin, dark"> |

| Aurora | |
| :---: | :---: |
| <img src="./skin-aurora-light.png" width="260" alt="Aurora skin, light: a clean rounded card over a soft glow in the accent color"> <img src="./skin-aurora-dark.png" width="260" alt="Aurora skin, dark: the glow on a night-sky desk"> | |

## Settings

The gear in the header (or <kbd>Ctrl</kbd>+<kbd>.</kbd>) opens the settings, inside the popup. Each section folds away from its title.

- **Appearance:** skin, accent color and theme, with live previews, and the key held to see a long to-do whole.
- **Lists:** rename, add an emoji (or a symbol, letter or number), reorder and delete lists. A deleted list's to-dos go back to the Inbox.
- **Stages:** your own stages under To do, In progress and Done.
- **Reminders:** notifications, the daily summary, nudges and the toolbar badge.
- **Focus:** the timer length.
- **About:** the version, release notes and source code.
- **Your data:** export a JSON backup, Markdown or CSV, copy as text, and import a backup (added to your to-dos or replacing them; replaced ones go to the trash).

<p align="center">
  <img src="./settings-appearance.png" width="300" alt="Appearance settings with skin previews, accent colors and theme">
  <img src="./settings-lists.png" width="300" alt="List settings with emoji, name, move and delete controls">
</p>
<p align="center">
  <img src="./settings-reminders.png" width="300" alt="Reminder settings: due reminders, daily summary, nudges, toolbar badge and focus timer length">
  <img src="./settings-data.png" width="300" alt="Data settings: export buttons and backup import">
</p>

## Keyboard shortcuts

Everything works from the keyboard. The keyboard icon at the bottom (or <kbd>Ctrl</kbd>+<kbd>?</kbd>) lists the shortcuts, grouped, along with what the mouse does.

<p align="center">
  <img src="./shortcuts.png" width="300" alt="The keyboard shortcuts, grouped: writing, moving around, and on a to-do, from checking it off and starting it to attaching what's copied">
</p>

---

The screenshots are generated by `pnpm showcase`, which builds the extension, fills it with sample to-dos and saves the images in this folder. Dates in them are relative to the day they were taken.
