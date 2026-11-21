<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TTodo } from "@/lib/todos/model";
  import type { TTodoPatch } from "@/lib/todos/repository";

  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ClipboardIcon from "@lucide/svelte/icons/clipboard";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import LinkIcon from "@lucide/svelte/icons/link";
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { tick } from "svelte";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as Dialog from "@/lib/components/ui/dialog";
  import { toDateString } from "@/lib/time/date";
  import { formatDue, formatRule } from "@/lib/time/format";
  import { firstOccurrence } from "@/lib/time/recur";
  import { isPinnedToday } from "@/lib/time/today";
  import { HISTORY_LIMIT } from "@/lib/todos/history";
  import { TODO_LIMITS } from "@/lib/todos/limits";
  import { isDue, parseLink } from "@/lib/todos/model";
  import { segmentText } from "@/lib/todos/tags";



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
  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  // Each opening starts from reading, not editing.
  $effect.pre(() => {
    if (open) {
      editing = false;
      copied = false;
    }
  });

  const due = $derived(todo?.due == null ? null : formatDue(todo.due, now));
  const list = $derived(todo === null || todo.list === null ? null : lists.find(entry => entry.id === todo.list) ?? null);
  const sync = $derived(
    todo === null || !syncAvailable
      ? "unavailable"
      : todo.location === "sync"
      ? (todo.pending ? "pending" : "synced")
      : (todo.keepOnDevice ? "kept" : "waiting"),
  );
  const added = $derived(todo === null ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(todo.createdAt));
  // Check-offs of a repeating to-do, newest first.
  const checkOffs = $derived(todo === null ? [] : [...todo.history].reverse());
  const checkOffFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const REPEAT_PRESETS = ["1d", "wd", "1w", "1M"];

  // The edit form's fields.
  let draftDate = $state("");
  let draftTime = $state("");
  let draftRepeat = $state("");
  let draftList = $state("");
  let draftToday = $state(false);
  let draftLink = $state("");
  let tried = $state(false);

  const draftSource = $derived(draftLink.trim() === "" ? null : parseLink(draftLink));
  const linkInvalid = $derived(draftLink.trim() !== "" && draftSource === null);
  const textEmpty = $derived(draft.trim().length === 0);
  // The presets, plus the to-do's own rule when it's a custom one, so it can be kept.
  const repeatOptions = $derived([
    { value: "", label: i18n.t("repeatDialog.none") },
    ...REPEAT_PRESETS.map(value => ({ value, label: formatRule(value) })),
    ...(todo?.repeat != null && !REPEAT_PRESETS.includes(todo.repeat) && formatRule(todo.repeat) !== "" ? [{ value: todo.repeat, label: formatRule(todo.repeat) }] : []),
  ]);

  async function edit(): Promise<void> {
    if (todo === null) {
      return;
    }

    const [day = "", clock = ""] = todo.due?.split("T") ?? [];

    draft = todo.text;
    draftDate = day;
    draftTime = clock;
    draftRepeat = todo.repeat ?? "";
    draftList = todo.list ?? "";
    draftToday = isPinnedToday(todo, now);
    draftLink = todo.source?.url ?? "";
    tried = false;
    editing = true;
    await tick();
    editor?.focus();
    editor?.setSelectionRange(draft.length, draft.length);
  }

  function save(event?: Event): void {
    event?.preventDefault();
    tried = true;

    if (todo === null || textEmpty || linkInvalid) {
      return;
    }

    const typed = isDue(draftDate) ? (/^\d{2}:\d{2}$/.test(draftTime) ? `${draftDate}T${draftTime}` : draftDate) : null;
    const repeat = draftRepeat === "" ? null : draftRepeat;

    onsave({
      // A to-do is one line: line breaks typed or pasted become spaces.
      text: draft.replace(/\s*\n\s*/g, " ").trim(),
      // Repeating with no date starts from its first occurrence, as in the Repeat dialog.
      due: typed ?? (repeat === null ? null : firstOccurrence(repeat, new Date())),
      repeat,
      list: draftList === "" ? null : draftList,
      today: draftToday ? toDateString(now) : isPinnedToday(todo, now) ? null : todo.today,
      // The same page keeps the title it was saved with.
      source: draftSource === null ? null : draftSource.url === todo.source?.url ? todo.source : draftSource,
    });
    editing = false;
  }

  function onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      save(event);
    }
  }

  async function copy(): Promise<void> {
    if (todo === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(todo.text);
      copied = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => (copied = false), 1600);
    }
    catch {
      copied = false;
    }
  }

  const fieldClass = "h-8 w-full min-w-0 rounded-md border-2 border-border bg-sheet px-2 text-[13px] font-bold text-foreground normal-case outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)] disabled:opacity-50 aria-invalid:border-destructive";
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
        editing = false;
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
            class="min-h-24 w-full shrink-0 resize-none rounded-md border-2 border-border bg-sheet px-2.5 py-2 text-[16px] leading-[24px] font-bold outline-none [field-sizing:content] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)] aria-invalid:border-destructive"
            aria-label={i18n.t("item.editLabel")}
            aria-invalid={tried && textEmpty}
            maxlength={TODO_LIMITS.maxTextLength}
            onkeydown={onEditorKeydown}
          ></textarea>

          <div class="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-2">
            <label class={labelClass}>
              {i18n.t("view.date")}
              <input class={fieldClass} type="date" bind:value={draftDate} />
            </label>
            <label class={labelClass}>
              {i18n.t("view.time")}
              <input class={fieldClass} type="time" bind:value={draftTime} disabled={draftDate === ""} />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <label class={labelClass}>
              {i18n.t("view.repeats")}
              <select class={fieldClass} bind:value={draftRepeat}>
                {#each repeatOptions as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
            <label class={labelClass}>
              {i18n.t("view.list")}
              <select class={fieldClass} bind:value={draftList}>
                <option value="">{i18n.t("lists.inbox")}</option>
                {#each lists as entry (entry.id)}
                  <option value={entry.id}>{entry.emoji === null ? entry.name : `${entry.emoji} ${entry.name}`}</option>
                {/each}
              </select>
            </label>
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
            <input type="checkbox" class="size-4 accent-(--primary)" bind:checked={draftToday} />
            <SunIcon class="size-4" aria-hidden="true" />
            {i18n.t("menu.addToday")}
          </label>

          <div class="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onclick={() => (editing = false)}>{i18n.t("schedule.cancel")}</Button>
            <Button type="submit" size="sm" disabled={textEmpty}>{i18n.t("schedule.save")}</Button>
          </div>
        </form>
      {:else}
        <p
          class={["max-h-60 min-h-0 overflow-y-auto rounded-md bg-(--row-hover) px-3 py-2.5 text-[16px] leading-[25px] font-bold whitespace-pre-wrap select-text [overflow-wrap:anywhere]", todo.done && "text-muted-foreground line-through"]}
          data-view-text
        >{#each segmentText(todo.text) as segment, i (i)}{#if segment.kind === "tag"}<span class="mx-px rounded-full bg-(--tag) px-1.5 text-[14px] font-extrabold no-underline">{segment.value}</span>{:else}{segment.value}{/if}{/each}</p>
      {/if}

      {#if !editing}
        <dl class="flex min-h-0 flex-col divide-y divide-(--rule) text-[13.5px] font-bold">
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
            <dd>{list === null ? i18n.t("lists.inbox") : list.emoji === null ? list.name : `${list.emoji} ${list.name}`}</dd>
          </div>
          {#if todo.source !== null}
            {@const source = todo.source}
            <div class={rowClass}>
              <LinkIcon class="mt-0.5 size-4" aria-hidden="true" />
              <dt class={termClass}>{i18n.t("view.from")}</dt>
              <dd class="min-w-0">
                <button
                  type="button"
                  class="max-w-full truncate rounded-sm text-left underline underline-offset-2 outline-none hover:no-underline focus-visible:focus-ring"
                  title={source.url}
                  onclick={() => void browser.tabs.create({ url: source.url })}
                >{source.title ?? new URL(source.url).hostname}</button>
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
          <Button variant="outline" size="sm" onclick={() => void copy()}>
            {#if copied}<CheckIcon />{i18n.t("view.copied")}{:else}<ClipboardIcon />{i18n.t("view.copy")}{/if}
          </Button>
          <Button variant="outline" size="sm" onclick={() => void edit()}><PencilIcon />{i18n.t("item.edit")}</Button>
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
