<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import type { TList } from "@/lib/todos/lists";
  import type { TTodo } from "@/lib/todos/model";

  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CloudExclamationIcon from "@lucide/svelte/icons/cloud-exclamation-point";
  import CloudOffIcon from "@lucide/svelte/icons/cloud-off";
  import CloudUploadIcon from "@lucide/svelte/icons/cloud-upload";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
  import LinkIcon from "@lucide/svelte/icons/link";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import PaperclipIcon from "@lucide/svelte/icons/paperclip";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PinIcon from "@lucide/svelte/icons/pin";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import SquarePenIcon from "@lucide/svelte/icons/square-pen";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { onMount, tick } from "svelte";
  import { dragHandle } from "svelte-dnd-action";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";
  import { filesToAttach } from "@/lib/attachments/attachments";
  import { attachments } from "@/lib/attachments/attachments.svelte";
  import { autosize } from "@/lib/autosize";

  import { Button } from "@/lib/components/ui/button";
  import { Checkbox } from "@/lib/components/ui/checkbox";
  import { readTodoDraft, saveDraft, textOf } from "@/lib/drafts.svelte";
  import { hints } from "@/lib/hints.svelte";
  import { oneLine } from "@/lib/messages";
  import { formatDue, formatRule } from "@/lib/time/format";
  import { isPinnedToday } from "@/lib/time/today";
  import { toast } from "@/lib/toast";
  import { TODO_LIMITS } from "@/lib/todos/limits";
  import { syncStateOf } from "@/lib/todos/model";
  import { segmentText } from "@/lib/todos/tags";
  import { mergeProps } from "@/lib/utils";

  import { attachFiles } from "./Attachments.svelte";
  import RowMenu from "./RowMenu.svelte";
  import Scribble from "./Scribble.svelte";
  import Tip from "./Tip.svelte";



  type Props = {
    todo: TTodo & { isDndShadowItem?: boolean };
    /** False when sync is off in this browser. */
    syncAvailable: boolean;
    lists: ReadonlyArray<TList>;
    /** True inside the drag-and-drop zone, which adds a drag handle. */
    draggable: boolean;
    /** 0 for the row that holds the list's tab stop, -1 for the others. */
    tabindex: 0 | -1;
    onfocus: () => void;
    ontoggle: () => void;
    onsave: (text: string) => void;
    onremove: () => void;
    onsync: (synced: boolean) => void;
    onmoveto: (list: string | null) => void;
    onschedule: () => void;
    /** Opens the whole to-do in a dialog. */
    onview: () => void;
    /** Edits it all in the full form, with the text typed in its own editor so far, if any. */
    oneditfull: (text?: string) => void;
    /** Adds, changes or removes the link. */
    onlink: () => void;
    onrepeat: () => void;
    ontoday: (pinned: boolean) => void;
    onhidden: (hidden: boolean) => void;
    onpinned: (pinned: boolean) => void;
    /** Opens the Today tab, from the "Today" chip. */
    onshowtoday: () => void;
    /** The current moment, so due labels stay fresh. */
    now: Date;
    /** Filters the list by a tag clicked in the text. */
    ontag: (tag: string) => void;
    /** Moves it one place up or down; left out in a sorted list, where the sort decides. */
    onmove?: (delta: -1 | 1) => void;
    onnavigate: (target: "previous" | "next" | "first" | "last") => void;
  };

  const {
    todo,
    syncAvailable,
    lists,
    draggable,
    tabindex,
    onfocus,
    ontoggle,
    onsave,
    onremove,
    onsync,
    onmoveto,
    onschedule,
    onview,
    oneditfull,
    onlink,
    onrepeat,
    ontoday,
    onhidden,
    onpinned,
    onshowtoday,
    now,
    ontag,
    onmove,
    onnavigate,
  }: Props = $props();

  let menuOpen = $state(false);
  // The pointer at the row's end, over its menu and handle, where View and Edit then show too.
  const NEAR_END = 64;
  let nearEnd = $state(false);

  // The line's end makes room for the buttons showing over it (less their fade), or keeps its margin.
  let hovered = $state(false);
  let keyboardFocus = $state(false);
  let actionsWidth = $state(0);
  const LINE_END = 12;
  const endRoom = $derived(hovered || keyboardFocus || menuOpen ? Math.max(LINE_END, actionsWidth - 12) : LINE_END);

  // Cut short to one line, the text gets a chevron chip that opens it up in place, and folds it back.
  let textEl = $state<HTMLElement | null>(null);
  let truncated = $state(false);
  let expanded = $state(false);

  $effect(() => {
    const element = textEl;

    // Measured again when the text changes, or the line's width does.
    void todo.text;

    if (element === null || expanded) {
      return;
    }

    const measure = (): void => {
      // Only on one line: held open (the peek key), the text flows inline and can't be cut short.
      if (getComputedStyle(element).display !== "inline") {
        truncated = element.scrollWidth > element.clientWidth + 1;
      }
    };
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(element);

    return () => observer.disconnect();
  });
  const segments = $derived(segmentText(todo.text));
  // A hidden to-do shows dots until revealed; it hides again next time the popup opens.
  let revealed = $state(false);
  const concealed = $derived(todo.hidden && !revealed);

  // The first to-do cut short brings a tip about seeing it whole.
  $effect(() => {
    if (truncated && !concealed) {
      hints.want("long");
    }
  });

  // Shown again, then hidden again later: it starts hidden, not still revealed.
  $effect.pre(() => {
    if (!todo.hidden) {
      revealed = false;
    }
  });

  // The list finds rows through `data-todo-row`; element bindings go stale when the keyed list reorders.
  let row = $state<HTMLElement | null>(null);
  let editing = $state(false);

  // Right-clicked, the menu opens at the pointer instead of at its ⋯ button.
  let menuAnchor = $state<{ getBoundingClientRect: () => DOMRect } | null>(null);

  // Closed, it opens at its button again next time.
  $effect(() => {
    if (!menuOpen) {
      menuAnchor = null;
    }
  });

  function oncontextmenu(event: MouseEvent): void {
    // The browser's own menu stays for the editor and for selected text (to copy it).
    if (editing || !(window.getSelection()?.isCollapsed ?? true)) {
      return;
    }

    event.preventDefault();

    const { clientX: x, clientY: y } = event;

    menuAnchor = { getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) };
    menuOpen = true;
  }
  let draft = $state("");
  let editor = $state<HTMLTextAreaElement | null>(null);
  // The text being edited, measured so the editor opens at least as tall as it was.
  let paragraph = $state<HTMLElement | null>(null);
  let editorMin = $state(0);

  // Opened from its arrow, a to-do folds back by itself a few seconds after it's left alone:
  // not while the pointer is over it, it has the keyboard focus, or it's being edited or its menu is open.
  const FOLD_AFTER_MS = 4_000;

  $effect(() => {
    if (!expanded || hovered || keyboardFocus || editing || menuOpen) {
      return;
    }

    const timer = setTimeout(() => (expanded = false), FOLD_AFTER_MS);

    return () => clearTimeout(timer);
  });

  const syncState = $derived(syncStateOf(todo, syncAvailable));

  const syncIcons = {
    synced: CloudIcon,
    pending: CloudUploadIcon,
    waiting: CloudExclamationIcon,
    kept: CloudOffIcon,
    unavailable: HardDriveIcon,
  };

  const SyncIcon = $derived(syncIcons[syncState]);

  const dueLabel = $derived(todo.due === null ? null : formatDue(todo.due, now));
  const repeatLabel = $derived(todo.repeat === null ? "" : formatRule(todo.repeat));
  // Added to Today (or added on the Today tab): a "Today" chip, unless the due date already says today or overdue.
  const pinnedToday = $derived(isPinnedToday(todo, now));
  const todayPinned = $derived(!todo.done && pinnedToday && !(dueLabel?.soon ?? false));

  // "Text, not done, due Tomorrow, repeats Every day, synced": the state part gathers the details.
  // Files attached on this device; a paperclip after the text says how many, and opens them.
  const fileCount = $derived(attachments.of(todo.id).length);
  // Files dragged over the row, to drop on it.
  let dropping = $state(false);

  const details = $derived([
    i18n.t(todo.done ? "item.state.done" : "item.state.open"),
    ...(dueLabel === null ? [] : [i18n.t(dueLabel.overdue && !todo.done ? "due.overdue" : "due.label", [dueLabel.label])]),
    ...(repeatLabel === "" ? [] : [i18n.t("item.repeats", [repeatLabel])]),
    ...(todayPinned ? [i18n.t("item.pinnedToday")] : []),
    ...(todo.pinned ? [i18n.t("item.pinned")] : []),
    ...(todo.source === null ? [] : [i18n.t("item.from", [todo.source.title ?? new URL(todo.source.url).hostname])]),
    ...(fileCount === 0 ? [] : [i18n.t("attach.chip", fileCount)]),
  ].join(", "));

  const label = $derived(i18n.t("item.label", [concealed ? i18n.t("item.hidden") : oneLine(todo.text), details, i18n.t(`item.syncShort.${syncState}`)]));

  async function startEdit(): Promise<void> {
    await openEditor(todo.text);
  }

  async function openEditor(text: string): Promise<void> {
    // Editing shows the text, so a hidden one counts as revealed.
    revealed = true;
    draft = text;
    // Chips and tag pills take room on the line that the editor doesn't, so the text can wrap a
    // line shorter there; it keeps the row's height (less its 7px margins) rather than jump.
    editorMin = paragraph === null ? 0 : paragraph.offsetHeight - 14;
    editing = true;
    await tick();
    editor?.focus();
    editor?.setSelectionRange(draft.length, draft.length);
  }

  function commit(refocus: boolean): void {
    if (!editing) {
      return;
    }

    editing = false;
    saveDraft("row", null);

    // A blank edit is dropped rather than refused; erasing is one key away.
    if (draft.trim().length > 0 && draft.trim() !== todo.text) {
      onsave(draft);
    }

    if (refocus) {
      row?.focus();
    }
  }

  function cancel(): void {
    editing = false;
    saveDraft("row", null);
    row?.focus();
  }

  // An edit left open when the popup closed is kept, and picked up again here.
  $effect(() => {
    if (editing) {
      saveDraft("row", { id: todo.id, text: draft });
    }
  });

  onMount(() => {
    const saved = readTodoDraft("row");

    if (saved?.id === todo.id) {
      void openEditor(textOf(saved.fields, "text", todo.text));
    }
  });

  // Ctrl+C (Cmd+C) on the row copies its text, as the menu's Copy text does.
  async function copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(todo.text);
      toast.success(i18n.t("menu.copied"));
    }
    catch {
      toast.error(i18n.t("errors.unknown"));
    }
  }

  function toggleSync(): void {
    onsync(syncState === "kept" || syncState === "waiting");
  }

  // From the row's own editor to the full form, taking what's typed along (saved there, or not at all).
  function editFull(): void {
    const text = draft;

    editing = false;
    saveDraft("row", null);
    oneditfull(text);
  }

  function onEditorKeydown(event: KeyboardEvent): void {
    // Enter saves; Shift+Enter starts a new line; Ctrl+Enter goes on in the full form.
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault();
      editFull();
    }
    else if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      commit(true);
    }
    else if (event.key === "Escape") {
      // Keep Escape from closing the popup.
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  }

  function onRowKeydown(event: KeyboardEvent): void {
    if (event.target !== row) {
      return;
    }

    const key = event.key;
    let handled = true;

    if (event.altKey && (key === "ArrowUp" || key === "ArrowDown")) {
      onmove?.(key === "ArrowUp" ? -1 : 1);
    }
    else if (key === "ArrowUp") {
      onnavigate("previous");
    }
    else if (key === "ArrowDown") {
      onnavigate("next");
    }
    else if (key === "Home") {
      onnavigate("first");
    }
    else if (key === "End") {
      onnavigate("last");
    }
    else if (key === " ") {
      ontoggle();
    }
    else if (key === "Enter" && (event.ctrlKey || event.metaKey)) {
      oneditfull();
    }
    else if (key === "Enter" || key === "F2") {
      void startEdit();
    }
    else if (key === "Delete" || key === "Backspace") {
      onremove();
    }
    else if ((key === "c" || key === "C") && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      void copyText();
    }
    else if ((key === "s" || key === "S") && !event.ctrlKey && !event.metaKey && syncAvailable) {
      toggleSync();
    }
    else if ((key === "m" || key === "M") && !event.ctrlKey && !event.metaKey) {
      menuAnchor = null;
      menuOpen = true;
    }
    else if ((key === "v" || key === "V") && !event.ctrlKey && !event.metaKey) {
      onview();
    }
    else if ((key === "p" || key === "P") && !event.ctrlKey && !event.metaKey) {
      onpinned(!todo.pinned);
    }
    else {
      handled = false;
    }

    if (handled) {
      event.preventDefault();
    }
  }
