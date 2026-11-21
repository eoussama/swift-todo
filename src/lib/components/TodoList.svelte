<script lang="ts">
  import type { DndEvent } from "svelte-dnd-action";
  import type { TTodo } from "@/lib/todos/model";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import EraserIcon from "@lucide/svelte/icons/eraser";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import { tick } from "svelte";
  import { dragHandleZone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { SvelteSet } from "svelte/reactivity";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { toDateString } from "@/lib/time/date";

  import SectionHeader from "./SectionHeader.svelte";
  import TodoItem from "./TodoItem.svelte";
  import TrashItem from "./TrashItem.svelte";



  type TItem = TTodo & { isDndShadowItem?: boolean };

  type Props = {
    store: TodoStore;
    /** Deletes the to-do and offers undo. */
    onremove: (todo: TTodo) => Promise<void>;
    /** Erases every done to-do and offers undo. */
    onclear: () => void;
    /** Called on Arrow Up from the first row, to move focus back to the input. */
    onexitup: () => void;
    onschedule: (todo: TTodo) => void;
    onrepeat: (todo: TTodo) => void;
    onview: (todo: TTodo) => void;
    onlink: (todo: TTodo) => void;
    /** A repeating to-do was checked off and moved to its next date. */
    onrescheduled: (todo: TTodo, next: string) => void;
    /** The current moment, from the popup's clock. */
    now: Date;
  };

  const { store, onremove, onclear, onexitup, onschedule, onrepeat, onview, onlink, onrescheduled, now }: Props = $props();

  const FLIP_MS = 150;
  const COLLAPSED_KEY = "swift-todo:done-collapsed";
  const TRASH_FOLDED_KEY = "swift-todo:trash-folded";

  // Open to-dos follow the store, except during a drag: the drag library owns
  // the list then, and swapping it out underneath (say, when a sync write lands) breaks it.
  let dragging = $state(false);
  let open = $state<Array<TItem>>([]);
  let active = $state(0);
  let announcement = $state("");
  let container = $state<HTMLElement | null>(null);
  let collapsed = $state(readFolded(COLLAPSED_KEY, false));
  // The trash starts folded: it's there when needed, out of the way otherwise.
  let trashFolded = $state(readFolded(TRASH_FOLDED_KEY, true));
  let confirmingEmpty = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  // Just-checked to-dos stay in place for a moment, so the check and the strike
  // can draw before they move down to "Done".
  const LINGER_MS = 650;
  const lingering = new SvelteSet<string>();

  // The current list and tag's to-dos; positions are still shared across all lists.
  const done = $derived(store.visible.filter(todo => todo.done && !lingering.has(todo.id)));
  const visible = $derived(collapsed ? open : [...open, ...done]);
  const syncAvailable = $derived(store.status.mode === "sync");

  $effect.pre(() => {
    const todos = store.visible.filter(todo => !todo.done || lingering.has(todo.id));

    if (!dragging) {
      open = todos;
    }
  });

  // Folded sections are a UI preference for this device only, so plain localStorage is enough.
  function readFolded(key: string, fallback: boolean): boolean {
    try {
      const value = localStorage.getItem(key);

      return value === null ? fallback : value === "1";
    }
    catch {
      return fallback;
    }
  }

  function saveFolded(key: string, folded: boolean): void {
    try {
      localStorage.setItem(key, folded ? "1" : "0");
    }
    catch {}
  }

  function toggleCollapsed(): void {
    collapsed = !collapsed;
    saveFolded(COLLAPSED_KEY, collapsed);
  }

  function toggleTrash(): void {
    trashFolded = !trashFolded;
    saveFolded(TRASH_FOLDED_KEY, trashFolded);
  }

  // Emptying the trash is permanent, so it takes a second click within a few seconds.
  async function emptyTrash(): Promise<void> {
    clearTimeout(confirmTimer);

    if (!confirmingEmpty) {
      confirmingEmpty = true;
      confirmTimer = setTimeout(() => (confirmingEmpty = false), 3_000);

      return;
    }

    confirmingEmpty = false;
    await store.emptyTrash();
  }

  /** Moves focus to the first to-do. */
  export function focusFirst(): void {
    focusRow(0);
  }

  // Rows in DOM order, which matches `visible` once rendered.
  function rowAt(index: number): HTMLElement | undefined {
    return container?.querySelectorAll<HTMLElement>("[data-todo-row]")[index];
  }

  function focusRow(index: number): void {
    if (visible.length === 0) {
      onexitup();

      return;
    }

    active = Math.max(0, Math.min(index, visible.length - 1));
    rowAt(active)?.focus();
  }

  function navigate(index: number, target: "previous" | "next" | "first" | "last"): void {
    if (target === "previous" && index === 0) {
      onexitup();

      return;
    }

    focusRow({ previous: index - 1, next: index + 1, first: 0, last: visible.length - 1 }[target]);
  }

  function announce(message: string): void {
    // Clear first so the same message is read again.
    announcement = "";
    void tick().then(() => {
      announcement = message;
    });
  }

  /**
   * Turns "put this to-do right after (or before) that one" into the index the
   * store expects: its position among all the other to-dos.
   *
   * @param id The to-do being moved.
   * @param anchor The to-do it should end up right after, or right before.
   * @returns The index for `store.move`.
   */
  function storeIndex(id: string, anchor: { after: string } | { before: string }): number {
    const rest = store.todos.filter(todo => todo.id !== id);

    return "after" in anchor
      ? rest.findIndex(todo => todo.id === anchor.after) + 1
      : rest.findIndex(todo => todo.id === anchor.before);
  }

  // Alt + arrows: swap places with the neighbor in the same section.
  async function move(todo: TTodo, index: number, delta: -1 | 1): Promise<void> {
    const section = todo.done ? done : open;
    const position = section.findIndex(item => item.id === todo.id);
    const neighbor = section[position + delta];

    if (neighbor === undefined) {
      return;
    }

    const to = storeIndex(todo.id, delta === 1 ? { after: neighbor.id } : { before: neighbor.id });

    await store.move(todo.id, to);
    await tick();
    focusRow(index + delta);
    announce(i18n.t("list.moved", [String(position + delta + 1), String(section.length)]));
  }

  async function remove(todo: TTodo, index: number): Promise<void> {
    const hadFocus = container?.contains(document.activeElement) ?? false;

    await onremove(todo);
    await tick();

    if (hadFocus) {
      focusRow(Math.min(index, visible.length - 1));
    }
  }

  async function toggle(todo: TTodo, index: number): Promise<void> {
    const focused = (): boolean => document.activeElement?.getAttribute("data-todo-id") === todo.id;
    // A repeating to-do moves to its next date instead of to "Done", so it doesn't linger.
    const checking = !todo.done && todo.repeat === null;
    const hadFocus = focused();

    if (checking) {
      lingering.add(todo.id);
    }

    const next = await store.toggle(todo.id);

    if (typeof next === "string") {
      onrescheduled(todo, next);
    }

    if (checking) {
      await new Promise(resolve => setTimeout(resolve, LINGER_MS));

      const stillFocused = focused();

      lingering.delete(todo.id);
      await tick();

      // It moved down to "Done"; keep focus on the same spot in the list.
      if (stillFocused) {
        focusRow(Math.min(index, visible.length - 1));
      }

      return;
    }

    await tick();

    if (hadFocus) {
      focusRow(Math.min(index, visible.length - 1));
    }
  }

  function consider(event: CustomEvent<DndEvent<TItem>>): void {
    dragging = true;
    open = event.detail.items;
  }

  async function finalize(event: CustomEvent<DndEvent<TItem>>): Promise<void> {
    open = event.detail.items;
    dragging = false;

    const id = event.detail.info.id;
    const position = open.findIndex(item => item.id === id);

    if (position === -1) {
      return;
    }

    const previous = open[position - 1];
    const next = open[position + 1];
    const to = previous !== undefined
      ? storeIndex(id, { after: previous.id })
      : next !== undefined ? storeIndex(id, { before: next.id }) : -1;

    if (to !== -1) {
      await store.move(id, to);
      active = position;
    }
  }
</script>

<div bind:this={container} class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
  <ul
    aria-label={i18n.t("list.label")}
    use:dragHandleZone={{
      items: open,
      flipDurationMs: FLIP_MS,
      zoneTabIndex: -1,
      zoneItemTabIndex: -1,
      autoAriaDisabled: true,
      dropTargetStyle: {},
    }}
    onconsider={consider}
    onfinalize={finalize}
  >
    {#each open as todo, index (todo.id)}
      <li animate:flip={{ duration: FLIP_MS }}>
        <TodoItem
          {todo}
          {syncAvailable}
          draggable
          tabindex={index === Math.min(active, visible.length - 1) ? 0 : -1}
          onfocus={() => (active = index)}
          ontoggle={() => void toggle(todo, index)}
          onsave={text => void store.update(todo.id, { text })}
          onremove={() => void remove(todo, index)}
          onsync={synced => void store.setSynced(todo.id, synced)}
          lists={store.lists}
          onmoveto={list => void store.update(todo.id, { list })}
          ontag={tag => store.setTagFilter(tag)}
          {now}
          onschedule={() => onschedule(todo)}
          onrepeat={() => onrepeat(todo)}
          onview={() => onview(todo)}
          onlink={() => onlink(todo)}
          ontoday={pin => void store.update(todo.id, { today: pin ? toDateString(now) : null })}
          onhidden={hidden => void store.update(todo.id, { hidden })}
          onmove={delta => void move(todo, index, delta)}
          onnavigate={target => navigate(index, target)}
        />
      </li>
    {/each}
  </ul>

  {#if open.length === 0 && done.length === 0}
    <!-- Nothing left but the trash. -->
    <p class="margin-line border-b border-rule bg-sheet py-[9px] pl-[52px] font-hand text-[21px] leading-[26px] font-bold text-muted-foreground">{store.todos.length > 0 ? i18n.t("lists.emptyList") : i18n.t("empty.title")}</p>
  {/if}

  {#if done.length > 0}
    <SectionHeader
      label={i18n.t("list.done", [String(done.length)])}
      expanded={!collapsed}
      controls="done-list"
      ontoggle={toggleCollapsed}
    >
      {#snippet action()}
        <Button variant="ghost" size="sm" aria-label={i18n.t("list.eraseDoneLabel")} onclick={onclear}>
          <EraserIcon />
          {i18n.t("list.eraseDone")}
        </Button>
      {/snippet}
    </SectionHeader>

    {#if !collapsed}
      <ul id="done-list" aria-label={i18n.t("list.doneLabel")}>
        {#each done as todo, j (todo.id)}
          {@const index = open.length + j}
          <li animate:flip={{ duration: FLIP_MS }}>
            <TodoItem
              {todo}
              {syncAvailable}
              draggable={false}
              tabindex={index === Math.min(active, visible.length - 1) ? 0 : -1}
              onfocus={() => (active = index)}
              ontoggle={() => void toggle(todo, index)}
              onsave={text => void store.update(todo.id, { text })}
              onremove={() => void remove(todo, index)}
              onsync={synced => void store.setSynced(todo.id, synced)}
              lists={store.lists}
              onmoveto={list => void store.update(todo.id, { list })}
              ontag={tag => store.setTagFilter(tag)}
              {now}
              onschedule={() => onschedule(todo)}
              onrepeat={() => onrepeat(todo)}
              onview={() => onview(todo)}
              onlink={() => onlink(todo)}
              ontoday={pin => void store.update(todo.id, { today: pin ? toDateString(now) : null })}
              onhidden={hidden => void store.update(todo.id, { hidden })}
              onmove={delta => void move(todo, index, delta)}
              onnavigate={target => navigate(index, target)}
            />
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  {#if store.trash.length > 0}
    <SectionHeader
      label={i18n.t("list.trash", [String(store.trash.length)])}
      icon={TrashIcon}
      expanded={!trashFolded}
      controls="trash-list"
      ontoggle={toggleTrash}
    >
      {#snippet action()}
        <Button
          variant="destructive"
          size="sm"
          class={confirmingEmpty ? "bg-destructive-soft text-destructive" : ""}
          onclick={emptyTrash}
        >
          <TrashIcon />
          {confirmingEmpty ? i18n.t("list.emptyTrashConfirm") : i18n.t("list.emptyTrash")}
        </Button>
      {/snippet}
    </SectionHeader>

    {#if !trashFolded}
      <ul id="trash-list" aria-label={i18n.t("list.trashLabel")}>
        {#each store.trash as todo (todo.id)}
          <li>
            <TrashItem
              {todo}
              onrestore={() => void store.restoreFromTrash(todo.id)}
              ondelete={() => void store.deleteForever(todo.id)}
            />
          </li>
        {/each}
      </ul>
      <p class="margin-line border-b border-rule bg-sheet py-2 pr-3 pl-[52px] text-xs font-semibold text-muted-foreground">{i18n.t("list.trashHint")}</p>
    {/if}
  {/if}

  <!-- The rest of the page: empty ruled lines. -->
  <div class="ruled min-h-11 flex-1" aria-hidden="true"></div>
</div>

<div class="sr-only" aria-live="polite">{announcement}</div>
