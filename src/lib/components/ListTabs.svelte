<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TListAction, TListFilter } from "@/lib/todos/view";

  import CheckCheckIcon from "@lucide/svelte/icons/check-check";
  import EraserIcon from "@lucide/svelte/icons/eraser";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import { ContextMenu } from "bits-ui";
  import { onMount, tick } from "svelte";
  import { i18n } from "#i18n";

  import { readDraft, saveDraft } from "@/lib/drafts.svelte";
  import { listLabel, MAX_LIST_NAME_LENGTH, MAX_LISTS } from "@/lib/todos/lists";
  import { mergeProps } from "@/lib/utils";

  import Tip from "./Tip.svelte";



  type Props = {
    lists: ReadonlyArray<TList>;
    active: TListFilter;
    onselect: (filter: TListFilter) => void;
    /** Creates a list; resolves to it, or `undefined` when refused. */
    onadd: (name: string) => Promise<TList | undefined>;
    /** How many to-dos a tab shows, and how many of those are still open. */
    count: (filter: TListFilter) => { total: number; open: number };
    /** Asks to check off or erase a tab's to-dos, or to delete its list (right-click menu). */
    onaction: (action: TListAction, filter: TListFilter, label: string) => void;
  };

  const { lists, active, onselect, onadd, count, onaction }: Props = $props();

  const itemClass = "flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

  type TTab = { id: TListFilter; label: string };

  const tabs = $derived<Array<TTab>>([
    { id: "all", label: i18n.t("lists.all") },
    { id: "today", label: i18n.t("focus.today") },
    { id: "inbox", label: i18n.t("lists.inbox") },
    ...lists.map(list => ({ id: list.id, label: listLabel(list) })),
  ]);

  let strip = $state<HTMLElement | null>(null);
  // A new list's name, still being typed when the popup closed, comes back.
  const kept = readDraft("new-list");
  let adding = $state(typeof kept === "string");

  // Tabs that don't fit fade out at the edge they continue past, instead of being cut off.
  let fadeStart = $state(false);
  let fadeEnd = $state(false);

  const FADE = 28;
  const mask = $derived(`linear-gradient(to right, transparent, #000 ${fadeStart ? FADE : 0}px, #000 calc(100% - ${fadeEnd ? FADE : 0}px), transparent)`);

  function measure(): void {
    if (strip === null) {
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = strip;

    fadeStart = scrollLeft > 1;
    fadeEnd = scrollLeft + clientWidth < scrollWidth - 1;
  }

  // A mouse wheel only scrolls up and down; turn that into scrolling the tabs sideways.
  function onwheel(event: WheelEvent): void {
    if (strip === null || event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY) || strip.scrollWidth <= strip.clientWidth) {
      return;
    }

    event.preventDefault();
    strip.scrollLeft += event.deltaY;
  }

  $effect(() => {
    // Measure again whenever the tabs or the new-list field change what's in the strip.
    void [tabs, adding];
    measure();

    if (strip === null) {
      return;
    }

    // The strip resizing, or the tabs inside it (a late-loading font widens them).
    const observer = new ResizeObserver(measure);

    observer.observe(strip);

    for (const child of strip.children) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  });
  let name = $state(typeof kept === "string" ? kept : "");
  let input = $state<HTMLInputElement | null>(null);
  let addButton = $state<HTMLButtonElement | null>(null);

  // Selects a tab by ID; it may not be rendered yet (a list just created), so focus waits a tick.
  function selectId(id: TListFilter): void {
    onselect(id);
    void tick().then(() => {
      const element = strip?.querySelector<HTMLElement>(`#tab-${CSS.escape(id)}`);

      element?.focus();
      element?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function select(index: number): void {
    const tab = tabs[index];

    if (tab !== undefined) {
      selectId(tab.id);
    }
  }

  // Arrow keys move between tabs, as in the WAI-ARIA tabs pattern; right to left, they swap.
  function onkeydown(event: KeyboardEvent, index: number): void {
    const last = tabs.length - 1;
    const forward = index === last ? 0 : index + 1;
    const back = index === 0 ? last : index - 1;
    const rtl = getComputedStyle(event.currentTarget as Element).direction === "rtl";
    const next = { ArrowRight: rtl ? back : forward, ArrowLeft: rtl ? forward : back, Home: 0, End: last }[event.key];

    if (next !== undefined) {
      event.preventDefault();
      select(next);
    }
  }

  async function startAdding(): Promise<void> {
    adding = true;
    name = "";
    await tick();
    input?.focus();
  }

  async function finishAdding(save: boolean): Promise<void> {
    if (!adding) {
      return;
    }

    // Closed from the keyboard (not by clicking elsewhere), focus has to land somewhere.
    const hadFocus = document.activeElement === input;

    adding = false;

    if (save && name.trim().length > 0) {
      const list = await onadd(name);

      if (list !== undefined) {
        selectId(list.id);

        return;
      }
    }

    if (hadFocus) {
      await tick();
      addButton?.focus();
    }
  }

  $effect(() => {
    saveDraft("new-list", adding ? name : null);
  });

  onMount(() => {
    // After the to-do input has taken the focus, as it does on opening.
    if (adding) {
      void tick().then(() => input?.focus());
    }
  });

  function onInputKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void finishAdding(true);
    }
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      void finishAdding(false);
    }
  }
