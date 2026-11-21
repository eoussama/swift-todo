<script lang="ts">
  import type { TList } from "@/lib/todos/lists";

  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { MAX_LIST_NAME_LENGTH } from "@/lib/todos/lists";



  type Props = {
    list: TList;
    first: boolean;
    last: boolean;
    onrename: (name: string, emoji: string | null) => void;
    onmove: (delta: -1 | 1) => void;
    ondelete: () => void;
  };

  const { list, first, last, onrename, onmove, ondelete }: Props = $props();

  let name = $state("");
  let emoji = $state("");
  let confirming = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  // Follow changes made elsewhere (another device, or undo).
  $effect.pre(() => {
    name = list.name;
    emoji = list.emoji ?? "";
  });

  function save(): void {
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

  // Deleting takes a second click within a few seconds.
  function remove(): void {
    clearTimeout(confirmTimer);

    if (!confirming) {
      confirming = true;
      confirmTimer = setTimeout(() => (confirming = false), 3_000);

      return;
    }

    confirming = false;
    ondelete();
  }

  const inputClass = "h-8 rounded-md border-2 border-border bg-sheet px-2 text-sm font-bold outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)]";
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
  <Button variant="ghost" size="icon-xs" disabled={first} aria-label={i18n.t("settings.lists.moveUp", [list.name])} onclick={() => onmove(-1)}>
    <ArrowUpIcon />
  </Button>
  <Button variant="ghost" size="icon-xs" disabled={last} aria-label={i18n.t("settings.lists.moveDown", [list.name])} onclick={() => onmove(1)}>
    <ArrowDownIcon />
  </Button>
  <Button
    variant="destructive"
    size={confirming ? "sm" : "icon-xs"}
    class={confirming ? "bg-destructive-soft text-destructive" : ""}
    aria-label={confirming ? i18n.t("settings.lists.deleteConfirm") : i18n.t("settings.lists.delete", [list.name])}
    onclick={remove}
  >
    <TrashIcon />
    {#if confirming}{i18n.t("settings.lists.deleteConfirm")}{/if}
  </Button>
</li>
