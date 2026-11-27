<script lang="ts" module>
  // One row menu at a time: opening one (a click, or M on another row) closes the one before.
  let closeOpen: (() => void) | null = null;
</script>

<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TTodo } from "@/lib/todos/model";

  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ClipboardIcon from "@lucide/svelte/icons/clipboard";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CloudOffIcon from "@lucide/svelte/icons/cloud-off";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import EraserIcon from "@lucide/svelte/icons/eraser";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import FolderInputIcon from "@lucide/svelte/icons/folder-input";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LinkIcon from "@lucide/svelte/icons/link";
  import Link2Icon from "@lucide/svelte/icons/link-2";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import PaperclipIcon from "@lucide/svelte/icons/paperclip";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PinIcon from "@lucide/svelte/icons/pin";
  import PinOffIcon from "@lucide/svelte/icons/pin-off";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import SquarePenIcon from "@lucide/svelte/icons/square-pen";
  import SunIcon from "@lucide/svelte/icons/sun";
  import SunsetIcon from "@lucide/svelte/icons/sunset";
  import { untrack } from "svelte";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";

  import * as DropdownMenu from "@/lib/components/ui/dropdown-menu";
  import { Keys } from "@/lib/components/ui/keys";
  import { hints } from "@/lib/hints.svelte";
  import { toast } from "@/lib/toast";
  import { listLabel } from "@/lib/todos/lists";
  import { INBOX, listOf } from "@/lib/todos/view";

  import { attachFiles, pickFiles } from "./Attachments.svelte";
  import { SubMenu } from "./sub-menu.svelte";



  type Props = {
    todo: TTodo;
    lists: ReadonlyArray<TList>;
    syncAvailable: boolean;
    /** Open state, so the row can open the menu from the keyboard. */
    open?: boolean;
    /** Where to open, when not at the ⋯ button: the pointer, for a right-click on the row. */
    anchor?: { getBoundingClientRect: () => DOMRect } | null;
    onmoveto: (list: string | null) => void;
    /** Opens the whole to-do, with nothing covering it. */
    onview: () => void;
    /** Edits the text in place. */
    onedit: () => void;
    /** Edits it all in the full form. */
    oneditfull: () => void;
    /** Moves it to the trash. */
    onremove: () => void;
    onschedule: () => void;
    onrepeat: () => void;
    /** Adds, changes or removes the to-do's link. */
    onlink: () => void;
    /** Whether it's pinned to Today. */
    pinnedToday: boolean;
    ontoday: () => void;
    /** Hides the text, or shows it again. */
    onhidden: (hidden: boolean) => void;
    /** Pins it to the top, or unpins it. */
    onpinned: (pinned: boolean) => void;
    /** Its #tags, each offered as a filter. */
    tags: ReadonlyArray<string>;
    ontag: (tag: string) => void;
    /** Moves it one place up or down, for those who don't drag; not offered in a sorted list. */
    onmove?: (delta: -1 | 1) => void;
    onsync: (synced: boolean) => void;
    /** Called after the menu closes, to put focus back on the row. */
    onclosed: () => void;
  };

  let { todo, lists, syncAvailable, open = $bindable(false), anchor = null, onmoveto, onview, onedit, oneditfull, onremove, onschedule, onrepeat, onlink, pinnedToday, ontoday, onhidden, onpinned, tags, ontag, onmove, onsync, onclosed }: Props = $props();

  // Closed for another menu, the focus stays with that one instead of going back to this row.
  let replaced = false;

  function close(): void {
    replaced = true;
    open = false;
  }

  $effect(() => {
    if (open) {
      replaced = false;

      if (closeOpen !== close) {
        closeOpen?.();
      }

      closeOpen = close;
    }
    else if (closeOpen === close) {
      closeOpen = null;
    }
  });

  // "Move to list" closes once the pointer leaves it and its lists, instead of staying open until hovered and left again.
  const sub = new SubMenu();

  $effect(() => () => sub.dispose());

  // The first time it opens, the menu says how to open it from the keyboard.
  let menuTip = $state(false);

  $effect(() => {
    if (open) {
      untrack(() => {
        menuTip = !hints.isSeen("menu");
        hints.done("menu");
      });
    }
  });

  const currentList = $derived(listOf(todo, lists) ?? INBOX);
  const synced = $derived(todo.location === "sync");

  // Copies the text, or the link, and says so.
  async function copy(text: string, done: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    }
    catch {
      toast.error(i18n.t("errors.unknown"));
    }
  }
</script>

