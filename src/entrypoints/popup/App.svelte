<script lang="ts">
  import type { TTodo } from "@/lib/todos/model";

  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { i18n } from "#i18n";

  import AppHeader from "@/lib/components/AppHeader.svelte";
  import EmptyState from "@/lib/components/EmptyState.svelte";
  import StatusFooter from "@/lib/components/StatusFooter.svelte";
  import TodoInput from "@/lib/components/TodoInput.svelte";
  import TodoList from "@/lib/components/TodoList.svelte";
  import { Toaster } from "@/lib/components/ui/sonner";
  import * as Tooltip from "@/lib/components/ui/tooltip";
  import { errorMessage, truncate } from "@/lib/messages";
  import { createTodoRepository } from "@/lib/todos/sync-repository";
  import { TodoStore } from "@/lib/todos/todos.svelte";



  const UNDO_MS = 6_000;

  const store = new TodoStore(createTodoRepository());

  let input = $state<TodoInput | null>(null);
  let list = $state<TodoList | null>(null);
  let undoLast: (() => Promise<void>) | null = null;

  onMount(() => {
    let stop: (() => void) | undefined;

    void store.start().then((unsubscribe) => {
      stop = unsubscribe;
    });

    return () => stop?.();
  });

  // Every refusal or failure from the store becomes a toast.
  $effect(() => {
    const error = store.error;

    if (error !== null) {
      toast.error(errorMessage(error));
      store.dismissError();
    }
  });

  function offerUndo(message: string, todos: ReadonlyArray<TTodo>): void {
    let toastId: string | number | undefined;

    const undo = async (): Promise<void> => {
      undoLast = null;
      toast.dismiss(toastId);
      await store.restore(todos);
    };

    toastId = toast(message, {
      duration: UNDO_MS,
      action: { label: i18n.t("toast.undo"), onClick: () => void undo() },
      onAutoClose: () => {
        if (undoLast === undo) {
          undoLast = null;
        }
      },
    });

    undoLast = undo;
  }

  async function add(text: string): Promise<boolean> {
    return (await store.add(text)) !== undefined;
  }

  async function remove(todo: TTodo): Promise<void> {
    const removed = await store.remove(todo.id);

    if (removed) {
      offerUndo(i18n.t("toast.deleted", [truncate(removed.text)]), [removed]);
    }
  }

  async function clearCompleted(): Promise<void> {
    const removed = await store.clearCompleted();

    if (removed !== undefined && removed.length > 0) {
      offerUndo(i18n.t("toast.cleared", removed.length), removed);
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable === true;

    if (typing) {
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
      input?.focus();
    }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && undoLast !== null) {
      event.preventDefault();
      void undoLast();
    }
  }
</script>

<svelte:window {onkeydown} />

<Tooltip.Provider delayDuration={400}>
  <div class="flex h-[560px] max-h-[600px] flex-col">
    <AppHeader done={store.completed} total={store.todos.length} ready={store.ready} />

    <!-- Two stacked sheets, like the icon: a tilted one behind, the notepad page in front. -->
    <main class="relative mx-3 flex min-h-0 flex-1 flex-col">
      <div class="absolute inset-0 translate-x-[5px] translate-y-[5px] rotate-[1.4deg] rounded-[6px] border-2 border-border bg-sheet-back" aria-hidden="true"></div>

      <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border-2 border-border bg-sheet shadow-sticker">
        <TodoInput bind:this={input} onadd={add} onnavigatedown={() => list?.focusFirst()} />

        {#if store.ready && store.todos.length === 0 && store.trash.length === 0}
          <EmptyState />
        {:else}
          <TodoList
            bind:this={list}
            {store}
            onremove={remove}
            onclear={() => void clearCompleted()}
            onexitup={() => input?.focus()}
          />
        {/if}
      </div>
    </main>

    <StatusFooter status={store.status} />
  </div>

  <Toaster position="bottom-center" offset={58} />
</Tooltip.Provider>
