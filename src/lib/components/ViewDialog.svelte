<script lang="ts">
  import type { TList } from "@/lib/todos/lists";
  import type { TTodo } from "@/lib/todos/model";

  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ClipboardIcon from "@lucide/svelte/icons/clipboard";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import LinkIcon from "@lucide/svelte/icons/link";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { tick } from "svelte";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as Dialog from "@/lib/components/ui/dialog";
  import { formatDue, formatRule } from "@/lib/time/format";
  import { isPinnedToday } from "@/lib/time/today";
  import { TODO_LIMITS } from "@/lib/todos/limits";
  import { segmentText } from "@/lib/todos/tags";



  type Props = {
    open: boolean;
    todo: TTodo | null;
    lists: ReadonlyArray<TList>;
    syncAvailable: boolean;
    now: Date;
    /** Saves edited text. */
    onsave: (text: string) => void;
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

  async function edit(): Promise<void> {
    if (todo === null) {
      return;
    }

    draft = todo.text;
    editing = true;
    await tick();
    editor?.focus();
    editor?.setSelectionRange(draft.length, draft.length);
  }

  function save(): void {
    // A to-do is one line: line breaks typed or pasted become spaces.
    const text = draft.replace(/\s*\n\s*/g, " ").trim();

    if (todo !== null && text.length > 0 && text !== todo.text) {
      onsave(text);
    }

    editing = false;
  }

  function onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
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
        <textarea
          bind:this={editor}
          bind:value={draft}
          class="min-h-32 w-full resize-none rounded-md border-2 border-border bg-sheet px-2.5 py-2 text-[16px] leading-[24px] font-bold outline-none [field-sizing:content] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)]"
          aria-label={i18n.t("item.editLabel")}
          maxlength={TODO_LIMITS.maxTextLength}
          onkeydown={onEditorKeydown}
        ></textarea>
      {:else}
        <p
          class={["max-h-60 min-h-0 overflow-y-auto rounded-md bg-(--row-hover) px-3 py-2.5 text-[16px] leading-[25px] font-bold whitespace-pre-wrap select-text [overflow-wrap:anywhere]", todo.done && "text-muted-foreground line-through"]}
          data-view-text
        >{#each segmentText(todo.text) as segment, i (i)}{#if segment.kind === "tag"}<span class="mx-px rounded-full bg-(--tag) px-1.5 text-[14px] font-extrabold no-underline">{segment.value}</span>{:else}{segment.value}{/if}{/each}</p>
      {/if}

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
      </dl>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        {#if editing}
          <Button variant="ghost" size="sm" class="ml-auto" onclick={() => (editing = false)}>{i18n.t("schedule.cancel")}</Button>
          <Button size="sm" disabled={draft.trim().length === 0} onclick={save}>{i18n.t("schedule.save")}</Button>
        {:else}
          <Button variant="outline" size="sm" onclick={() => void copy()}>
            {#if copied}<CheckIcon />{i18n.t("view.copied")}{:else}<ClipboardIcon />{i18n.t("view.copy")}{/if}
          </Button>
          <Button variant="outline" size="sm" onclick={() => void edit()}><PencilIcon />{i18n.t("item.edit")}</Button>
          <Dialog.Close>
            {#snippet child({ props })}
              <Button {...props} size="sm" class="ml-auto">{i18n.t("view.close")}</Button>
            {/snippet}
          </Dialog.Close>
        {/if}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
