<script lang="ts">
  import type { TTodo } from "@/lib/todos/model";

  import { onMount, tick } from "svelte";
  import { toast } from "svelte-sonner";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { useAppearance } from "@/lib/appearance.svelte";
  import AppHeader from "@/lib/components/AppHeader.svelte";
  import EmptyState from "@/lib/components/EmptyState.svelte";
  import FocusCard from "@/lib/components/FocusCard.svelte";
  import ListTabs from "@/lib/components/ListTabs.svelte";
  import RepeatDialog from "@/lib/components/RepeatDialog.svelte";
  import ScheduleDialog from "@/lib/components/ScheduleDialog.svelte";
  import SettingsPanel from "@/lib/components/settings/SettingsPanel.svelte";
  import StatusFooter from "@/lib/components/StatusFooter.svelte";
  import TagFilter from "@/lib/components/TagFilter.svelte";
  import TodoInput from "@/lib/components/TodoInput.svelte";
  import TodoList from "@/lib/components/TodoList.svelte";
  import { Toaster } from "@/lib/components/ui/sonner";
  import * as Tooltip from "@/lib/components/ui/tooltip";
  import ViewDialog from "@/lib/components/ViewDialog.svelte";
  import { focusQueue } from "@/lib/focus";
  import { FocusTimer } from "@/lib/focus-timer.svelte";
  import { errorMessage, truncate } from "@/lib/messages";
  import { Clock } from "@/lib/time/clock.svelte";
  import { toDateString } from "@/lib/time/date";
  import { formatDue } from "@/lib/time/format";
  import { firstOccurrence } from "@/lib/time/recur";
  import { formatClock, remainingMs } from "@/lib/time/timer";
  import { isInToday } from "@/lib/time/today";
  import { createTodoRepository } from "@/lib/todos/sync-repository";
  import { collectTags } from "@/lib/todos/tags";
  import { TodoStore } from "@/lib/todos/todos.svelte";
  import { listForNew } from "@/lib/todos/view";
  import { createUiState, readFocusMode, readFocusSkipped, saveFocusMode, saveFocusSkipped } from "@/lib/ui-state";



  const UNDO_MS = 6_000;

  // Ticks every minute, so the Today view and due labels stay right while the popup is open.
  const clock = new Clock();
  const store = new TodoStore(createTodoRepository(), { ui: createUiState(), isToday: todo => isInToday(todo, clock.now) });

  const appearance = useAppearance(store);

  // Focus mode: one to-do at a time, with a timer the background keeps running.
  const timer = new FocusTimer(browser.storage.session, browser.storage.onChanged, () => toast(i18n.t("focus.timeUp")));
  const seconds = new Clock();
  let focusing = $state(false);
  let skipped = $state<Array<string>>([]);
  const queue = $derived(focusQueue(store.todos, { visible: store.visible, isToday: todo => isInToday(todo, clock.now), skipped }));
  const queueFromToday = $derived(queue.length > 0 && isInToday(queue[0]!, clock.now));
  const pencilTimer = $derived(timer.timer === null
    ? null
    : {
      elapsed: Math.min(seconds.now.getTime() - timer.timer.startedAt, timer.timer.endsAt - timer.timer.startedAt),
      total: timer.timer.endsAt - timer.timer.startedAt,
      left: formatClock(remainingMs(timer.timer, seconds.now)),
    });

  let settingsOpen = $state(false);

  // The to-do being scheduled or given a repeat, from its row menu.
  let scheduling = $state<TTodo | null>(null);
  let scheduleOpen = $state(false);
  let repeating = $state<TTodo | null>(null);
  let repeatOpen = $state(false);
  // The to-do shown in full, followed by its ID so edits and syncs show while it's open.
  let viewingId = $state<string | null>(null);
  let viewOpen = $state(false);
  const viewing = $derived(viewingId === null ? null : store.todos.find(todo => todo.id === viewingId) ?? null);
  const tags = $derived(collectTags(store.todos));

  let input = $state<TodoInput | null>(null);
  let list = $state<TodoList | null>(null);
  let undoLast: (() => Promise<void>) | null = null;

  onMount(() => {
    const stops: Array<() => void> = [clock.start()];

    void store.start().then(unsubscribe => stops.push(unsubscribe));
    void timer.start().then(unsubscribe => stops.push(unsubscribe));
    void readFocusMode().then(on => (focusing = on), () => {});
    // Where focus mode was in its queue, so skipped to-dos stay skipped after the popup closes.
    void readFocusSkipped().then(ids => (skipped = ids), () => {});

    return () => stops.forEach(stop => stop());
  });

  // The seconds only tick while a timer runs.
  $effect(() => {
    if (timer.timer !== null) {
      seconds.now = new Date();

      return seconds.start(1_000);
    }
  });

  function setFocusing(on: boolean): void {
    focusing = on;
    skipped = [];
    void saveFocusMode(on).catch(() => {});
    void saveFocusSkipped([]).catch(() => {});

    if (!on) {
      void tick().then(() => input?.focus());
    }
  }

  async function focusDone(todo: TTodo): Promise<void> {
    const next = await store.toggle(todo.id);

    if (typeof next === "string") {
      rescheduled(todo, next);
    }
  }

  function focusSkip(todo: TTodo): void {
    skipped = [...skipped.filter(id => id !== todo.id), todo.id];
    void saveFocusSkipped(skipped).catch(() => {});
  }

  // Every refusal or failure from the store becomes a toast.
  $effect(() => {
    const error = store.error;

    if (error !== null) {
      toast.error(errorMessage(error));
      store.dismissError();
    }
  });

  // A toast with Undo, which Ctrl+Z also triggers while it shows.
  function offerUndo(message: string, revert: () => Promise<unknown>): void {
    let toastId: string | number | undefined;

    const undo = async (): Promise<void> => {
      undoLast = null;
      toast.dismiss(toastId);
      await revert();
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

  async function add(text: string, fields: { due: string | null; repeat: string | null }): Promise<boolean> {
    // Added in the Today view, an undated to-do is pinned there.
    const today = store.activeFilter === "today" && fields.due === null ? toDateString(clock.now) : null;

    return (await store.add(text, { ...fields, list: listForNew(store.activeFilter, store.lists), today })) !== undefined;
  }

  function saveDue(due: string | null): void {
    if (scheduling !== null) {
      void store.update(scheduling.id, { due });
    }
  }

  // A to-do that starts repeating without a date gets its first one.
  function saveRepeat(repeat: string | null): void {
    if (repeating === null) {
      return;
    }

    const due = repeat !== null && repeating.due === null ? firstOccurrence(repeat, new Date()) : repeating.due;

    void store.update(repeating.id, { repeat, due });
  }

  // A repeating to-do checked off moved on; Undo puts back its date, Today, place and history.
  function rescheduled(todo: TTodo, next: string): void {
    const { due, today, position, history } = todo;

    offerUndo(i18n.t("due.next", [formatDue(next, new Date()).label]), async () => store.update(todo.id, { due, today, position, history }));
  }

  async function remove(todo: TTodo): Promise<void> {
    const removed = await store.remove(todo.id);

    if (removed) {
      offerUndo(i18n.t("toast.deleted", [truncate(removed.text)]), async () => store.restore([removed]));
    }
  }

  // Erases the done to-dos of the current view only.
  async function clearCompleted(): Promise<void> {
    const removed = await store.clearCompleted(store.visible.filter(todo => todo.done).map(todo => todo.id));

    if (removed !== undefined && removed.length > 0) {
      offerUndo(i18n.t("toast.cleared", removed.length), async () => store.restore(removed));
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

<!-- Tooltips open on hover and keyboard focus, not when focus comes back after a click closes a dialog. -->
<Tooltip.Provider delayDuration={400} ignoreNonKeyboardFocus>
  <div class="flex h-[560px] max-h-[600px] flex-col">
    <AppHeader
      done={store.completed}
      total={store.visible.length}
      ready={store.ready}
      scope="{store.activeFilter}#{store.tagFilter ?? ""}"
      onsettings={() => (settingsOpen = true)}
      {focusing}
      onfocus={() => setFocusing(!focusing)}
      timer={pencilTimer}
    />

    <ListTabs
      lists={store.lists}
      active={store.activeFilter}
      onselect={filter => void store.setFilter(filter)}
      onadd={name => store.addList(name)}
    />

    <!-- Two stacked sheets, like the icon: a tilted one behind, the notepad page in front. -->
    <main class="relative mx-3 flex min-h-0 flex-1 flex-col" data-sheet-stack>
      <div data-sheet-back class="absolute inset-0 translate-x-[5px] translate-y-[5px] rotate-[1.4deg] rounded-[6px] border-2 border-border bg-sheet-back" aria-hidden="true"></div>

      <div
        id="todo-sheet"
        data-sheet
        role="tabpanel"
        aria-labelledby="tab-{store.activeFilter}"
        class="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border-2 border-border bg-sheet shadow-sticker"
      >
        {#if focusing}
          <FocusCard
            todo={queue[0]}
            left={queue.length}
            fromToday={queueFromToday}
            timer={timer.timer}
            now={timer.timer === null ? clock.now : seconds.now}
            defaultMinutes={store.prefs.timer}
            ondone={() => void focusDone(queue[0]!)}
            onskip={() => focusSkip(queue[0]!)}
            onstart={minutes => void timer.begin(minutes, queue[0]?.id ?? null)}
            onstop={() => void timer.stop()}
            onexit={() => setFocusing(false)}
          />
        {:else}
          <TodoInput bind:this={input} {tags} onadd={add} onnavigatedown={() => list?.focusFirst()} />

          {#if store.tagFilter !== null}
            <TagFilter tag={store.tagFilter} onclear={() => store.setTagFilter(null)} />
          {/if}

          {#if store.ready && store.todos.length === 0 && store.trash.length === 0}
            <EmptyState />
          {:else}
            <TodoList
              bind:this={list}
              {store}
              onremove={remove}
              onclear={() => void clearCompleted()}
              onexitup={() => input?.focus()}
              onschedule={(todo) => {
                scheduling = todo;
                scheduleOpen = true;
              }}
              onrepeat={(todo) => {
                repeating = todo;
                repeatOpen = true;
              }}
              onview={(todo) => {
                viewingId = todo.id;
                viewOpen = true;
              }}
              onrescheduled={rescheduled}
              now={clock.now}
            />
          {/if}
        {/if}
      </div>
    </main>

    <StatusFooter status={store.status} />
  </div>

  <SettingsPanel bind:open={settingsOpen} {store} theme={appearance.theme} />
  <ScheduleDialog bind:open={scheduleOpen} todo={scheduling} onsave={saveDue} />
  <RepeatDialog bind:open={repeatOpen} todo={repeating} onsave={saveRepeat} />
  <ViewDialog
    bind:open={viewOpen}
    todo={viewing}
    lists={store.lists}
    syncAvailable={store.status.mode === "sync"}
    now={clock.now}
    onsave={text => viewingId !== null && void store.update(viewingId, { text })}
  />

  <Toaster position="bottom-center" offset={58} theme={appearance.theme} />
</Tooltip.Provider>
