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
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PinIcon from "@lucide/svelte/icons/pin";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { onMount, tick } from "svelte";
  import { dragHandle } from "svelte-dnd-action";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { autosize } from "@/lib/autosize";
  import { Button } from "@/lib/components/ui/button";
  import { Checkbox } from "@/lib/components/ui/checkbox";
  import { readTodoDraft, saveDraft, textOf } from "@/lib/drafts.svelte";
  import { hints } from "@/lib/hints.svelte";
  import { oneLine } from "@/lib/messages";
  import { formatDue, formatRule } from "@/lib/time/format";
  import { isPinnedToday } from "@/lib/time/today";
  import { TODO_LIMITS } from "@/lib/todos/limits";
  import { syncStateOf } from "@/lib/todos/model";
  import { segmentText } from "@/lib/todos/tags";
  import { mergeProps } from "@/lib/utils";

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
    onmove: (delta: -1 | 1) => void;
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
  // The pointer in the strip at the row's end kept for its buttons, where View and Edit then show.
  const NEAR_END = 64;
  let nearEnd = $state(false);

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
      truncated = element.scrollWidth > element.clientWidth + 1;
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
  let draft = $state("");
  let editor = $state<HTMLTextAreaElement | null>(null);
  // The text being edited, measured so the editor opens at least as tall as it was.
  let paragraph = $state<HTMLElement | null>(null);
  let editorMin = $state(0);

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
  const details = $derived([
    i18n.t(todo.done ? "item.state.done" : "item.state.open"),
    ...(dueLabel === null ? [] : [i18n.t(dueLabel.overdue && !todo.done ? "due.overdue" : "due.label", [dueLabel.label])]),
    ...(repeatLabel === "" ? [] : [i18n.t("item.repeats", [repeatLabel])]),
    ...(todayPinned ? [i18n.t("item.pinnedToday")] : []),
    ...(todo.pinned ? [i18n.t("item.pinned")] : []),
    ...(todo.source === null ? [] : [i18n.t("item.from", [todo.source.title ?? new URL(todo.source.url).hostname])]),
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

  function toggleSync(): void {
    onsync(syncState === "kept" || syncState === "waiting");
  }

  function onEditorKeydown(event: KeyboardEvent): void {
    // Enter saves; Shift+Enter starts a new line.
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
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
      onmove(key === "ArrowUp" ? -1 : 1);
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
    else if (key === "Enter" || key === "F2") {
      void startEdit();
    }
    else if (key === "Delete" || key === "Backspace") {
      onremove();
    }
    else if ((key === "s" || key === "S") && !event.ctrlKey && !event.metaKey && syncAvailable) {
      toggleSync();
    }
    else if ((key === "m" || key === "M") && !event.ctrlKey && !event.metaKey) {
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
{#snippet chip(label: string, action: () => void, content: Snippet, className: ClassValue, kind: string)}
  <Tip {label}>
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
  aria-keyshortcuts="Space Enter F2 Delete Backspace Home End Alt+ArrowUp Alt+ArrowDown S M V P"
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
  ]}
  {onfocus}
  onkeydown={onRowKeydown}
  onpointermove={(event) => {
    // Once shown, they stay while the pointer is over them, out of the strip too.
    const overButtons = (event.target as Element).closest("[data-row-actions]") !== null;

    nearEnd = row !== null && (overButtons || event.clientX >= row.getBoundingClientRect().right - NEAR_END);
  }}
  onpointerleave={() => (nearEnd = false)}
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
      Lined up with the text it replaces (same font, line height and wrap width, short of the
      strip kept for the row's buttons), and as tall
      as all of it: margin, border and padding add up to the text's 11px above and below.
    -->
    <textarea
      bind:this={editor}
      bind:value={draft}
      use:autosize={draft}
      rows={1}
      style:min-height="{editorMin}px"
      class="my-[7px] mr-[50px] ml-0.5 block min-w-0 flex-1 resize-none overflow-hidden rounded-md border-2 border-border bg-sheet px-2 py-[2px] text-[length:calc(14.5px*1.08)] leading-[22px] written whitespace-pre-wrap outline-none [overflow-wrap:anywhere] focus-visible:focus-ring"
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
  {:else}
    <!--
      Click to edit (unless the text is hidden); keyboard users press Enter or F2 on the row. The line is set in the
      to-do's own hand, so every line is 22px tall, as in the editor; chips set their own font.
      It shows one line, cut short, until the peek key is held over it (`data-todo-line` in app.css).
      It stops short of the row's end, kept for its buttons, so they never cover a chip.
    -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <p bind:this={paragraph} data-todo-line class={["min-w-0 flex-1 py-[11px] pr-[60px] pl-3 text-[length:calc(14.5px*1.08)] leading-[22px] written [overflow-wrap:anywhere]", !concealed && "cursor-text"]} onclick={() => {
      // Hidden text stays hidden from a stray click; Enter, F2 or the Edit button still edit it.
      if (!concealed) {
        void startEdit();
      }
    }}>
      {#if todo.pinned}
        {@render chip(i18n.t("menu.unpin"), () => onpinned(false), pinChip, "mr-0.5 first:-ml-1 size-5 justify-center text-muted-foreground", "pin")}
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
      {#if !concealed && (truncated || expanded)}
        {@render chip(expanded ? i18n.t("item.showLess") : i18n.t("item.showAll"), () => {
          expanded = !expanded;
          hints.done("long");
        }, moreChip, "ml-0.5 size-5 justify-center bg-muted text-muted-foreground", "more")}
      {/if}
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
        )}
      {/if}
    </p>
  {/if}

  <!-- Actions float over the end of the row on hover or focus, instead of taking room from the text. -->
  <div
    data-row-actions
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
        onclick={onview}
      >
        <Maximize2Icon />
      </Button>

      <Button
        variant="ghost"
        size="icon-xs"
        tabindex={-1}
        tooltip={i18n.t("item.edit")}
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
      {onmoveto}
      {onschedule}
      {onview}
      onedit={() => void startEdit()}
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
      <Tip label={i18n.t("item.drag")}>
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
