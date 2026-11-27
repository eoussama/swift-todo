<script lang="ts">
  import type { TTodo } from "@/lib/todos/model";
  import type { TListAction, TListFilter } from "@/lib/todos/view";

  import { onMount, tick } from "svelte";
  import { toast } from "svelte-sonner";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { SKIN_TOOLS } from "@/lib/appearance";
  import { useAppearance } from "@/lib/appearance.svelte";
  import AppHeader from "@/lib/components/AppHeader.svelte";
  import ConfirmDialog from "@/lib/components/ConfirmDialog.svelte";
  import EmptyState from "@/lib/components/EmptyState.svelte";
  import FocusCard from "@/lib/components/FocusCard.svelte";
  import HintBar from "@/lib/components/HintBar.svelte";
  import LinkDialog from "@/lib/components/LinkDialog.svelte";
  import ListTabs from "@/lib/components/ListTabs.svelte";
  import RepeatDialog from "@/lib/components/RepeatDialog.svelte";
  import ScheduleDialog from "@/lib/components/ScheduleDialog.svelte";
  import StatusFooter from "@/lib/components/StatusFooter.svelte";
  import TagFilter from "@/lib/components/TagFilter.svelte";
  import TodoInput from "@/lib/components/TodoInput.svelte";
  import TodoList from "@/lib/components/TodoList.svelte";
  import { Toaster } from "@/lib/components/ui/sonner";
  import * as Tooltip from "@/lib/components/ui/tooltip";
  import ViewDialog from "@/lib/components/ViewDialog.svelte";
  import { expireDrafts, openDialog, readDraft, saveDraft, stampDrafts } from "@/lib/drafts.svelte";
  import { focusQueue } from "@/lib/focus";
  import { FocusTimer } from "@/lib/focus-timer.svelte";
  import { hints } from "@/lib/hints.svelte";
  import { errorMessage, truncate } from "@/lib/messages";
  import { watchPeek } from "@/lib/peek";
  import { Clock } from "@/lib/time/clock.svelte";
  import { toDateString } from "@/lib/time/date";
  import { formatDue } from "@/lib/time/format";
  import { firstOccurrence } from "@/lib/time/recur";
  import { formatClock, remainingMs } from "@/lib/time/timer";
  import { isInToday } from "@/lib/time/today";
  import { shownText } from "@/lib/todos/model";
  import { createTodoRepository } from "@/lib/todos/sync-repository";
  import { collectTags } from "@/lib/todos/tags";
  import { TodoStore } from "@/lib/todos/todos.svelte";
  import { filterTodos, listForNew, resolveFilter } from "@/lib/todos/view";
  import { createUiState, readFocusMode, readFocusSkipped, saveFocusMode, saveFocusSkipped } from "@/lib/ui-state";



  const UNDO_MS = 6_000;

  // Away for more than a few minutes, the popup opens fresh: what was kept from last time goes,
  // before anything below reads it. While open, it notes the time, and once more on closing.
  expireDrafts();
  stampDrafts();

  // Ticks every minute, so the Today view and due labels stay right while the popup is open.
  const clock = new Clock();
  const isToday = (todo: TTodo): boolean => isInToday(todo, clock.now);
  const store = new TodoStore(createTodoRepository(), { ui: createUiState(), isToday });

  const appearance = useAppearance(store);

  // Focus mode: one to-do at a time, with a timer the background keeps running.
  const timer = new FocusTimer(browser.storage.session, browser.storage.onChanged, () => toast(i18n.t("focus.timeUp")));
  const seconds = new Clock();
  let focusing = $state(false);
  let skipped = $state<Array<string>>([]);
  const queue = $derived(focusQueue(store.todos, { visible: store.visible, isToday, skipped }));
  const queueFromToday = $derived(queue.length > 0 && isInToday(queue[0]!, clock.now));
  const pencilTimer = $derived(timer.timer === null
    ? null
    : {
      elapsed: Math.min(seconds.now.getTime() - timer.timer.startedAt, timer.timer.endsAt - timer.timer.startedAt),
      total: timer.timer.endsAt - timer.timer.startedAt,
      left: formatClock(remainingMs(timer.timer, seconds.now)),
    });

  // Left open when the popup closed, the settings open again.
  const settingsKept = readDraft("settings") === true;
  let settingsOpen = $state(settingsKept);
  // The shortcuts dialog, in the footer, also opens with Ctrl+?.
  let shortcutsOpen = $state(false);
  // Once opened, the settings stay loaded.
  let settingsWanted = $state(settingsKept);

  $effect(() => {
    saveDraft("settings", settingsOpen ? true : null);
  });

  // The to-do being scheduled or given a repeat, from its row menu.
  let scheduling = $state<TTodo | null>(null);
  let scheduleOpen = $state(false);
  let repeating = $state<TTodo | null>(null);
  let repeatOpen = $state(false);
  // The to-do shown in full, followed by its ID so edits and syncs show while it's open.
  let viewingId = $state<string | null>(null);
  let viewOpen = $state(false);
  let linking = $state<TTodo | null>(null);
  let linkOpen = $state(false);
  const viewing = $derived(viewingId === null ? null : store.todos.find(todo => todo.id === viewingId) ?? null);

  // The dialog left open when the popup closed opens again on its to-do, once the to-dos load
  // (each dialog brings back its own form). A to-do gone since then takes its dialog with it.
  let reopen = openDialog();

  $effect(() => {
    if (!store.ready || reopen === null) {
      return;
    }

    const { kind, id } = reopen;
    const todo = store.todos.find(item => item.id === id);

    reopen = null;

    if (todo === undefined) {
      saveDraft("dialog", null);
    }
    else if (kind === "view") {
      viewingId = id;
      viewOpen = true;
    }
    else if (kind === "schedule") {
      scheduling = todo;
      scheduleOpen = true;
    }
    else if (kind === "repeat") {
      repeating = todo;
      repeatOpen = true;
    }
    else {
      linking = todo;
      linkOpen = true;
    }
  });
  // Hidden to-dos keep their tags to themselves.
  const tags = $derived(collectTags(store.todos.filter(todo => !todo.hidden)));

  let input = $state<TodoInput | null>(null);
  let list = $state<TodoList | null>(null);
  let undoLast: (() => Promise<void>) | null = null;

  onMount(() => {
    // Holding the peek key shows the whole of a to-do that's cut short.
    const stamp = (): void => stampDrafts();
    const stamping = setInterval(stamp, 15_000);

    window.addEventListener("pagehide", stamp);

    const stops: Array<() => void> = [
      clock.start(),
      watchPeek(window, document.documentElement, () => store.prefs.peek),
      () => clearInterval(stamping),
      () => window.removeEventListener("pagehide", stamp),
    ];

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

    // Gone by itself or dismissed, it can't be undone from the keyboard any more.
    const release = (): void => {
      if (undoLast === undo) {
        undoLast = null;
      }
    };

    toastId = toast(message, {
      duration: UNDO_MS,
      action: { label: i18n.t("toast.undo"), onClick: () => void undo() },
      onAutoClose: release,
      onDismiss: release,
    });

    undoLast = undo;
  }

  async function add(text: string, fields: { due: string | null; repeat: string | null }): Promise<boolean> {
    // Added in the Today view, an undated to-do is pinned there.
    const today = store.activeFilter === "today" && fields.due === null ? toDateString(clock.now) : null;
    const added = await store.add(text, { ...fields, list: listForNew(store.activeFilter, store.lists), today });

    // Down the list, out of sight: it scrolls into view.
    if (added !== undefined) {
      await tick();
      list?.reveal(added.id);
    }

    return added !== undefined;
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
      offerUndo(i18n.t("toast.deleted", [truncate(shownText(removed, i18n.t("item.hidden")))]), async () => store.restore([removed]));
    }
  }

  // The to-dos a tab shows, whatever tag is picked.
  function tabTodos(filter: TListFilter): Array<TTodo> {
    return filterTodos(store.todos, { filter: resolveFilter(filter, store.lists), tag: null, lists: store.lists, isToday });
  }

  function countTab(filter: TListFilter): { total: number; open: number } {
    const todos = tabTodos(filter);

    return { total: todos.length, open: todos.filter(todo => !todo.done).length };
  }

  // With a list made, the tabs' menus are worth a tip.
  $effect(() => {
    if (store.lists.length > 0) {
      hints.want("tabs");
    }
  });

  // A tab's menu acts on all of its to-dos at once, so it asks first.
  let asking = $state<{ action: TListAction; filter: TListFilter; label: string } | null>(null);
  let askOpen = $state(false);

  function ask(action: TListAction, filter: TListFilter, label: string): void {
    asking = { action, filter, label };
    askOpen = true;
  }

  async function confirmed(): Promise<void> {
    if (asking === null) {
      return;
    }

    const { action, filter } = asking;
    const todos = tabTodos(filter);

    if (action === "delete") {
      await store.deleteList(filter);
    }
    else if (action === "erase") {
      const removed = await store.removeMany(todos.map(todo => todo.id));

      if (removed !== undefined && removed.length > 0) {
        offerUndo(i18n.t("lists.erased", removed.length), async () => store.restore(removed));
      }
    }
    else {
      // As checked one by one: a repeating one moves to its next date. Undo puts every one back.
      const open = todos.filter(todo => !todo.done);

      for (const todo of open) {
        await store.toggle(todo.id);
      }

      offerUndo(i18n.t("lists.completed", open.length), async () => store.restore(open));
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
    const mod = (event.ctrlKey || event.metaKey) && !event.altKey;
    // Another dialog open keeps these to itself; their own dialog, they close.
    const otherDialog = (name: string): boolean => [...document.querySelectorAll("[role=dialog]")].some(dialog => dialog.getAttribute("aria-labelledby") === null || document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent !== name);

    // Ctrl+. (Cmd+.) opens or closes the settings, Ctrl+? the shortcuts, even while typing.
    if (mod && event.key === "." && !otherDialog(i18n.t("settings.title"))) {
      event.preventDefault();
      settingsWanted = true;
      settingsOpen = !settingsOpen;

      return;
    }

    if (mod && (event.key === "?" || (event.key === "/" && event.shiftKey)) && !otherDialog(i18n.t("footer.shortcuts"))) {
      event.preventDefault();
      shortcutsOpen = !shortcutsOpen;

      return;
    }

    // Typing, or inside a dialog or menu: the popup's own shortcuts stay out of the way.
    if (typing || target?.closest("[role=dialog], [role=menu], [role=listbox]") != null || document.querySelector("[role=dialog]") !== null) {
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
  <!-- Textures for hidden-text scribbles (Scribble.svelte, .scribble in decor.css): pencil grain, chalk, ink. -->
  <svg class="pointer-events-none absolute size-0" aria-hidden="true" focusable="false">
    <filter id="scribble-pencil" x="-5%" y="-50%" width="110%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="3" result="grain" />
      <feDisplacementMap in="SourceGraphic" in2="grain" scale="0.9" />
    </filter>
    <filter id="scribble-chalk" x="-5%" y="-50%" width="110%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="wobble" />
      <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.8" result="rough" />
      <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="1" seed="11" result="dust" />
      <feComponentTransfer in="dust" result="gaps">
        <feFuncA type="discrete" tableValues="0 1 1 1 1" />
      </feComponentTransfer>
      <feComposite in="rough" in2="gaps" operator="in" />
    </filter>
    <filter id="scribble-ink" x="-5%" y="-50%" width="110%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="5" result="bleed" />
      <feDisplacementMap in="SourceGraphic" in2="bleed" scale="1.6" result="wet" />
      <feGaussianBlur in="wet" stdDeviation="0.3" />
    </filter>
  </svg>

  <div class="flex h-[560px] max-h-[600px] flex-col">
    <AppHeader
      done={store.completed}
      total={store.visible.length}
      ready={store.ready}
      scope="{store.activeFilter}#{store.tagFilter ?? ""}"
      onsettings={() => {
        settingsOpen = true;
        settingsWanted = true;
      }}
      {focusing}
      onfocus={() => setFocusing(!focusing)}
      timer={pencilTimer}
      tool={SKIN_TOOLS[appearance.skin]}
    />

    <ListTabs
      lists={store.lists}
      active={store.activeFilter}
      onselect={filter => void store.setFilter(filter)}
      onadd={name => store.addList(name)}
      count={countTab}
      onaction={ask}
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

          <!-- Always there and empty at first, so turning a tag filter on is announced. -->
          <p class="sr-only" role="status">{store.tagFilter === null ? "" : i18n.t("tags.showing", [store.tagFilter])}</p>
          {#if store.tagFilter !== null}
            <TagFilter
              tag={store.tagFilter}
              onclear={() => {
                // The bar and its button go away; the input takes the focus they had.
                store.setTagFilter(null);
                input?.focus();
              }}
            />
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
              onlink={(todo) => {
                linking = todo;
                linkOpen = true;
              }}
              onrescheduled={rescheduled}
              now={clock.now}
            />
          {/if}

          <HintBar peek={store.prefs.peek} />
        {/if}
      </div>
    </main>

    <StatusFooter status={store.status} peek={store.prefs.peek} bind:shortcutsOpen />
  </div>

  <!-- Settings load the first time they're opened, which keeps the popup quick to start. -->
  {#if settingsWanted}
    {#await import("@/lib/components/settings/SettingsPanel.svelte") then { default: SettingsPanel }}
      <SettingsPanel bind:open={settingsOpen} {store} theme={appearance.theme} />
    {/await}
  {/if}
  <ScheduleDialog bind:open={scheduleOpen} todo={scheduling} onsave={saveDue} />
  <RepeatDialog bind:open={repeatOpen} todo={repeating} onsave={saveRepeat} />
  <LinkDialog bind:open={linkOpen} todo={linking} onsave={source => linking !== null && void store.update(linking.id, { source })} />
  <ViewDialog
    bind:open={viewOpen}
    todo={viewing}
    lists={store.lists}
    syncAvailable={store.status.mode === "sync"}
    now={clock.now}
    onsave={patch => viewingId !== null && void store.update(viewingId, patch)}
  />

  {#if asking !== null}
    <ConfirmDialog
      bind:open={askOpen}
      title={i18n.t(`lists.confirm.${asking.action}.title`)}
      description={i18n.t(`lists.confirm.${asking.action}.description`, [asking.label])}
      confirm={i18n.t(`lists.confirm.${asking.action}.confirm`)}
      destructive={asking.action !== "complete"}
      onconfirm={() => void confirmed()}
    />
  {/if}

  <Toaster position="bottom-center" offset={58} theme={appearance.theme} />
</Tooltip.Provider>
