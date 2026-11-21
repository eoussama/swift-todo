<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TTodo } from "@/lib/todos/model";

  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CloudExclamationIcon from "@lucide/svelte/icons/cloud-exclamation-point";
  import CloudOffIcon from "@lucide/svelte/icons/cloud-off";
  import CloudUploadIcon from "@lucide/svelte/icons/cloud-upload";
  import EraserIcon from "@lucide/svelte/icons/eraser";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
  import LinkIcon from "@lucide/svelte/icons/link";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { tick } from "svelte";
  import { dragHandle } from "svelte-dnd-action";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { Checkbox } from "@/lib/components/ui/checkbox";
  import { formatDue, formatRule } from "@/lib/time/format";
  import { isPinnedToday } from "@/lib/time/today";
  import { TODO_LIMITS } from "@/lib/todos/limits";
  import { segmentText } from "@/lib/todos/tags";
  import { mergeProps } from "@/lib/utils";

  import RowMenu from "./RowMenu.svelte";
  import Scribble from "./Scribble.svelte";
  import Tip from "./Tip.svelte";



  type TSyncState = "synced" | "pending" | "waiting" | "kept" | "unavailable";

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
    now,
    ontag,
    onmove,
    onnavigate,
  }: Props = $props();

  let menuOpen = $state(false);
  const segments = $derived(segmentText(todo.text));
  // A hidden to-do shows dots until revealed; it hides again next time the popup opens.
  let revealed = $state(false);
  const concealed = $derived(todo.hidden && !revealed);

  // The list finds rows through `data-todo-row`; element bindings go stale when the keyed list reorders.
  let row = $state<HTMLElement | null>(null);
  let editing = $state(false);
  let draft = $state("");
  let editor = $state<HTMLInputElement | null>(null);

  const syncState = $derived<TSyncState>(
    !syncAvailable
      ? "unavailable"
      : todo.location === "sync"
      ? (todo.pending ? "pending" : "synced")
      : (todo.keepOnDevice ? "kept" : "waiting"),
  );

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
  const pinned = $derived(!todo.done && isPinnedToday(todo, now) && !(dueLabel?.soon ?? false));

  // "Text, not done, due Tomorrow, repeats Every day, synced": the state part gathers the details.
  const details = $derived([
    i18n.t(todo.done ? "item.state.done" : "item.state.open"),
    ...(dueLabel === null ? [] : [i18n.t(dueLabel.overdue && !todo.done ? "due.overdue" : "due.label", [dueLabel.label])]),
    ...(repeatLabel === "" ? [] : [i18n.t("item.repeats", [repeatLabel])]),
    ...(pinned ? [i18n.t("item.pinnedToday")] : []),
    ...(todo.source === null ? [] : [i18n.t("item.from", [todo.source.title ?? new URL(todo.source.url).hostname])]),
  ].join(", "));

  const label = $derived(i18n.t("item.label", [concealed ? i18n.t("item.hidden") : todo.text, details, i18n.t(`item.syncShort.${syncState}`)]));

  async function startEdit(): Promise<void> {
    draft = todo.text;
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
    row?.focus();
  }

  function toggleSync(): void {
    onsync(syncState === "kept" || syncState === "waiting");
  }

  function onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
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
    else {
      handled = false;
    }

    if (handled) {
      event.preventDefault();
    }
  }
