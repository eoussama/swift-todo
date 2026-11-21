<script lang="ts">
  import type { TTodo } from "@/lib/todos/model";

  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CloudExclamationIcon from "@lucide/svelte/icons/cloud-exclamation-point";
  import CloudOffIcon from "@lucide/svelte/icons/cloud-off";
  import CloudUploadIcon from "@lucide/svelte/icons/cloud-upload";
  import EraserIcon from "@lucide/svelte/icons/eraser";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import { tick } from "svelte";
  import { dragHandle } from "svelte-dnd-action";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { Checkbox } from "@/lib/components/ui/checkbox";
  import * as Tooltip from "@/lib/components/ui/tooltip";
  import { TODO_LIMITS } from "@/lib/todos/limits";



  type TSyncState = "synced" | "pending" | "waiting" | "kept" | "unavailable";

  type Props = {
    todo: TTodo & { isDndShadowItem?: boolean };
    /** False when sync is off in this browser. */
    syncAvailable: boolean;
    /** True inside the drag-and-drop zone, which adds a drag handle. */
    draggable: boolean;
    /** 0 for the row that holds the list's tab stop, -1 for the others. */
    tabindex: 0 | -1;
    onfocus: () => void;
    ontoggle: () => void;
    onsave: (text: string) => void;
    onremove: () => void;
    onsync: (synced: boolean) => void;
    onmove: (delta: -1 | 1) => void;
    onnavigate: (target: "previous" | "next" | "first" | "last") => void;
  };

  const {
    todo,
    syncAvailable,
    draggable,
    tabindex,
    onfocus,
    ontoggle,
    onsave,
    onremove,
    onsync,
    onmove,
    onnavigate,
  }: Props = $props();

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

  const label = $derived(i18n.t("item.label", [
    todo.text,
    i18n.t(todo.done ? "item.state.done" : "item.state.open"),
    i18n.t(`item.syncShort.${syncState}`),
  ]));

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
  aria-keyshortcuts="Space Enter F2 Delete Alt+ArrowUp Alt+ArrowDown S"
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
      class="my-[7px] mr-1 ml-2 h-[30px] min-w-0 flex-1 rounded-md border-2 border-border bg-sheet px-2 text-[14.5px] font-bold outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)]"
      maxlength={TODO_LIMITS.maxTextLength}
      aria-label={i18n.t("item.editLabel")}
      onkeydown={onEditorKeydown}
      onblur={() => commit(false)}
    />
  {:else}
    <!-- Double-click to edit; keyboard users press Enter or F2 on the row. -->
    <p class="min-w-0 flex-1 py-[11px] pr-3 pl-3 text-[14.5px] leading-[22px] font-bold [overflow-wrap:anywhere]" ondblclick={startEdit}>
      <span
        class={["pencil-strike", todo.done && "text-muted-foreground"]}
        data-done={todo.done ? "" : undefined}
      >{todo.text}</span>
      {#if syncState === "waiting" || syncState === "kept"}
        <!-- Not synced: a small mark after the text, so it shows without hovering. -->
        <SyncIcon class={["ml-1 inline size-3.5 align-[-2px]", syncState === "waiting" ? "text-warning" : "text-muted-foreground"]} aria-hidden="true" />
      {/if}
    </p>
  {/if}

  <!-- Actions float over the end of the row on hover or focus, instead of taking room from the text. -->
  <div
    class={[
      "absolute top-[7px] right-1 flex items-center gap-px rounded-r-md pl-5 opacity-0 transition-opacity",
      "bg-[linear-gradient(to_right,transparent,var(--row-bg)_1.1rem)]",
      "group-hover/row:opacity-100 group-focus-visible/row:opacity-100 has-[:focus-visible]:opacity-100",
      editing && "hidden",
    ]}
  >
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon-xs"
            tabindex={-1}
            disabled={!syncAvailable}
            aria-label={i18n.t(`item.sync.${syncState}`)}
            class={[
              syncState === "waiting" && "text-warning",
              syncState === "pending" && "animate-pulse",
            ]}
            onclick={toggleSync}
          >
            <SyncIcon />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="left" class="max-w-52">{i18n.t(`item.sync.${syncState}`)}</Tooltip.Content>
    </Tooltip.Root>

    <Button
      variant="ghost"
      size="icon-xs"
      tabindex={-1}
      aria-label={i18n.t("item.edit")}
      onclick={startEdit}
    >
      <PencilIcon />
    </Button>

    <Button
      variant="destructive"
      size="icon-xs"
      tabindex={-1}
      aria-label={i18n.t("item.delete")}
      onclick={onremove}
    >
      <EraserIcon />
    </Button>

    {#if draggable}
      <span
        use:dragHandle
        aria-label={i18n.t("item.drag")}
        class="flex h-7 w-4 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
      >
        <GripVerticalIcon class="size-4" />
      </span>
    {/if}
  </div>
</div>
