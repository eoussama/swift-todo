<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TTodo } from "@/lib/todos/model";
  import type { TTodoPatch } from "@/lib/todos/repository";

  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ClipboardIcon from "@lucide/svelte/icons/clipboard";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import LinkIcon from "@lucide/svelte/icons/link";
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PinIcon from "@lucide/svelte/icons/pin";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { tick, untrack } from "svelte";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { autosize } from "@/lib/autosize";
  import { Button } from "@/lib/components/ui/button";
  import { Checkbox } from "@/lib/components/ui/checkbox";
  import { DateInput } from "@/lib/components/ui/date-input";
  import * as Dialog from "@/lib/components/ui/dialog";
  import { Select } from "@/lib/components/ui/select";
  import { TimeInput } from "@/lib/components/ui/time-input";
  import { dialogForm, flagOf, keepDialog, textOf } from "@/lib/drafts.svelte";
  import { isClockTime, toDateString } from "@/lib/time/date";
  import { formatDue, formatRule } from "@/lib/time/format";
  import { baseRule, firstOccurrence } from "@/lib/time/recur";
  import { isPinnedToday } from "@/lib/time/today";
  import { HISTORY_LIMIT } from "@/lib/todos/history";
  import { TODO_LIMITS } from "@/lib/todos/limits";
  import { listLabel } from "@/lib/todos/lists";
  import { isDue, parseLink, syncStateOf } from "@/lib/todos/model";
  import { segmentText } from "@/lib/todos/tags";
  import { INBOX, listOf } from "@/lib/todos/view";

  import Scribble from "./Scribble.svelte";



  type Props = {
    open: boolean;
    todo: TTodo | null;
    lists: ReadonlyArray<TList>;
    syncAvailable: boolean;
    now: Date;
    /** Saves what was edited: the text and the other details. */
    onsave: (patch: TTodoPatch) => void;
  };

  let { open = $bindable(false), todo, lists, syncAvailable, now, onsave }: Props = $props();

  let editing = $state(false);
  let draft = $state("");
  let editor = $state<HTMLTextAreaElement | null>(null);
  // What was just copied, the text or the link, shown with a check for a moment.
  let copied = $state<"text" | "link" | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  // Shown dots until asked, for a hidden to-do.
  let revealed = $state(false);

  // Each opening starts from reading, not editing, with hidden text hidden; unless the popup
  // closed with the edit form open, which comes back as it was.
  $effect.pre(() => {
    if (open) {
      editing = false;
      copied = null;
      revealed = false;

      // Only the opening counts, not every change to the to-do while it's open.
      const saved = untrack(() => (todo === null ? null : dialogForm("view", todo.id)));

      if (saved !== null && flagOf(saved, "editing", false)) {
        void edit(saved);
      }
    }
  });

  const due = $derived(todo?.due == null ? null : formatDue(todo.due, now));
  const list = $derived(todo === null ? null : lists.find(entry => entry.id === todo.list) ?? null);
  const sync = $derived(todo === null ? "unavailable" : syncStateOf(todo, syncAvailable));
  const added = $derived(todo === null ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(todo.createdAt));
  // Check-offs of a repeating to-do, newest first.
  const checkOffs = $derived(todo === null ? [] : [...todo.history].reverse());
  const checkOffFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const REPEAT_PRESETS = ["1d", "wd", "1w", "1M"];
  const NO_REPEAT = "none";

  // The edit form's fields.
  let draftDate = $state("");
  let draftTime = $state("");
  let draftRepeat = $state("none");
  let draftList = $state("inbox");
  let draftToday = $state(false);
  let draftLink = $state("");
  let draftHidden = $state(false);
  let draftPinned = $state(false);
  let tried = $state(false);

  const draftSource = $derived(draftLink.trim() === "" ? null : parseLink(draftLink));
  const linkInvalid = $derived(draftLink.trim() !== "" && draftSource === null);
  const textEmpty = $derived(draft.trim().length === 0);
  let timePartial = $state(false);
  // A part-time only matters while there's a date to go with it; with the date removed, the time goes too.
  const timeBlocked = $derived(timePartial && isDue(draftDate));
  // A monthly rule's day ("1M@31") comes from the due date, so it's left out of the choice.
  const currentRepeat = $derived(baseRule(todo?.repeat ?? null));
  // The presets, plus the to-do's own rule when it's a custom one, so it can be kept.
  const repeatOptions = $derived([
    { value: NO_REPEAT, label: i18n.t("repeatDialog.none") },
    ...REPEAT_PRESETS.map(value => ({ value, label: formatRule(value) })),
    ...(currentRepeat !== null && !REPEAT_PRESETS.includes(currentRepeat) && formatRule(currentRepeat) !== "" ? [{ value: currentRepeat, label: formatRule(currentRepeat) }] : []),
  ]);

  // Fills the form from the to-do, or from a form kept from when the popup closed.
  async function edit(saved: Record<string, unknown> = {}): Promise<void> {
    if (todo === null) {
      return;
    }

    const [day = "", clock = ""] = todo.due?.split("T") ?? [];
    const repeat = textOf(saved, "repeat", "");
    const list = textOf(saved, "list", "");

    draft = textOf(saved, "text", todo.text);
    draftDate = textOf(saved, "date", day);
    draftTime = textOf(saved, "time", clock);
    draftRepeat = repeatOptions.some(option => option.value === repeat) ? repeat : baseRule(todo.repeat) ?? NO_REPEAT;
    draftList = list === INBOX || lists.some(entry => entry.id === list) ? list : listOf(todo, lists) ?? INBOX;
    draftToday = flagOf(saved, "today", isPinnedToday(todo, now));
    draftLink = textOf(saved, "link", todo.source?.url ?? "");
    draftHidden = flagOf(saved, "hidden", todo.hidden);
    draftPinned = flagOf(saved, "pinned", todo.pinned);
    tried = flagOf(saved, "tried", false);
    editing = true;
    await tick();
    editor?.focus();
    editor?.setSelectionRange(draft.length, draft.length);
  }

  keepDialog("view", {
    open: () => open,
    id: () => todo?.id ?? null,
    form: () => (editing
      ? { editing, text: draft, date: draftDate, time: draftTime, repeat: draftRepeat, list: draftList, today: draftToday, link: draftLink, hidden: draftHidden, pinned: draftPinned, tried }
      : { editing }),
  });

  function save(event?: Event): void {
    event?.preventDefault();
    tried = true;

    if (todo === null || textEmpty || linkInvalid || timeBlocked) {
      return;
    }

    const typed = isDue(draftDate) ? (isClockTime(draftTime) ? `${draftDate}T${draftTime}` : draftDate) : null;
    const repeat = draftRepeat === NO_REPEAT ? null : draftRepeat;

    onsave({
      // Line breaks (Shift+Enter) stay; the store tidies the spaces around them.
      text: draft,
      // Repeating with no date starts from its first occurrence, as in the Repeat dialog.
      due: typed ?? (repeat === null ? null : firstOccurrence(repeat, new Date())),
      repeat,
      list: draftList === INBOX ? null : draftList,
      today: draftToday ? toDateString(now) : isPinnedToday(todo, now) ? null : todo.today,
      // The same page keeps the title it was saved with.
      source: draftSource === null ? null : draftSource.url === todo.source?.url ? todo.source : draftSource,
      hidden: draftHidden,
      pinned: draftPinned,
    });
    void leaveEditing();
  }

  // The form goes away with the focus in it; the Edit button that opened it takes the focus back.
  let editButton = $state<HTMLElement | null>(null);

  async function leaveEditing(): Promise<void> {
    editing = false;
    await tick();
    editButton?.focus();
  }

  function onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      save(event);
    }
  }

  async function copy(what: "text" | "link", text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copied = what;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => (copied = null), 1600);
    }
    catch {
      copied = null;
    }
  }

  const fieldClass = "h-8 w-full min-w-0 rounded-md border-2 border-border bg-sheet px-2 text-[13px] font-bold text-foreground normal-case outline-none focus-visible:focus-ring disabled:opacity-50 aria-invalid:border-destructive";
  const labelClass = "flex min-w-0 flex-col gap-1 text-[12px] font-extrabold text-muted-foreground uppercase";

  const rowClass = "grid grid-cols-[18px_76px_minmax(0,1fr)] items-start gap-x-2 py-1.5";
  const termClass = "text-[12.5px] font-extrabold text-muted-foreground uppercase";
