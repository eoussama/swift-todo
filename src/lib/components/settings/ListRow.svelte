<script lang="ts">
  import type { TList } from "@/lib/todos/lists";

  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import { tick } from "svelte";
  import { i18n } from "#i18n";

  import { ConfirmTwice } from "@/lib/components/confirm.svelte";
  import { Button } from "@/lib/components/ui/button";
  import { readFields, saveDraft, textOf } from "@/lib/drafts.svelte";
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
  // Deleting takes a second click within a few seconds.
  const deleting = new ConfirmTwice();
  let upButton = $state<HTMLButtonElement | null>(null);
  let downButton = $state<HTMLButtonElement | null>(null);

  $effect(() => () => deleting.dispose());

  // Follow changes made elsewhere (another device, or undo). Only a value that
  // actually changed replaces the field, so a refresh never wipes what's being typed.
  // At first, a name or emoji still being typed when the popup closed comes back.
  let shown: { name: string; emoji: string } | null = null;

  $effect.pre(() => {
    const next = { name: list.name, emoji: list.emoji ?? "" };

    if (shown === null) {
      const kept = readFields("lists")[list.id];
      const typed = typeof kept === "object" && kept !== null ? kept as Record<string, unknown> : {};

      name = textOf(typed, "name", next.name);
      emoji = textOf(typed, "emoji", next.emoji);
    }
    else {
      if (next.name !== shown.name) {
        name = next.name;
      }

      if (next.emoji !== shown.emoji) {
        emoji = next.emoji;
      }
    }

    shown = next;
  });

  // What's typed and not yet saved, kept per list while the popup is closed.
  $effect(() => {
    const { [list.id]: _, ...others } = readFields("lists");
    const changed = name !== list.name || emoji !== (list.emoji ?? "");
    const all = changed ? { ...others, [list.id]: { name, emoji } } : others;

    saveDraft("lists", Object.keys(all).length === 0 ? null : all);
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

  function remove(): void {
    if (deleting.press()) {
      ondelete();
    }
  }

  const edge = "aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
  const inputClass = "h-8 rounded-md border-2 border-border bg-sheet px-2 text-sm font-bold outline-none focus-visible:focus-ring";
</script>

<li class="flex items-center gap-1.5">
  <!-- The list's icon: an emoji, a symbol, or a letter or number. Empty, it says it takes one. -->
  <input
    class={[inputClass, "w-10 shrink-0 px-0 text-center text-[15px] placeholder:font-extrabold placeholder:text-muted-foreground", emoji.trim() === "" && "border-dashed border-border/60"]}
    bind:value={emoji}
    aria-label={i18n.t("settings.lists.emoji", [list.name])}
    title={i18n.t("settings.lists.iconHint")}
    placeholder="+"
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
    size={deleting.armed ? "sm" : "icon-xs"}
    class={deleting.armed ? "bg-destructive-soft text-destructive" : ""}
    aria-label={deleting.armed ? i18n.t("settings.lists.deleteConfirmLabel", [list.name]) : i18n.t("settings.lists.delete", [list.name])}
    tooltip={deleting.armed ? "" : i18n.t("settings.lists.delete", [list.name])}
    onclick={remove}
  >
    <TrashIcon />
    {#if deleting.armed}{i18n.t("settings.lists.deleteConfirm")}{/if}
  </Button>
  <span class="sr-only" role="status">{deleting.armed ? i18n.t("settings.lists.deleteAgain") : ""}</span>
</li>
