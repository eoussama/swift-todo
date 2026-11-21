<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TTodo } from "@/lib/todos/model";

  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ClipboardIcon from "@lucide/svelte/icons/clipboard";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CloudOffIcon from "@lucide/svelte/icons/cloud-off";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import FolderInputIcon from "@lucide/svelte/icons/folder-input";
  import LinkIcon from "@lucide/svelte/icons/link";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import SunIcon from "@lucide/svelte/icons/sun";
  import SunsetIcon from "@lucide/svelte/icons/sunset";
  import { toast } from "svelte-sonner";
  import { browser } from "wxt/browser";
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
    /** Opens the whole to-do, with nothing covering it. */
    onview: () => void;
    onschedule: () => void;
    onrepeat: () => void;
    /** Adds, changes or removes the to-do's link. */
    onlink: () => void;
    /** Whether it's pinned to Today. */
    pinnedToday: boolean;
    ontoday: () => void;
    /** Hides the text, or shows it again. */
    onhidden: (hidden: boolean) => void;
    onsync: (synced: boolean) => void;
    /** Called after the menu closes, to put focus back on the row. */
    onclosed: () => void;
  };

  let { todo, lists, syncAvailable, open = $bindable(false), onmoveto, onview, onschedule, onrepeat, onlink, pinnedToday, ontoday, onhidden, onsync, onclosed }: Props = $props();

  const INBOX = "inbox";
  const currentList = $derived(todo.list !== null && lists.some(list => list.id === todo.list) ? todo.list : INBOX);
  const synced = $derived(todo.location === "sync");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(todo.text);
      toast.success(i18n.t("menu.copied"));
    }
    catch {
      toast.error(i18n.t("errors.unknown"));
    }
  }
</script>

<!-- More actions for a to-do, so the row itself stays uncluttered. -->
<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon-xs" tabindex={-1} tooltip={i18n.t("menu.more")}>
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
    <DropdownMenu.Item onSelect={onview}>
      <Maximize2Icon />
      {i18n.t("menu.view")}
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={() => void copy()}>
      <ClipboardIcon />
      {i18n.t("menu.copy")}
    </DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Item onSelect={onschedule}>
      <CalendarIcon />
      {i18n.t("menu.schedule")}
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={onrepeat}>
      <RepeatIcon />
      {i18n.t("menu.repeat")}
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={() => onhidden(!todo.hidden)}>
      {#if todo.hidden}
        <EyeIcon />
        {i18n.t("menu.showText")}
      {:else}
        <EyeOffIcon />
        {i18n.t("menu.hideText")}
      {/if}
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={onlink}>
      <LinkIcon />
      {todo.source === null ? i18n.t("menu.addLink") : i18n.t("menu.editLink")}
    </DropdownMenu.Item>
    {#if !todo.done}
      <DropdownMenu.Item onSelect={ontoday}>
        {#if pinnedToday}
          <SunsetIcon />
          {i18n.t("menu.removeToday")}
        {:else}
          <SunIcon />
          {i18n.t("menu.addToday")}
        {/if}
      </DropdownMenu.Item>
    {/if}
    {#if todo.source !== null}
      <DropdownMenu.Item onSelect={() => void browser.tabs.create({ url: todo.source!.url })}>
        <ExternalLinkIcon />
        {i18n.t("menu.openSource")}
      </DropdownMenu.Item>
    {/if}
    <DropdownMenu.Separator />
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
