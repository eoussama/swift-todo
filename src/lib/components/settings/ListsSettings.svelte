<script lang="ts">
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import PlusIcon from "@lucide/svelte/icons/plus";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { MAX_LIST_NAME_LENGTH, MAX_LISTS } from "@/lib/todos/lists";

  import ListRow from "./ListRow.svelte";



  type Props = { store: TodoStore };

  const { store }: Props = $props();

  let name = $state("");

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
  <ul class="mb-2 flex flex-col gap-1.5">
    {#each store.lists as list, index (list.id)}
      <ListRow
        {list}
        first={index === 0}
        last={index === store.lists.length - 1}
        onrename={(newName, emoji) => void store.renameList(list.id, newName, emoji)}
        onmove={delta => void store.moveList(list.id, delta)}
        ondelete={() => void store.deleteList(list.id)}
      />
    {/each}
  </ul>
  <p class="mb-2 text-xs font-semibold text-muted-foreground">{i18n.t("settings.lists.deleteHint")}</p>
{/if}

{#if store.lists.length < MAX_LISTS}
  <form class="flex gap-1.5" onsubmit={add}>
    <input
      class="h-8 min-w-0 flex-1 rounded-md border-2 border-border bg-sheet px-2 text-sm font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground focus-visible:focus-ring"
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