<!-- A row's own keyboard shortcut, at the right end of its menu item. -->
{#snippet keys(label: string)}
  <Keys keys={label} class="ml-auto pl-4 text-muted-foreground" />
{/snippet}

<!-- More actions for a to-do, so the row itself stays uncluttered. -->
<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon-xs" tabindex={-1} tooltip={i18n.t("menu.more")} shortcut="M">
        <EllipsisIcon />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content
    align={anchor === null ? "end" : "start"}
    customAnchor={anchor}
    onCloseAutoFocus={(event) => {
      event.preventDefault();

      if (!replaced) {
        onclosed();
      }

      replaced = false;
    }}
  >
    <DropdownMenu.Item onSelect={onview} aria-keyshortcuts="V">
      <Maximize2Icon />
      {i18n.t("menu.view")}
      {@render keys("V")}
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={onedit} aria-keyshortcuts="Enter">
      <PencilIcon />
      {i18n.t("item.edit")}
      {@render keys("Enter")}
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={oneditfull} aria-keyshortcuts="Control+Enter">
      <SquarePenIcon />
      {i18n.t("item.editFull")}
      {@render keys("Ctrl+Enter")}
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={() => void copy(todo.text, i18n.t("menu.copied"))} aria-keyshortcuts="Control+C">
      <ClipboardIcon />
      {i18n.t("menu.copy")}
      {@render keys("Ctrl+C")}
    </DropdownMenu.Item>
    {#if todo.source !== null}
      <DropdownMenu.Item onSelect={() => void copy(todo.source!.url, i18n.t("menu.linkCopied"))}>
        <Link2Icon />
        {i18n.t("menu.copyLink")}
      </DropdownMenu.Item>
    {/if}
    <DropdownMenu.Item onSelect={() => onpinned(!todo.pinned)} aria-keyshortcuts="P">
      {#if todo.pinned}
        <PinOffIcon />
        {i18n.t("menu.unpin")}
      {:else}
        <PinIcon />
        {i18n.t("menu.pin")}
      {/if}
      {@render keys("P")}
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
    <DropdownMenu.Item onSelect={async () => attachFiles(todo.id, await pickFiles())}>
      <PaperclipIcon />
      {i18n.t("attach.menu")}
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
        {i18n.t("menu.openSource")}<span class="sr-only"> ({i18n.t("link.newTab")})</span>
      </DropdownMenu.Item>
    {/if}
    <DropdownMenu.Separator />
    {#if onmove !== undefined}
      <DropdownMenu.Item onSelect={() => onmove(-1)} aria-keyshortcuts="Alt+ArrowUp">
        <ArrowUpIcon />
        {i18n.t("menu.moveUp")}
        {@render keys("Alt+↑")}
      </DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => onmove(1)} aria-keyshortcuts="Alt+ArrowDown">
        <ArrowDownIcon />
        {i18n.t("menu.moveDown")}
        {@render keys("Alt+↓")}
      </DropdownMenu.Item>
    {/if}
    <DropdownMenu.Sub bind:open={sub.open}>
      <DropdownMenu.SubTrigger {...sub.trigger}>
        <FolderInputIcon />
        {i18n.t("menu.moveTo")}
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent {...sub.content}>
        <DropdownMenu.RadioGroup
          value={currentList}
          onValueChange={value => onmoveto(value === INBOX ? null : value)}
        >
          <DropdownMenu.RadioItem value={INBOX}>{i18n.t("lists.inbox")}</DropdownMenu.RadioItem>
          {#each lists as list (list.id)}
            <DropdownMenu.RadioItem value={list.id}>
              {listLabel(list)}
            </DropdownMenu.RadioItem>
          {/each}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>

    {#if syncAvailable}
      <DropdownMenu.Separator />
      <DropdownMenu.Item onSelect={() => onsync(!synced)} aria-keyshortcuts="S">
        {#if synced}
          <CloudOffIcon />
          {i18n.t("menu.keepOnDevice")}
        {:else}
          <CloudIcon />
          {i18n.t("menu.syncIt")}
        {/if}
        {@render keys("S")}
      </DropdownMenu.Item>
    {/if}
    {#if tags.length > 0}
      <DropdownMenu.Separator />
      {#each tags as tag (tag)}
        <DropdownMenu.Item onSelect={() => ontag(tag)}>
          <HashIcon />
          {i18n.t("tags.chip", [tag])}
        </DropdownMenu.Item>
      {/each}
    {/if}
    <DropdownMenu.Separator />
    <DropdownMenu.Item variant="destructive" onSelect={onremove} aria-keyshortcuts="Delete">
      <EraserIcon />
      {i18n.t("item.delete")}
      {@render keys("Del")}
    </DropdownMenu.Item>
    {#if menuTip}
      <DropdownMenu.Separator />
      <p class="max-w-52 px-1.5 py-1 text-[11.5px] leading-snug font-semibold text-muted-foreground" data-menu-tip>{i18n.t("hints.menu")}</p>
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>
