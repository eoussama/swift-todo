<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TListFilter } from "@/lib/todos/view";

  import PlusIcon from "@lucide/svelte/icons/plus";
  import { tick } from "svelte";
  import { i18n } from "#i18n";

  import { MAX_LISTS } from "@/lib/todos/lists";
  import { mergeProps } from "@/lib/utils";

  import Tip from "./Tip.svelte";



  type Props = {
    lists: ReadonlyArray<TList>;
    active: TListFilter;
    onselect: (filter: TListFilter) => void;
    /** Creates a list; resolves to it, or `undefined` when refused. */
    onadd: (name: string) => Promise<TList | undefined>;
  };

  const { lists, active, onselect, onadd }: Props = $props();

  type TTab = { id: TListFilter; label: string };

  const tabs = $derived<Array<TTab>>([
    { id: "all", label: i18n.t("lists.all") },
    { id: "today", label: i18n.t("focus.today") },
    { id: "inbox", label: i18n.t("lists.inbox") },
    ...lists.map(list => ({ id: list.id, label: list.emoji === null ? list.name : `${list.emoji} ${list.name}` })),
  ]);

  let strip = $state<HTMLElement | null>(null);
  let adding = $state(false);

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
  let name = $state("");
  let input = $state<HTMLInputElement | null>(null);

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

  // Arrow keys move between tabs, as in the WAI-ARIA tabs pattern.
  function onkeydown(event: KeyboardEvent, index: number): void {
    const last = tabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];

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

    adding = false;

    if (save && name.trim().length > 0) {
      const list = await onadd(name);

      if (list !== undefined) {
        selectId(list.id);
      }
    }
  }

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
      <button
        type="button"
        role="tab"
        id="tab-{tab.id}"
        aria-selected={selected}
        aria-controls="todo-sheet"
        tabindex={selected ? 0 : -1}
        class={[
          "max-w-36 shrink-0 truncate rounded-t-md border-2 border-b-0 border-border px-2.5 pt-1 pb-1 font-hand text-[18px] leading-none font-bold outline-none focus-visible:focus-ring",
          selected ? "translate-y-(--tab-join) bg-sheet pb-[6px] shadow-[inset_0_3px_0_var(--primary)]" : "bg-sheet-back text-muted-foreground hover:text-foreground",
        ]}
        onclick={() => select(index)}
        onkeydown={event => onkeydown(event, index)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if adding}
    <input
      bind:this={input}
      bind:value={name}
      class="w-28 shrink-0 rounded-t-md border-2 border-b-0 border-border bg-sheet px-2 py-0.5 font-hand text-[18px] font-bold outline-none placeholder:text-muted-foreground"
      placeholder={i18n.t("lists.namePlaceholder")}
      aria-label={i18n.t("lists.add")}
      maxlength={32}
      onkeydown={onInputKeydown}
      onblur={() => void finishAdding(true)}
    />
  {:else if lists.length < MAX_LISTS}
    <Tip label={i18n.t("lists.add")}>
      {#snippet children(tip)}
        <button
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