</script>

<!-- A chip or mark on the line: a small button that opens what changes it, named in its tooltip. -->
{#snippet chip(label: string, action: () => void, content: Snippet, className: ClassValue, kind: string, shortcut?: string)}
  <Tip {label} {shortcut}>
    {#snippet children(tip)}
      <button
        {...mergeProps(tip, {
          onclick: (event: MouseEvent) => {
            // Not an edit of the text it sits in.
            event.stopPropagation();
            action();
          },
        })}
        type="button"
        tabindex={-1}
        class={["inline-flex h-[18px] items-center rounded-full align-[1px] font-sans text-[11.5px] leading-[18px] font-extrabold hover:brightness-95 hover:ring-2 hover:ring-(--tag)", className]}
        aria-label={label}
        data-chip={kind}
      >
        {@render content()}
      </button>
    {/snippet}
  </Tip>
{/snippet}

{#snippet moreChip()}
  {#if expanded}<ChevronUpIcon class="size-3.5" aria-hidden="true" />{:else}<ChevronDownIcon class="size-3.5" aria-hidden="true" />{/if}
{/snippet}

{#snippet pinChip()}
  <PinIcon class="size-3.5 rotate-45" data-pin aria-hidden="true" />
{/snippet}

{#snippet dueChip()}
  <CalendarIcon class="size-3" aria-hidden="true" />{dueLabel?.label}
{/snippet}

{#snippet repeatChip()}
  <RepeatIcon class="size-3" aria-hidden="true" />
{/snippet}

{#snippet todayChip()}
  <SunIcon class="size-3" aria-hidden="true" />{i18n.t("due.today")}
{/snippet}

{#snippet filesChip()}
  <PaperclipIcon class="size-3" aria-hidden="true" />{fileCount}
{/snippet}

{#snippet syncChip()}
  <SyncIcon class="size-3.5" aria-hidden="true" />
{/snippet}

<!--
  One ruled line of the sheet: the checkbox sits in the margin, the text on the line.
  The row is the list's roving focus stop: one tab stop for the whole list, arrow
  keys between rows, and shortcuts (listed in aria-keyshortcuts) for the actions.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={row}
  data-todo-row
  role="group"
  aria-label={label}
  aria-keyshortcuts="Space Enter Control+Enter F2 Delete Backspace Home End Alt+ArrowUp Alt+ArrowDown Control+C Control+V S M V P"
  {tabindex}
  data-todo-id={todo.id}
  data-open={expanded ? "" : undefined}
  class={[
    // --row-bg is opaque, so the floating actions can fade into it.
    "group/row margin-line relative flex min-h-11 items-start border-b border-rule bg-(--row-bg) outline-none [--row-bg:var(--sheet)]",
    "transition-colors hover:[--row-bg:var(--row-hover)]",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border focus-visible:outline-solid focus-visible:[--row-bg:var(--row-focus)]",
    "animate-in fade-in-0 slide-in-from-top-1 duration-200",
    todo.isDndShadowItem && "opacity-70 [--row-bg:var(--row-focus)]! [&>*]:invisible",
    dropping && "outline-2 -outline-offset-2 outline-primary outline-dashed [--row-bg:var(--row-focus)]",
  ]}
  {onfocus}
  onkeydown={onRowKeydown}
  onpointermove={(event) => {
    if (row === null) {
      return;
    }

    // They show near the row's end; once shown, they stay until the pointer heads back left past
    // the arrow before them (or past them, without one), so it can reach the arrow without a chase.
    // (Opened, the arrow sits at the text's end instead, and doesn't count.)
    const more = expanded ? undefined : row.querySelector("[data-chip=more]")?.getBoundingClientRect().left;
    const buttons = row.querySelector("[data-near-actions]")?.getBoundingClientRect().left;
    const keepFrom = Math.min(more ?? Infinity, buttons ?? Infinity);

    nearEnd = event.clientX >= (nearEnd && keepFrom !== Infinity ? keepFrom - 4 : row.getBoundingClientRect().right - NEAR_END);
  }}
  {oncontextmenu}
  onpaste={(event: ClipboardEvent) => {
    // Ctrl+V on the row attaches what's copied, when that's files (a screenshot, say).
    const files = filesToAttach(event.clipboardData);

    if (event.target === row && files.length > 0) {
      event.preventDefault();
      void attachFiles(todo.id, files);
    }
  }}
  ondragover={(event: DragEvent) => {
    if (event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
      dropping = true;
    }
  }}
  ondragleave={(event: DragEvent) => {
    if (!row?.contains(event.relatedTarget as Node | null)) {
      dropping = false;
    }
  }}
  ondrop={(event: DragEvent) => {
    dropping = false;

    const files = filesToAttach(event.dataTransfer);

    if (files.length > 0) {
      event.preventDefault();
      void attachFiles(todo.id, files);
    }
  }}
  data-dropping={dropping ? "" : undefined}
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => {
    nearEnd = false;
    hovered = false;
  }}
  onfocusin={() => (keyboardFocus = row?.matches(":focus-visible, :has(:focus-visible)") ?? false)}
  onfocusout={() => (keyboardFocus = false)}
>
  <div class="flex w-10 shrink-0 justify-center pt-[11px]">
    <Checkbox
      checked={todo.done}
      onCheckedChange={() => ontoggle()}
      aria-label={i18n.t("item.done")}
      tabindex={-1}
    />
  </div>

  {#if editing}
    <!--
      Lined up with the text it replaces (same font, line height and wrap width), and as tall
      as all of it: margin, border and padding add up to the text's 11px above and below.
    -->
    <textarea
      bind:this={editor}
      bind:value={draft}
      use:autosize={draft}
      rows={1}
      style:min-height="{editorMin}px"
      class="mx-0.5 my-[7px] block min-w-0 flex-1 resize-none overflow-hidden rounded-md border-2 border-border bg-sheet px-2 py-[2px] text-[length:calc(14.5px*1.08)] leading-[22px] written whitespace-pre-wrap outline-none [overflow-wrap:anywhere] focus-visible:focus-ring"
      maxlength={TODO_LIMITS.maxTextLength}
      aria-label={i18n.t("item.editLabel")}
      onkeydown={onEditorKeydown}
      onblur={() => {
        // Clicking elsewhere saves; the popup closing (or another window taking the focus) leaves it open.
        if (document.hasFocus()) {
          commit(false);
        }
      }}
    ></textarea>
    <!-- Kept from taking the focus, which would save the edit and take the button away before its click. -->
    <Button
      variant="ghost"
      size="icon-xs"
      class="mt-[8px] mr-1 shrink-0 text-muted-foreground"
      tooltip={i18n.t("item.editFull")}
      shortcut="Ctrl+Enter"
      aria-label={i18n.t("item.editFull")}
      onmousedown={(event: MouseEvent) => event.preventDefault()}
      onclick={editFull}
    >
      <SquarePenIcon />
    </Button>
  {:else}
    <!--
      Click to edit (unless the text is hidden); keyboard users press Enter or F2 on the row. The line is set in the
      to-do's own hand, so every line is 22px tall, as in the editor; chips set their own font.
      It shows one line, cut short, until the peek key is held over it (`data-todo-line` in app.css).
      Its end makes room for the row's buttons as they show, so they never cover a chip: the arrow
      at its far end slides along.
    -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <p bind:this={paragraph} data-todo-line class={["min-w-0 flex-1 py-[11px] pl-3 text-[length:calc(14.5px*1.08)] leading-[22px] written transition-[padding] duration-200 ease-out [overflow-wrap:anywhere]", !concealed && "cursor-text"]} style:padding-right="{endRoom}px" onclick={() => {
      // Hidden text stays hidden from a stray click; Enter, F2 or the Edit button still edit it.
      // Dragging across the text selects it (to copy, say) rather than editing.
      if (!concealed && (window.getSelection()?.isCollapsed ?? true)) {
        void startEdit();
      }
    }}>
      {#if todo.pinned}
        {@render chip(i18n.t("menu.unpin"), () => onpinned(false), pinChip, "mr-0.5 first:-ml-1 size-5 justify-center text-muted-foreground", "pin", "P")}
      {/if}
      {#if todo.source !== null}
        {@const url = todo.source.url}
        <!-- Ahead of the text, clear of the buttons that cover the row's end on hover: the link's
             address on hover (unless the text is hidden), and a click opens it. -->
        <Tip label={concealed ? i18n.t("menu.openSource") : url} class="break-all">
          {#snippet children(tip)}
            <button
              {...mergeProps(tip, {
                onclick: (event: MouseEvent) => {
                  event.stopPropagation();
                  void browser.tabs.create({ url });
                },
              })}
              type="button"
              tabindex={-1}
              class="mr-0.5 inline-flex size-5 first:-ml-1 items-center justify-center rounded-sm align-[-4px] text-muted-foreground hover:bg-(--tag) hover:text-foreground"
              aria-label="{i18n.t("menu.openSource")} ({i18n.t("link.newTab")})"
              data-link
            >
              <LinkIcon class="size-3.5" />
            </button>
          {/snippet}
        </Tip>
      {/if}
      <span
        bind:this={textEl}
        class={["pencil-strike", todo.done && "text-muted-foreground"]}
        data-todo-text
        data-done={todo.done ? "" : undefined}
      >{#if concealed}<span data-hidden-text><Scribble /></span>{:else}{#each segments as segment, i (i)}{#if segment.kind === "tag"}<button
        type="button"
        tabindex={-1}
        class="mx-px rounded-full bg-(--tag) px-1.5 font-sans text-[12.5px] leading-[18px] font-extrabold text-foreground no-underline hover:bg-(--tag-hover)"
        aria-label={i18n.t("tags.chip", [segment.tag])}
        onclick={(event) => {
          event.stopPropagation();
          ontag(segment.tag);
        }}
      >{segment.value}</button>{:else}{segment.value}{/if}{/each}{/if}</span>
      <!-- After the text, its details as chips; each opens what changes it. -->
      {#if dueLabel !== null}
        {@render chip(
          i18n.t("item.changeDate"),
          onschedule,
          dueChip,
          ["ml-1 gap-1 px-1.5", dueLabel.overdue && !todo.done ? "bg-destructive-soft text-destructive" : dueLabel.soon && !todo.done ? "bg-(--row-focus)" : "bg-muted text-muted-foreground"],
          "due",
        )}
      {/if}
      {#if repeatLabel !== ""}
        {@render chip(repeatLabel, onrepeat, repeatChip, "ml-1 size-[18px] justify-center bg-muted text-muted-foreground", "repeat")}
      {/if}
      {#if todayPinned}
        {@render chip(i18n.t("item.showToday"), onshowtoday, todayChip, "ml-1 gap-1 bg-(--row-focus) px-1.5", "today")}
      {/if}
      {#if syncState === "waiting" || syncState === "kept"}
        <!-- Not synced: a mark after the text, so it shows without hovering. Kept on the device, a
             click syncs it; waiting for room, it opens the full view, which says why. -->
        {@render chip(
          syncState === "kept" ? i18n.t("menu.syncIt") : i18n.t("view.sync.waiting"),
          syncState === "kept" ? () => onsync(true) : onview,
          syncChip,
          ["ml-1 size-5 justify-center", syncState === "waiting" ? "text-warning" : "text-muted-foreground"],
          "sync",
          syncState === "kept" ? "S" : undefined,
        )}
      {/if}
      {#if fileCount > 0}
        {@render chip(i18n.t("attach.chip", fileCount), onview, filesChip, "ml-1 gap-0.5 bg-muted pr-1.5 pl-1 text-muted-foreground", "files")}
      {/if}
      <!-- At the line's far end, the arrow that opens a cut-short to-do (and folds it back). -->
      {#if !concealed && (truncated || expanded)}
        {@render chip(expanded ? i18n.t("item.showLess") : i18n.t("item.showAll"), () => {
          expanded = !expanded;
          hints.done("long");
        }, moreChip, "ml-auto size-5 justify-center bg-muted text-muted-foreground", "more")}
      {/if}
    </p>
  {/if}

  <!-- Actions float over the end of the row on hover or focus, instead of taking room from the text. -->
  <div
    data-row-actions
    bind:offsetWidth={actionsWidth}
    class={[
      // Only the buttons take clicks; the fade in front of them lets them through to the text and tags.
      "pointer-events-none absolute top-[8px] right-1 flex items-center gap-px rounded-r-md pl-5 opacity-0 transition-opacity [&>*]:pointer-events-auto",
      "bg-[linear-gradient(to_right,transparent,var(--row-bg)_1.1rem)]",
      "group-hover/row:opacity-100 group-focus-visible/row:opacity-100 has-[:focus-visible]:opacity-100",
      menuOpen && "opacity-100",
      editing && "hidden",
    ]}
  >
    <!-- Show, View and Edit only once the pointer nears the row's end, where they are; erasing is in the menu. -->
    <div class={["items-center gap-px", nearEnd || menuOpen ? "flex" : "hidden group-focus-visible/row:flex"]} data-near-actions>
      {#if todo.hidden}
        <Button
          variant="ghost"
          size="icon-xs"
          tabindex={-1}
          tooltip={revealed ? i18n.t("item.hide") : i18n.t("item.show")}
          aria-pressed={revealed}
          onclick={() => (revealed = !revealed)}
        >
          {#if revealed}<EyeOffIcon />{:else}<EyeIcon />{/if}
        </Button>
      {/if}

      <Button
        variant="ghost"
        size="icon-xs"
        tabindex={-1}
        tooltip={i18n.t("menu.view")}
        shortcut="V"
        onclick={onview}
      >
        <Maximize2Icon />
      </Button>

      <Button
        variant="ghost"
        size="icon-xs"
        tabindex={-1}
        tooltip={i18n.t("item.edit")}
        shortcut="Enter"
        onclick={startEdit}
      >
        <PencilIcon />
      </Button>
    </div>

    <RowMenu
      {todo}
      {lists}
      {syncAvailable}
      bind:open={menuOpen}
      anchor={menuAnchor}
      {onmoveto}
      {onschedule}
      {onview}
      onedit={() => void startEdit()}
      oneditfull={() => oneditfull()}
      {onremove}
      {onlink}
      {onrepeat}
      {pinnedToday}
      ontoday={() => ontoday(!pinnedToday)}
      {onhidden}
      {onpinned}
      tags={todo.hidden ? [] : segments.flatMap(segment => (segment.kind === "tag" ? [segment.tag] : []))}
      {ontag}
      {onmove}
      onsync={synced => onsync(synced)}
      onclosed={() => {
        // Unless it closed into editing, which has the focus already.
        if (!editing) {
          row?.focus();
        }
      }}
    />

    {#if draggable}
      <Tip label={i18n.t("item.drag")} shortcut="Alt+↑ / ↓">
        {#snippet children(tip)}
          <!-- Not a tab stop: the keyboard reorders with Alt+arrows. -->
          <span
            {...mergeProps(tip, { tabindex: undefined })}
            use:dragHandle
            aria-label={i18n.t("item.drag")}
            class="flex h-7 w-6 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          >
            <GripVerticalIcon class="size-4" />
          </span>
        {/snippet}
      </Tip>
    {/if}
  </div>
</div>
