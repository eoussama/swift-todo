<script lang="ts">
  import type { DndEvent } from "svelte-dnd-action";
  import type { TTodo } from "@/lib/todos/model";
  import type { TStage, TStatus } from "@/lib/todos/status";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import CircleIcon from "@lucide/svelte/icons/circle";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import EraserIcon from "@lucide/svelte/icons/eraser";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import { tick } from "svelte";
  import { dragHandleZone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { SvelteMap } from "svelte/reactivity";
  import { i18n } from "#i18n";

  import { ConfirmTwice } from "@/lib/components/confirm.svelte";
  import { Button } from "@/lib/components/ui/button";

  import { toDateString } from "@/lib/time/date";
  import { sortTodos } from "@/lib/todos/sort";
  import { statusOf } from "@/lib/todos/status";
  import { moveAnchor, pinnedFirst } from "@/lib/todos/view";

  import SectionHeader from "./SectionHeader.svelte";
  import TodoItem from "./TodoItem.svelte";
  import TrashItem from "./TrashItem.svelte";



  type TItem = TTodo & { isDndShadowItem?: boolean };
  /** The sections that drag: to do, and in progress. Done ones don't. */
  type TZone = "todo" | "doing";

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
    /** Edits it in the full form, maybe with the text typed in the row so far. */
    oneditfull: (todo: TTodo, text?: string) => void;
    onlink: (todo: TTodo) => void;
    /** A repeating to-do was checked off and moved to its next date. */
    onrescheduled: (todo: TTodo, next: string) => void;
    /** The current moment, from the popup's clock. */
    now: Date;
  };

  const { store, onremove, onclear, onexitup, onschedule, onrepeat, onview, oneditfull, onlink, onrescheduled, now }: Props = $props();

  const FLIP_MS = 150;
  const COLLAPSED_KEY = "swift-todo:done-collapsed";
  const TODO_FOLDED_KEY = "swift-todo:todo-collapsed";
  const DOING_FOLDED_KEY = "swift-todo:doing-collapsed";
  const TRASH_FOLDED_KEY = "swift-todo:trash-folded";

  // To do and in progress follow the store, except during a drag: the drag library owns
  // its section then, and swapping it out underneath (say, when a sync write lands) breaks it.
  let dragging = $state<TZone | null>(null);
  const zones = $state<Record<TZone, Array<TItem>>>({ todo: [], doing: [] });
  let active = $state(0);
  let announcement = $state("");
  let container = $state<HTMLElement | null>(null);
  // Each section folds away from its title, remembered on this device.
  let collapsed = $state(readFolded(COLLAPSED_KEY, false));
  let todoFolded = $state(readFolded(TODO_FOLDED_KEY, false));
  let doingFolded = $state(readFolded(DOING_FOLDED_KEY, false));
  // The trash starts folded: it's there when needed, out of the way otherwise.
  let trashFolded = $state(readFolded(TRASH_FOLDED_KEY, true));
  // Emptying the trash is permanent, so it takes a second click within a few seconds.
  const emptying = new ConfirmTwice();

  $effect(() => () => emptying.dispose());

  // Just-checked to-dos stay in their section for a moment, so the check and the strike
  // can draw before they move down to "Done".
  const LINGER_MS = 650;
  const lingering = new SvelteMap<string, TZone>();

  // A list sorted by hand can be dragged and moved; sorted otherwise, the sort decides.
  const manual = $derived(store.sort === "manual");

  // The section a to-do shows in: its status, or the one it was just checked off from.
  const sectionOf = (todo: TTodo): TZone | "done" => lingering.get(todo.id) ?? statusOf(todo);
  // Each section in order (pinned first, then by the list's sort); positions are still shared across all lists.
  const arranged = (section: TZone | "done"): Array<TTodo> => pinnedFirst(sortTodos(store.visible.filter(todo => sectionOf(todo) === section), store.sort));

  const done = $derived(arranged("done"));
  // To do has a title of its own once there's another section to tell it from.
  const todoTitled = $derived(zones.todo.length > 0 && (zones.doing.length > 0 || done.length > 0));
  const shown = $derived({
    todo: todoTitled && todoFolded ? [] : zones.todo,
    doing: doingFolded ? [] : zones.doing,
    done: collapsed ? [] : done,
  });
  // Every row on show, in order; the keyboard moves through them all.
  const visible = $derived([...shown.todo, ...shown.doing, ...shown.done]);
  const syncAvailable = $derived(store.status.mode === "sync");

  $effect.pre(() => {
    for (const zone of ["todo", "doing"] as const) {
      const todos = arranged(zone);

      if (dragging !== zone) {
        zones[zone] = todos;
      }
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

  function toggleTodo(): void {
    todoFolded = !todoFolded;
    saveFolded(TODO_FOLDED_KEY, todoFolded);
  }

  function toggleDoing(): void {
    doingFolded = !doingFolded;
    saveFolded(DOING_FOLDED_KEY, doingFolded);
  }

  function toggleTrash(): void {
    trashFolded = !trashFolded;
    saveFolded(TRASH_FOLDED_KEY, trashFolded);
  }

  async function emptyTrash(): Promise<void> {
    if (emptying.press()) {
      await store.emptyTrash();
    }
  }

  // Shift (held to see whole to-dos) turns the wheel sideways, and Ctrl zooms; the list only
  // scrolls up and down, so with either held for that, the wheel still scrolls it.
  function onwheel(event: WheelEvent): void {
    const peeking = document.documentElement.dataset.peek !== undefined;
    const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;

    if (container === null || delta === 0 || !(event.shiftKey || peeking)) {
      return;
    }

    event.preventDefault();
    // Lines, pages or pixels.
    container.scrollTop += delta * ([1, 22, container.clientHeight][event.deltaMode] ?? 1);
  }

  /** Moves focus to the first to-do. */
  export function focusFirst(): void {
    focusRow(0);
  }

  /**
   * Scrolls a to-do into view, as just added at the end of the list. One the
   * current list or tag doesn't show stays out of view.
   *
   * @param id The to-do's ID.
   */
  export function reveal(id: string): void {
    const element = container?.querySelector(`[data-todo-id="${CSS.escape(id)}"]`);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    element?.scrollIntoView({ block: "nearest", behavior: still ? "instant" : "smooth" });
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

  function focusTodo(id: string): void {
    const index = visible.findIndex(item => item.id === id);

    if (index !== -1) {
      focusRow(index);
    }
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
    const where = sectionOf(todo);
    const section = where === "done" ? done : zones[where];
    const position = section.findIndex(item => item.id === todo.id);
    const neighbor = section[position + delta];

    // Pinned and unpinned to-dos are sorted apart; moving stops at the edge between them.
    if (neighbor === undefined || neighbor.pinned !== todo.pinned) {
      return;
    }

    const to = storeIndex(todo.id, delta === 1 ? { after: neighbor.id } : { before: neighbor.id });

    await store.move(todo.id, to);
    await tick();
    focusRow(index + delta);
    announce(i18n.t("list.moved", [String(position + delta + 1), String(section.length)]));
  }

  // From the menu, the stage chip, or I: done this way, it lingers like checked off.
  async function setStatus(todo: TTodo, status: TStatus, stage: TStage | null): Promise<void> {
    const from = statusOf(todo);
    // It moves to another section, as a new row there; the focus goes along with it.
    const hadFocus = document.activeElement?.getAttribute("data-todo-id") === todo.id;

    if (status === "done" && from !== "done") {
      lingering.set(todo.id, from);
    }

    const next = await store.setStatus(todo.id, status, stage);

    if (typeof next === "string") {
      onrescheduled(todo, next);
    }

    if (hadFocus) {
      await tick();
      focusTodo(todo.id);
    }

    if (lingering.has(todo.id)) {
      await new Promise(resolve => setTimeout(resolve, LINGER_MS));

      const stillFocused = document.activeElement?.getAttribute("data-todo-id") === todo.id;

      lingering.delete(todo.id);

      if (stillFocused) {
        await tick();
        focusTodo(todo.id);
      }
    }
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
    const from = statusOf(todo);
    const checking = from !== "done" && todo.repeat === null;
    const hadFocus = focused();

    if (from !== "done" && checking) {
      lingering.set(todo.id, from);
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

  function consider(zone: TZone, event: CustomEvent<DndEvent<TItem>>): void {
    dragging = zone;
    zones[zone] = event.detail.items;
  }

  async function finalize(zone: TZone, event: CustomEvent<DndEvent<TItem>>): Promise<void> {
    const items = event.detail.items;

    zones[zone] = items;
    dragging = null;

    const id = event.detail.info.id;
    const position = items.findIndex(item => item.id === id);

    if (position === -1) {
      return;
    }

    const anchor = moveAnchor(items, position);
    const to = anchor === null ? -1 : storeIndex(id, anchor);

    if (to !== -1) {
      await store.move(id, to);
      active = (zone === "doing" ? shown.todo.length : 0) + position;
    }
  }
</script>

<div bind:this={container} class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" {onwheel}>
  {#if todoTitled}
    <SectionHeader
      label={i18n.t("list.todo", [String(zones.todo.length)])}
      icon={CircleIcon}
      expanded={!todoFolded}
      controls="todo-list"
      ontoggle={toggleTodo}
    />
  {/if}
  {@render zone("todo", "todo-list", i18n.t("list.label"), 0)}

  {#if zones.doing.length > 0}
    <SectionHeader
      label={i18n.t("list.doing", [String(zones.doing.length)])}
      icon={CircleDashedIcon}
      expanded={!doingFolded}
      controls="doing-list"
      ontoggle={toggleDoing}
    />
    {@render zone("doing", "doing-list", i18n.t("list.doingLabel"), shown.todo.length)}
  {/if}

  <!-- To do, or in progress: rows dragged into place within their section (but not from one to another). -->
  {#snippet zone(name: TZone, id: string, label: string, offset: number)}
    {#if shown[name].length > 0 || (name === "todo" && !todoTitled)}
      <ul
        {id}
        aria-label={label}
        use:dragHandleZone={{
          items: zones[name],
          type: name,
          flipDurationMs: FLIP_MS,
          zoneTabIndex: -1,
          zoneItemTabIndex: -1,
          autoAriaDisabled: true,
          dropTargetStyle: {},
          dragDisabled: !manual,
        }}
        onconsider={event => consider(name, event)}
        onfinalize={event => void finalize(name, event)}
      >
        {#each zones[name] as todo, index (todo.id)}
          <li animate:flip={{ duration: FLIP_MS }}>
            {@render item(todo, offset + index, manual)}
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  <!-- A row, open or done; its place counts across both lists, for the keyboard. -->
  {#snippet item(todo: TItem, index: number, draggable: boolean)}
    <TodoItem
      {todo}
      {syncAvailable}
      {draggable}
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
      oneditfull={text => oneditfull(todo, text)}
      stages={store.prefs.stages}
      onstatus={(status, stage) => void setStatus(todo, status, stage)}
      onlink={() => onlink(todo)}
      ontoday={pin => void store.update(todo.id, { today: pin ? toDateString(now) : null })}
      onhidden={hidden => void store.update(todo.id, { hidden })}
      onpinned={pinned => void store.update(todo.id, { pinned })}
      onshowtoday={() => void store.setFilter("today")}
      onmove={manual ? delta => void move(todo, index, delta) : undefined}
      onnavigate={target => navigate(index, target)}
    />
  {/snippet}

  {#if zones.todo.length === 0 && zones.doing.length === 0 && done.length === 0}
    <!-- Nothing left but the trash. -->
    <p class="margin-line border-b border-rule bg-sheet py-[9px] pl-[52px] font-hand text-[21px] leading-[26px] font-bold text-muted-foreground">{store.todos.length > 0 ? i18n.t("lists.emptyList") : i18n.t("empty.title")}</p>
  {/if}

  {#if done.length > 0}
    <SectionHeader
      label={i18n.t("list.done", [String(done.length)])}
      icon={CircleCheckIcon}
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
          <li animate:flip={{ duration: FLIP_MS }}>
            {@render item(todo, shown.todo.length + shown.doing.length + j, false)}
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
          class={emptying.armed ? "bg-destructive-soft text-destructive" : ""}
          onclick={emptyTrash}
          aria-describedby="empty-trash-hint"
        >
          <TrashIcon />
          {emptying.armed ? i18n.t("list.emptyTrashConfirm") : i18n.t("list.emptyTrash")}
        </Button>
        <span id="empty-trash-hint" class="sr-only" role="status">{emptying.armed ? i18n.t("list.emptyTrashHint") : ""}</span>
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
