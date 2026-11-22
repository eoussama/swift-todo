<script lang="ts">
  import type { TList } from "@/lib/todos/lists";

  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import { tick } from "svelte";
  import { i18n } from "#i18n";

  import { CONFIRM_MS } from "@/lib/components/confirm";
  import { Button } from "@/lib/components/ui/button";
  import { MAX_LIST_NAME_LENGTH } from "@/lib/todos/lists";



  type Props = {
    list: TList;
    first: boolean;
    last: boolean;
    onrename: (name: string, emoji: string | null) => void;
    onmove: (delta: -1 | 1) => Promise<void>;
    ondelete: () => void;
  };

  const { list, first, last, onrename, onmove, ondelete }: Props = $props();

  let name = $state("");
  let emoji = $state("");
  let confirming = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;
  let upButton = $state<HTMLButtonElement | null>(null);
  let downButton = $state<HTMLButtonElement | null>(null);

  $effect(() => () => clearTimeout(confirmTimer));

  // Follow changes made elsewhere (another device, or undo). Only a value that
  // actually changed replaces the field, so a refresh never wipes what's being typed.
  let shown = { name: "", emoji: "" };

  $effect.pre(() => {
    const next = { name: list.name, emoji: list.emoji ?? "" };

    if (next.name !== shown.name) {
      name = next.name;
    }

    if (next.emoji !== shown.emoji) {
      emoji = next.emoji;
    }

    shown = next;
  });

  function save(): void {
    // A list needs a name: an emptied field gets the old one back.
    if (name.trim().length === 0) {
      name = list.name;
    }

    if (name.trim() !== list.name || (emoji.trim() || null) !== list.emoji) {
      onrename(name, emoji.trim() || null);
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }

  // The row moves in the list, which takes the focus off the button pressed; it goes back to it,
  // so the list can be moved again. At the top or bottom, the button only says it can't.
  async function move(delta: -1 | 1, button: HTMLButtonElement | null): Promise<void> {
    if ((delta === -1 && first) || (delta === 1 && last)) {
      return;
    }

    await onmove(delta);
    await tick();
    button?.focus();
  }

  // Deleting takes a second click within a few seconds.
  function remove(): void {
    clearTimeout(confirmTimer);

    if (!confirming) {
      confirming = true;
      confirmTimer = setTimeout(() => (confirming = false), CONFIRM_MS);

      return;
    }

    confirming = false;
    ondelete();
  }

  const edge = "aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
  const inputClass = "h-8 rounded-md border-2 border-border bg-sheet px-2 text-sm font-bold outline-none focus-visible:focus-ring";
</script>

<li class="flex items-center gap-1.5">
  <input
    class={[inputClass, "w-9 shrink-0 text-center"]}
    bind:value={emoji}
    aria-label={i18n.t("settings.lists.emoji", [list.name])}
    placeholder="·"
    maxlength={8}
    onblur={save}
    {onkeydown}
  />
  <input
    class={[inputClass, "min-w-0 flex-1"]}
    bind:value={name}
    aria-label={i18n.t("settings.lists.name", [list.name])}
    maxlength={MAX_LIST_NAME_LENGTH}
    onblur={save}
    {onkeydown}
  />
  <Button bind:ref={upButton} variant="ghost" size="icon-xs" aria-disabled={first} class={edge} tooltip={i18n.t("settings.lists.moveUp", [list.name])} onclick={() => void move(-1, upButton)}>
    <ArrowUpIcon />
  </Button>
  <Button bind:ref={downButton} variant="ghost" size="icon-xs" aria-disabled={last} class={edge} tooltip={i18n.t("settings.lists.moveDown", [list.name])} onclick={() => void move(1, downButton)}>
    <ArrowDownIcon />
  </Button>
  <Button
    variant="destructive"
    size={confirming ? "sm" : "icon-xs"}
    class={confirming ? "bg-destructive-soft text-destructive" : ""}
    aria-label={confirming ? i18n.t("settings.lists.deleteConfirmLabel", [list.name]) : i18n.t("settings.lists.delete", [list.name])}
    tooltip={confirming ? "" : i18n.t("settings.lists.delete", [list.name])}
    onclick={remove}
  >
    <TrashIcon />
    {#if confirming}{i18n.t("settings.lists.deleteConfirm")}{/if}
  </Button>
  <span class="sr-only" role="status">{confirming ? i18n.t("settings.lists.deleteAgain") : ""}</span>
</li>