</script>

<!-- Index tabs sticking out of the top of the sheet. The strip only scrolls sideways; the
     bottom padding and matching negative margin leave room for the selected tab, which
     sits 2px lower to cover the sheet's edge. -->
<div
  class="relative z-10 mx-3 -mb-(--tab-join) flex scroll-px-8 items-end gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 pt-1 pb-(--tab-join) [scrollbar-width:none]"
  style:mask-image={mask}
  bind:this={strip}
  onscroll={measure}
  {onwheel}
>
  <div role="tablist" aria-label={i18n.t("lists.tabsLabel")} class="flex shrink-0 items-end gap-1">
    {#each tabs as tab, index (tab.id)}
      {@const selected = tab.id === active}
      {@const counted = count(tab.id)}
      <!-- Right-click (or the menu key) for what can be done to all of a tab's to-dos at once. -->
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              type="button"
              role="tab"
              id="tab-{tab.id}"
              aria-selected={selected}
              aria-controls="todo-sheet"
              tabindex={selected ? 0 : -1}
              class={[
                "max-w-36 shrink-0 truncate rounded-t-md border-2 border-b-0 border-border px-2.5 pt-1 pb-1 font-hand text-[18px] leading-none font-bold outline-none focus-visible:focus-ring",
                selected ? "translate-y-(--tab-join) bg-sheet pb-[6px] shadow-[inset_0_3px_0_var(--primary)]" : "bg-sheet-back text-muted-foreground hover:text-foreground",
                // Nothing left to do there (empty, or all done): the tab steps back.
                counted.open === 0 && !selected && "border-border/50 opacity-60",
              ]}
              data-quiet={counted.open === 0 ? "" : undefined}
              title={tab.label}
              onclick={() => select(index)}
              onkeydown={event => onkeydown(event, index)}
            >
              {tab.label}
            </button>
          {/snippet}
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            class="z-50 min-w-44 rounded-lg border-2 border-border bg-popover p-1 font-bold text-popover-foreground shadow-sticker outline-none"
            collisionPadding={8}
          >
            <ContextMenu.Item class={itemClass} disabled={counted.open === 0} onSelect={() => onaction("complete", tab.id, tab.label)}>
              <CheckCheckIcon />
              {i18n.t("lists.menu.complete")}
            </ContextMenu.Item>
            <ContextMenu.Item class={itemClass} disabled={counted.total === 0} onSelect={() => onaction("erase", tab.id, tab.label)}>
              <EraserIcon />
              {i18n.t("lists.menu.erase")}
            </ContextMenu.Item>
            {#if lists.some(list => list.id === tab.id)}
              <ContextMenu.Separator class="-mx-1 my-1 h-px bg-border" />
              <ContextMenu.Item class={[itemClass, "text-destructive focus:bg-destructive/10 focus:text-destructive"]} onSelect={() => onaction("delete", tab.id, tab.label)}>
                <TrashIcon />
                {i18n.t("lists.menu.delete")}
              </ContextMenu.Item>
            {/if}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    {/each}
  </div>

  {#if adding}
    <input
      bind:this={input}
      bind:value={name}
      class="w-28 shrink-0 rounded-t-md border-2 border-b-0 border-border bg-sheet px-2 py-0.5 font-hand text-[18px] font-bold outline-none placeholder:text-muted-foreground"
      placeholder={i18n.t("lists.namePlaceholder")}
      aria-label={i18n.t("lists.add")}
      maxlength={MAX_LIST_NAME_LENGTH}
      onkeydown={onInputKeydown}
      onblur={() => {
        // Clicking elsewhere adds it; the popup closing leaves it to finish next time.
        if (document.hasFocus()) {
          void finishAdding(true);
        }
      }}
    />
  {:else if lists.length < MAX_LISTS}
    <Tip label={i18n.t("lists.add")}>
      {#snippet children(tip)}
        <button
          bind:this={addButton}
          {...mergeProps(tip, { onclick: startAdding })}
          type="button"
          class="flex h-7 shrink-0 items-center rounded-t-md border-2 border-b-0 border-dashed border-border/60 px-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:focus-ring"
          aria-label={i18n.t("lists.add")}
        >
          <PlusIcon class="size-4" strokeWidth={3} />
        </button>
      {/snippet}
    </Tip>
  {/if}
</div>
