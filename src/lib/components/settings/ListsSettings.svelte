<script lang="ts">
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import PlusIcon from "@lucide/svelte/icons/plus";
  import { tick } from "svelte";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { readDraft, saveDraft } from "@/lib/drafts.svelte";
  import { MAX_LIST_NAME_LENGTH, MAX_LISTS } from "@/lib/todos/lists";

  import ListRow from "./ListRow.svelte";



  type Props = { store: TodoStore };

  const { store }: Props = $props();

  // Kept while the popup is closed, until added.
  const kept = readDraft("settings-new-list");
  let name = $state(typeof kept === "string" ? kept : "");

  $effect(() => {
    saveDraft("settings-new-list", name === "" ? null : name);
  });
  let rows = $state<HTMLUListElement | null>(null);
  let addInput = $state<HTMLInputElement | null>(null);

  // The deleted row took the focus with it: it goes to the name of the list now in its place
  // (or the one before it), or to the field for a new list when none is left.
  async function remove(id: string, index: number): Promise<void> {
    await store.deleteList(id);
    await tick();

    const names = rows?.querySelectorAll<HTMLInputElement>("li input:nth-of-type(2)") ?? [];

    (names[Math.min(index, names.length - 1)] ?? addInput)?.focus();
  }

  async function add(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    if ((await store.addList(name)) !== undefined) {
      name = "";
    }
  }
</script>

{#if store.lists.length === 0}
  <p class="mb-2 text-[13px] font-semibold text-muted-foreground">{i18n.t("settings.lists.empty")}</p>
{:else}
  <ul bind:this={rows} class="mb-2 flex flex-col gap-1.5">
    {#each store.lists as list, index (list.id)}
      <ListRow
        {list}
        first={index === 0}
        last={index === store.lists.length - 1}
        onrename={(newName, emoji) => void store.renameList(list.id, newName, emoji)}
        onmove={async delta => store.moveList(list.id, delta)}
        ondelete={() => void remove(list.id, index)}
      />
    {/each}
  </ul>
  <p class="mb-2 text-xs font-semibold text-muted-foreground">{i18n.t("settings.lists.deleteHint")}</p>
{/if}

{#if store.lists.length < MAX_LISTS}
  <form class="flex gap-1.5" onsubmit={add}>
    <input
      class="h-8 min-w-0 flex-1 rounded-md border-2 border-border bg-sheet px-2 text-sm font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground focus-visible:focus-ring"
      bind:this={addInput}
      bind:value={name}
      placeholder={i18n.t("lists.namePlaceholder")}
      aria-label={i18n.t("settings.lists.add")}
      maxlength={MAX_LIST_NAME_LENGTH}
    />
    <Button type="submit" variant="default" size="sm" disabled={name.trim().length === 0}>
      <PlusIcon />
      {i18n.t("settings.lists.add")}
    </Button>
  </form>
{/if}