</script>

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
  aria-keyshortcuts="Space Enter F2 Delete Alt+ArrowUp Alt+ArrowDown S M V"
  {tabindex}
  data-todo-id={todo.id}
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
    <input
      bind:this={editor}
      bind:value={draft}
      class="my-[7px] mr-1 ml-2 h-[30px] min-w-0 flex-1 rounded-md border-2 border-border bg-sheet px-2 text-[15.5px] written outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)]"
      maxlength={TODO_LIMITS.maxTextLength}
      aria-label={i18n.t("item.editLabel")}
      onkeydown={onEditorKeydown}
      onblur={() => commit(false)}
    />
  {:else}
    <!-- Double-click to edit; keyboard users press Enter or F2 on the row. -->
    <p class="min-w-0 flex-1 py-[11px] pr-3 pl-3 text-[14.5px] leading-[22px] font-bold [overflow-wrap:anywhere]" ondblclick={startEdit}>
      <span
        class={["pencil-strike written text-[1.08em]", todo.done && "text-muted-foreground"]}
        data-done={todo.done ? "" : undefined}
      >{#if concealed}<span data-hidden-text><Scribble /></span>{:else}{#each segments as segment, i (i)}{#if segment.kind === "tag"}<button
        type="button"
        tabindex={-1}
        class="mx-px rounded-full bg-(--tag) px-1.5 font-sans text-[12.5px] font-extrabold text-foreground no-underline hover:bg-(--tag-hover)"
        aria-label={i18n.t("tags.chip", [segment.tag])}
        onclick={(event) => {
          event.stopPropagation();
          ontag(segment.tag);
        }}
      >{segment.value}</button>{:else}{segment.value}{/if}{/each}{/if}</span>
      {#if todo.hidden}
        <Button
          variant="ghost"
          size="icon-xs"
          class="ml-0.5 size-6 align-[-6px]"
          tabindex={-1}
          tooltip={revealed ? i18n.t("item.hide") : i18n.t("item.show")}
          aria-pressed={revealed}
          onclick={(event: MouseEvent) => {
            event.stopPropagation();
            revealed = !revealed;
          }}
        >
          {#if revealed}<EyeOffIcon />{:else}<EyeIcon />{/if}
        </Button>
      {/if}
      {#if dueLabel !== null || repeatLabel !== ""}
        <!-- Due date and repeat, as a small chip after the text. -->
        <span
          class={[
            "ml-1 inline-flex items-center gap-1 rounded-full px-1.5 align-[1px] text-[11.5px] leading-[18px] font-extrabold",
            dueLabel?.overdue && !todo.done ? "bg-destructive-soft text-destructive" : dueLabel?.soon && !todo.done ? "bg-(--row-focus)" : "bg-muted text-muted-foreground",
          ]}
          aria-hidden="true"
        >
          {#if dueLabel !== null}
            <CalendarIcon class="size-3" />{dueLabel.label}
          {/if}
          {#if repeatLabel !== ""}
            <RepeatIcon class="size-3" />
          {/if}
        </span>
      {/if}
      {#if pinned}
        <span class="ml-1 inline-flex items-center gap-1 rounded-full bg-(--row-focus) px-1.5 align-[1px] text-[11.5px] leading-[18px] font-extrabold" data-today-chip aria-hidden="true">
          <SunIcon class="size-3" />{i18n.t("due.today")}
        </span>
      {/if}
      {#if todo.source !== null}
        <LinkIcon class="ml-1 inline size-3.5 align-[-2px] text-muted-foreground" aria-hidden="true" />
      {/if}
      {#if syncState === "waiting" || syncState === "kept"}
        <!-- Not synced: a small mark after the text, so it shows without hovering. -->
        <SyncIcon class={["ml-1 inline size-3.5 align-[-2px]", syncState === "waiting" ? "text-warning" : "text-muted-foreground"]} aria-hidden="true" />
      {/if}
    </p>
  {/if}

  <!-- Actions float over the end of the row on hover or focus, instead of taking room from the text. -->
  <div
    class={[
      // Only the buttons take clicks; the fade in front of them lets them through to the text and tags.
      "pointer-events-none absolute top-[7px] right-1 flex items-center gap-px rounded-r-md pl-5 opacity-0 transition-opacity [&>*]:pointer-events-auto",
      "bg-[linear-gradient(to_right,transparent,var(--row-bg)_1.1rem)]",
      "group-hover/row:opacity-100 group-focus-visible/row:opacity-100 has-[:focus-visible]:opacity-100",
      menuOpen && "opacity-100",
      editing && "hidden",
    ]}
  >
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

    <Button
      variant="destructive"
      size="icon-xs"
      tabindex={-1}
      tooltip={i18n.t("item.delete")}
      onclick={onremove}
    >
      <EraserIcon />
    </Button>

    <RowMenu
      {todo}
      {lists}
      {syncAvailable}
      bind:open={menuOpen}
      {onmoveto}
      {onschedule}
      {onview}
      {onlink}
      {onrepeat}
      pinnedToday={isPinnedToday(todo, now)}
      ontoday={() => ontoday(!isPinnedToday(todo, now))}
      {onhidden}
      onsync={synced => onsync(synced)}
      onclosed={() => row?.focus()}
    />

    {#if draggable}
      <Tip label={i18n.t("item.drag")}>
        {#snippet children(tip)}
          <!-- Not a tab stop: the keyboard reorders with Alt+arrows. -->
          <span
            {...mergeProps(tip, { tabindex: undefined })}
            use:dragHandle
            aria-label={i18n.t("item.drag")}
            class="flex h-7 w-4 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          >
            <GripVerticalIcon class="size-4" />
          </span>
        {/snippet}
      </Tip>
    {/if}
  </div>
</div>
