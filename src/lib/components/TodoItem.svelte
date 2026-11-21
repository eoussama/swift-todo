<script lang="ts">
  import type { TTodo } from "@/lib/todos/model";

  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CloudExclamationIcon from "@lucide/svelte/icons/cloud-exclamation-point";
  import CloudOffIcon from "@lucide/svelte/icons/cloud-off";
  import CloudUploadIcon from "@lucide/svelte/icons/cloud-upload";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import TrashIcon from "@lucide/svelte/icons/trash";
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
  const quietSync = $derived(syncState === "synced" || syncState === "pending");

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

    // A blank edit is dropped rather than refused; deleting is one key away.
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
  The row is the list's roving focus stop: one tab stop for the whole list,
  arrow keys between rows, and shortcuts (listed in aria-keyshortcuts) for
  the actions inside.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={row}
  data-todo-row
  role="group"
  aria-label={label}
  aria-keyshortcuts="Space Enter F2 Delete Alt+ArrowUp Alt+ArrowDown S"
  {tabindex}
  class={[
    "group/row relative flex items-start gap-2 rounded-lg py-1.5 pr-1.5 pl-0.5 outline-none focus-visible:focus-ring",
    todo.isDndShadowItem ? "border-2 border-dashed border-border bg-muted opacity-60" : "hover:bg-muted/70",
  ]}
  {onfocus}
  onkeydown={onRowKeydown}
>
  <span
    use:dragHandle
    aria-label={i18n.t("item.drag")}
    class="mt-1.5 flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 active:cursor-grabbing"
  >
    <GripVerticalIcon class="size-4" />
  </span>

  <Checkbox
    class="mt-1.5"
    checked={todo.done}
    onCheckedChange={() => ontoggle()}
    aria-label={i18n.t("item.done")}
    tabindex={-1}
  />

  {#if editing}
    <input
      bind:this={editor}
      bind:value={draft}
      class="min-w-0 flex-1 rounded-md border-2 border-border bg-card px-2 py-1 text-sm font-semibold outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)]"
      maxlength={TODO_LIMITS.maxTextLength}
      aria-label={i18n.t("item.editLabel")}
      onkeydown={onEditorKeydown}
      onblur={() => commit(false)}
    />
  {:else}
    <!-- Double-click to edit; keyboard users press Enter or F2 on the row. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class={[
        "min-w-0 flex-1 py-1 text-sm leading-snug font-semibold [overflow-wrap:anywhere] transition-colors",
        todo.done && "text-muted-foreground line-through decoration-mint decoration-2",
      ]}
      ondblclick={startEdit}
    >
      {todo.text}
    </span>
  {/if}

  <div class="flex shrink-0 items-center gap-0.5">
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
              quietSync && "opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100",
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
      class="opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100"
      onclick={startEdit}
    >
      <PencilIcon />
    </Button>

    <Button
      variant="destructive"
      size="icon-xs"
      tabindex={-1}
      aria-label={i18n.t("item.delete")}
      class="opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100"
      onclick={onremove}
    >
      <TrashIcon />
    </Button>
  </div>
</div>
