<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TTodo } from "@/lib/todos/model";

  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CloudOffIcon from "@lucide/svelte/icons/cloud-off";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import FolderInputIcon from "@lucide/svelte/icons/folder-input";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as DropdownMenu from "@/lib/components/ui/dropdown-menu";



  type Props = {
    todo: TTodo;
    lists: ReadonlyArray<TList>;
    syncAvailable: boolean;
    /** Open state, so the row can open the menu from the keyboard. */
    open?: boolean;
    onmoveto: (list: string | null) => void;
    onsync: (synced: boolean) => void;
    /** Called after the menu closes, to put focus back on the row. */
    onclosed: () => void;
  };

  let { todo, lists, syncAvailable, open = $bindable(false), onmoveto, onsync, onclosed }: Props = $props();

  const INBOX = "inbox";
  const currentList = $derived(todo.list !== null && lists.some(list => list.id === todo.list) ? todo.list : INBOX);
  const synced = $derived(todo.location === "sync");
</script>

<!-- More actions for a to-do, so the row itself stays uncluttered. -->
<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon-xs" tabindex={-1} aria-label={i18n.t("menu.more")}>
        <EllipsisIcon />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content
    align="end"
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      onclosed();
    }}
  >
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger>
        <FolderInputIcon />
        {i18n.t("menu.moveTo")}
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        <DropdownMenu.RadioGroup
          value={currentList}
          onValueChange={value => onmoveto(value === INBOX ? null : value)}
        >
          <DropdownMenu.RadioItem value={INBOX}>{i18n.t("lists.inbox")}</DropdownMenu.RadioItem>
          {#each lists as list (list.id)}
            <DropdownMenu.RadioItem value={list.id}>
              {list.emoji === null ? list.name : `${list.emoji} ${list.name}`}
            </DropdownMenu.RadioItem>
          {/each}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>

    {#if syncAvailable}
      <DropdownMenu.Separator />
      <DropdownMenu.Item onSelect={() => onsync(!synced)}>
        {#if synced}
          <CloudOffIcon />
          {i18n.t("menu.keepOnDevice")}
        {:else}
          <CloudIcon />
          {i18n.t("menu.syncIt")}
        {/if}
      </DropdownMenu.Item>
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>