</script>

<!-- A to-do in full: the whole text, nothing covering it, and every detail in one place. -->
<Dialog.Root bind:open>
  <Dialog.Content
    class="flex max-h-[calc(100%-24px)] w-[348px] flex-col gap-3 bg-sheet p-4"
    showCloseButton={false}
    onEscapeKeydown={(event) => {
      // Escape leaves editing first, then the dialog.
      if (editing) {
        event.preventDefault();
        void leaveEditing();
      }
    }}
  >
    <Dialog.Header class="gap-0 text-left">
      <Dialog.Title class="font-hand text-[26px] leading-none font-bold">{i18n.t("view.title")}</Dialog.Title>
      <Dialog.Description class="sr-only">{i18n.t("view.description")}</Dialog.Description>
    </Dialog.Header>

    {#if todo !== null}
      {#if editing}
        <form class="-mx-1 flex min-h-0 flex-col gap-3 overflow-y-auto px-1 pb-1" onsubmit={save} novalidate>
          <textarea
            bind:this={editor}
            bind:value={draft}
            use:autosize={draft}
            class="min-h-24 w-full shrink-0 resize-none rounded-md border-2 border-border bg-sheet px-2.5 py-2 text-[16px] leading-[24px] font-bold outline-none [field-sizing:content] focus-visible:focus-ring aria-invalid:border-destructive"
            aria-label={i18n.t("item.editLabel")}
            aria-invalid={tried && textEmpty}
            maxlength={TODO_LIMITS.maxTextLength}
            onkeydown={onEditorKeydown}
          ></textarea>

          <div class="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
            <div class={labelClass}>
              <span aria-hidden="true">{i18n.t("view.date")}</span>
              <DateInput bind:value={draftDate} label={i18n.t("view.date")} empty={i18n.t("schedule.clear")} clear={i18n.t("schedule.remove")} />
            </div>
            <div class={labelClass}>
              <span aria-hidden="true">{i18n.t("view.time")}</span>
              <TimeInput bind:value={draftTime} bind:partial={timePartial} label={i18n.t("view.time")} disabled={draftDate === ""} />
              {#if timeBlocked}
                <span class="text-[11.5px] font-bold text-destructive normal-case" role="alert">{i18n.t("schedule.timeIncomplete")}</span>
              {/if}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class={labelClass}>
              <span aria-hidden="true">{i18n.t("view.repeats")}</span>
              <Select bind:value={draftRepeat} options={repeatOptions} aria-label={i18n.t("view.repeats")} />
            </div>
            <div class={labelClass}>
              <span aria-hidden="true">{i18n.t("view.list")}</span>
              <Select
                bind:value={draftList}
                options={[{ value: INBOX, label: i18n.t("lists.inbox") }, ...lists.map(entry => ({ value: entry.id, label: listLabel(entry) }))]}
                aria-label={i18n.t("view.list")}
              />
            </div>
          </div>

          <label class={labelClass}>
            {i18n.t("link.label")}
            <input
              class={fieldClass}
              type="url"
              inputmode="url"
              spellcheck="false"
              placeholder={i18n.t("link.placeholder")}
              bind:value={draftLink}
              aria-invalid={tried && linkInvalid}
              aria-describedby={tried && linkInvalid ? "view-link-error" : undefined}
            />
          </label>
          {#if tried && linkInvalid}
            <p id="view-link-error" class="-mt-2 text-[12.5px] font-bold text-destructive" role="alert">{i18n.t("link.invalid")}</p>
          {/if}

          <label class="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
            <Checkbox bind:checked={draftPinned} class="size-[18px]" />
            <PinIcon class="size-4" aria-hidden="true" />
            {i18n.t("menu.pin")}
          </label>

          <label class="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
            <Checkbox bind:checked={draftHidden} class="size-[18px]" />
            <EyeOffIcon class="size-4" aria-hidden="true" />
            {i18n.t("menu.hideText")}
          </label>

          <label class="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
            <Checkbox bind:checked={draftToday} class="size-[18px]" />
            <SunIcon class="size-4" aria-hidden="true" />
            {i18n.t("menu.addToday")}
          </label>

          <div class="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onclick={() => void leaveEditing()}>{i18n.t("schedule.cancel")}</Button>
            <Button type="submit" size="sm" disabled={textEmpty || timeBlocked}>{i18n.t("schedule.save")}</Button>
          </div>
        </form>
      {:else}
        {#if todo.hidden && !revealed}
          <p class="rounded-md bg-(--row-hover) px-3 py-2.5 text-[17px] leading-[25px]" data-view-text>
            <Scribble /><span class="sr-only">{i18n.t("item.hidden")}</span>
          </p>
        {:else}
          <p
            class={["max-h-60 min-h-0 overflow-y-auto rounded-md bg-(--row-hover) px-3 py-2.5 text-[17px] leading-[25px] written whitespace-pre-wrap select-text [overflow-wrap:anywhere]", todo.done && "text-muted-foreground line-through"]}
            data-view-text
          >{#each segmentText(todo.text) as segment, i (i)}{#if segment.kind === "tag"}<span class="mx-px rounded-full bg-(--tag) px-1.5 font-sans text-[13px] font-extrabold no-underline">{segment.value}</span>{:else}{segment.value}{/if}{/each}</p>
        {/if}
        {#if todo.hidden}
          <Button variant="outline" size="sm" class="-mt-1 self-end" onclick={() => (revealed = !revealed)}>
            {#if revealed}<EyeOffIcon />{i18n.t("item.hide")}{:else}<EyeIcon />{i18n.t("item.show")}{/if}
          </Button>
        {/if}
      {/if}

      {#if !editing}
        <dl class="flex min-h-0 flex-col divide-y divide-(--rule) text-[13.5px] font-bold">
          {#if todo.pinned}
            <div class={rowClass}>
              <PinIcon class="mt-0.5 size-4" aria-hidden="true" />
              <dt class={termClass}>{i18n.t("view.state")}</dt>
              <dd>{i18n.t("view.pinnedTop")}</dd>
            </div>
          {/if}
          {#if todo.done}
            <div class={rowClass}>
              <CheckIcon class="mt-0.5 size-4 text-primary" aria-hidden="true" />
              <dt class={termClass}>{i18n.t("view.state")}</dt>
              <dd>{i18n.t("item.done")}</dd>
            </div>
          {/if}
          {#if due !== null}
            <div class={rowClass}>
              <CalendarIcon class="mt-0.5 size-4" aria-hidden="true" />
              <dt class={termClass}>{i18n.t("view.due")}</dt>
              <dd class={due.overdue && !todo.done ? "text-destructive" : ""}>{due.label}</dd>
            </div>
          {/if}
          {#if todo.repeat !== null}
            <div class={rowClass}>
              <RepeatIcon class="mt-0.5 size-4" aria-hidden="true" />
              <dt class={termClass}>{i18n.t("view.repeats")}</dt>
              <dd>{formatRule(todo.repeat)}</dd>
            </div>
          {/if}
          {#if isPinnedToday(todo, now)}
            <div class={rowClass}>
              <SunIcon class="mt-0.5 size-4" aria-hidden="true" />
              <dt class={termClass}>{i18n.t("due.today")}</dt>
              <dd>{i18n.t("view.pinned")}</dd>
            </div>
          {/if}
          <div class={rowClass}>
            <FolderIcon class="mt-0.5 size-4" aria-hidden="true" />
            <dt class={termClass}>{i18n.t("view.list")}</dt>
            <dd>{list === null ? i18n.t("lists.inbox") : listLabel(list)}</dd>
          </div>
          {#if todo.source !== null}
            {@const source = todo.source}
            <div class={rowClass}>
              <LinkIcon class="mt-0.5 size-4" aria-hidden="true" />
              <dt class={termClass}>{i18n.t("view.from")}</dt>
              <dd class="flex min-w-0 items-start gap-1">
                <button
                  type="button"
                  class="min-w-0 truncate rounded-sm text-left underline underline-offset-2 outline-none hover:no-underline focus-visible:focus-ring"
                  title={source.url}
                  onclick={() => void browser.tabs.create({ url: source.url })}
                >{source.title ?? new URL(source.url).hostname}<span class="sr-only"> ({i18n.t("link.newTab")})</span></button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="-my-1 size-6 shrink-0"
                  tooltip={copied === "link" ? i18n.t("view.copied") : i18n.t("menu.copyLink")}
                  aria-label={i18n.t("menu.copyLink")}
                  onclick={() => void copy("link", source.url)}
                >
                  {#if copied === "link"}<CheckIcon />{:else}<CopyIcon />{/if}
                </Button>
              </dd>
            </div>
          {/if}
          <div class={rowClass}>
            <CloudIcon class="mt-0.5 size-4" aria-hidden="true" />
            <dt class={termClass}>{i18n.t("view.saved")}</dt>
            <dd>{i18n.t(`view.sync.${sync}`)}</dd>
          </div>
          <div class={rowClass}>
            <HistoryIcon class="mt-0.5 size-4" aria-hidden="true" />
            <dt class={termClass}>{i18n.t("view.added")}</dt>
            <dd>{added}</dd>
          </div>
          {#if checkOffs.length > 0}
            <div class={rowClass} data-view-history>
              <ListChecksIcon class="mt-0.5 size-4" aria-hidden="true" />
              <dt class={termClass}>{i18n.t("view.history")}</dt>
              <dd class="min-w-0">
                <p>{i18n.t("view.checkedOff", checkOffs.length)}</p>
                <ol class="mt-1 max-h-28 overflow-y-auto pr-1 text-[12.5px] font-semibold text-muted-foreground" aria-label={i18n.t("view.history")}>
                  {#each checkOffs as time, i (i)}
                    <li class="flex items-center gap-1.5 py-px"><CheckIcon class="size-3 shrink-0 text-primary" aria-hidden="true" /><time datetime={new Date(time).toISOString()}>{checkOffFormat.format(time)}</time></li>
                  {/each}
                </ol>
                {#if checkOffs.length >= HISTORY_LIMIT}
                  <p class="mt-1 text-[11.5px] font-semibold text-muted-foreground">{i18n.t("view.historyLimit", [String(HISTORY_LIMIT)])}</p>
                {/if}
              </dd>
            </div>
          {/if}
        </dl>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="outline" size="sm" onclick={() => void copy("text", todo.text)}>
            {#if copied === "text"}<CheckIcon />{i18n.t("view.copied")}{:else}<ClipboardIcon />{i18n.t("view.copy")}{/if}
          </Button>
          <Button bind:ref={editButton} variant="outline" size="sm" onclick={() => void edit()}><PencilIcon />{i18n.t("item.edit")}</Button>
          <Dialog.Close>
            {#snippet child({ props })}
              <Button {...props} size="sm" class="ml-auto">{i18n.t("view.close")}</Button>
            {/snippet}
          </Dialog.Close>
        </div>
      {/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>
