<script lang="ts">
  import type { DndEvent } from "svelte-dnd-action";
  import type { TTodo } from "@/lib/todos/model";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import { tick } from "svelte";
  import { dragHandleZone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { i18n } from "#i18n";

  import TodoItem from "./TodoItem.svelte";



  type TItem = TTodo & { isDndShadowItem?: boolean };

  type Props = {
    store: TodoStore;
    /** Deletes the to-do and offers undo. */
    onremove: (todo: TTodo) => Promise<void>;
    /** Called on Arrow Up from the first row, to move focus back to the input. */
    onexitup: () => void;
  };

  const { store, onremove, onexitup }: Props = $props();

  const FLIP_MS = 150;

  // Follows the store, except during a drag: the drag library owns the list
  // then, and swapping it out underneath (say, when a sync write lands) breaks it.
  let dragging = $state(false);
  let items = $state<Array<TItem>>([]);
  let active = $state(0);

  $effect.pre(() => {
    const todos = store.todos;

    if (!dragging) {
      items = todos;
    }
  });
  let announcement = $state("");
  let list = $state<HTMLUListElement | null>(null);

  const syncAvailable = $derived(store.status.mode === "sync");

  /** Moves focus to the first to-do. */
  export function focusFirst(): void {
    focusRow(0);
  }

  // Rows in DOM order, which matches `items` once rendered.
  function rowAt(index: number): HTMLElement | undefined {
    return list?.querySelectorAll<HTMLElement>("[data-todo-row]")[index];
  }

  function focusRow(index: number): void {
    if (items.length === 0) {
      onexitup();

      return;
    }

    active = Math.max(0, Math.min(index, items.length - 1));
    rowAt(active)?.focus();
  }

  function navigate(index: number, target: "previous" | "next" | "first" | "last"): void {
    if (target === "previous" && index === 0) {
      onexitup();

      return;
    }

    const next = { previous: index - 1, next: index + 1, first: 0, last: items.length - 1 }[target];

    focusRow(next);
  }

  function announce(message: string): void {
    // Clear first so the same message is read again.
    announcement = "";
    void tick().then(() => {
      announcement = message;
    });
  }

  async function move(todo: TTodo, index: number, delta: -1 | 1): Promise<void> {
    const to = index + delta;

    if (to < 0 || to >= items.length) {
      return;
    }

    await store.move(todo.id, to);
    await tick();
    focusRow(to);
    announce(i18n.t("list.moved", [String(to + 1), String(items.length)]));
  }

  async function remove(todo: TTodo, index: number): Promise<void> {
    const hadFocus = list?.contains(document.activeElement) ?? false;

    await onremove(todo);
    await tick();

    if (hadFocus) {
      focusRow(Math.min(index, items.length - 1));
    }
  }

  function consider(event: CustomEvent<DndEvent<TItem>>): void {
    dragging = true;
    items = event.detail.items;
  }

  async function finalize(event: CustomEvent<DndEvent<TItem>>): Promise<void> {
    items = event.detail.items;
    dragging = false;

    const id = event.detail.info.id;
    const to = items.findIndex(item => item.id === id);

    if (to !== -1) {
      await store.move(id, to);
      active = to;
    }
  }
</script>

<ul
  bind:this={list}
  class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-2"
  aria-label={i18n.t("list.label")}
  use:dragHandleZone={{
    items,
    flipDurationMs: FLIP_MS,
    zoneTabIndex: -1,
    zoneItemTabIndex: -1,
    autoAriaDisabled: true,
    dropTargetStyle: {},
  }}
  onconsider={consider}
  onfinalize={finalize}
>
  {#each items as todo, index (todo.id)}
    <li animate:flip={{ duration: FLIP_MS }}>
      <TodoItem
        {todo}
        {syncAvailable}
        tabindex={index === Math.min(active, items.length - 1) ? 0 : -1}
        onfocus={() => (active = index)}
        ontoggle={() => void store.toggle(todo.id)}
        onsave={text => void store.update(todo.id, { text })}
        onremove={() => void remove(todo, index)}
        onsync={synced => void store.setSynced(todo.id, synced)}
        onmove={delta => void move(todo, index, delta)}
        onnavigate={target => navigate(index, target)}
      />
    </li>
  {/each}
</ul>

<div class="sr-only" aria-live="polite">{announcement}</div>
