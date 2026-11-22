<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import PencilLineIcon from "@lucide/svelte/icons/pencil-line";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import XIcon from "@lucide/svelte/icons/x";
  import { onMount, tick } from "svelte";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { formatDue, formatRule } from "@/lib/time/format";
  import { parseTodo } from "@/lib/time/parse";
  import { TODO_LIMITS } from "@/lib/todos/limits";
  import { completeTag, suggestTags, tagQueryAt } from "@/lib/todos/tags";
  import { mergeProps } from "@/lib/utils";

  import Tip from "./Tip.svelte";



  type Props = {
    /** Adds the to-do with what was understood; resolves to whether it was added, so the text can be cleared. */
    onadd: (text: string, fields: { due: string | null; repeat: string | null }) => Promise<boolean>;
    /** Called on Arrow Down, to move focus into the list. */
    onnavigatedown: () => void;
    /** Tags in use, most used first, for suggestions after `#`. */
    tags?: ReadonlyArray<string>;
  };

  const { onadd, onnavigatedown, tags = [] }: Props = $props();

  /** The counter shows once this few characters are left. */
  const COUNTER_THRESHOLD = 50;

  let value = $state("");
  let ref = $state<HTMLInputElement | null>(null);

  const left = $derived(TODO_LIMITS.maxTextLength - value.length);
  const showCounter = $derived(left <= COUNTER_THRESHOLD);
  // Screen readers hear the count at a few steps, not on every key.
  const milestone = $derived([0, 10, 20, COUNTER_THRESHOLD].find(step => left <= step) ?? null);
  const empty = $derived(value.trim().length === 0);

  // Dates and repeats typed in the text ("tomorrow 3pm", "every day"), unless dismissed.
  let ignoreParse = $state(false);
  const parsed = $derived(parseTodo(value, new Date()));
  const understood = $derived(!ignoreParse && (parsed.due !== null || parsed.repeat !== null));

  $effect(() => {
    // Typing something new brings parsing back.
    if (value.trim().length === 0) {
      ignoreParse = false;
    }
  });

  // Tag suggestions for the `#word` being typed at the caret.
  let caret = $state(0);
  const query = $derived(tagQueryAt(value, caret));
  const suggestions = $derived(query === null ? [] : suggestTags(tags, query.query));

  function trackCaret(): void {
    caret = ref?.selectionStart ?? value.length;
  }

  // The tag just completed, said once, until the next thing typed.
  let completedTag = $state<string | null>(null);

  async function pick(tag: string): Promise<void> {
    if (query === null) {
      return;
    }

    const completed = completeTag(value, query.start, caret, tag);

    value = completed.text;
    completedTag = tag;
    await tick();
    ref?.focus();
    ref?.setSelectionRange(completed.caret, completed.caret);
    caret = completed.caret;
  }

  /** Moves focus to the input. */
  export function focus(): void {
    ref?.focus();
  }

  onMount(() => {
    // Focus right away so typing works as soon as the popup opens.
    ref?.focus();
  });

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    if (empty) {
      return;
    }

    // Clear right away, so typing the next to-do while this one saves isn't wiped;
    // put the text back only if adding failed and nothing new was typed.
    const submitted = value;
    const text = understood ? parsed.text : submitted;
    const fields = understood ? { due: parsed.due, repeat: parsed.repeat } : { due: null, repeat: null };

    value = "";
    caret = 0;

    if (!(await onadd(text, fields)) && value === "") {
      value = submitted;
    }

    ref?.focus();
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "Tab" && !event.shiftKey && suggestions.length > 0) {
      event.preventDefault();
      void pick(suggestions[0]!);
    }
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      onnavigatedown();
    }
    else if (event.key === "Escape" && understood) {
      // Keeps the words as typed, like the chip's ✕, without leaving the input.
      event.preventDefault();
      event.stopPropagation();
      ignoreParse = true;
    }
  }
</script>

<!-- The first line of the sheet. Focus darkens its rule and highlights it like a marker. -->
<form
  class="margin-line relative flex min-h-12 shrink-0 items-center border-b-2 border-rule pr-2 transition-colors focus-within:border-border focus-within:bg-highlight"
  onsubmit={submit}
>
  <label for="new-todo" class="flex w-10 shrink-0 justify-center text-muted-foreground">
    <PencilLineIcon class="size-[18px]" />
    <span class="sr-only">{i18n.t("input.label")}</span>
  </label>

  <input
    id="new-todo"
    bind:this={ref}
    bind:value
    class="h-12 min-w-0 flex-1 bg-transparent pr-2 pl-3 text-[16px] written outline-none placeholder:font-hand placeholder:text-[22px] placeholder:font-semibold placeholder:text-muted-foreground"
    placeholder={i18n.t("input.placeholder")}
    maxlength={TODO_LIMITS.maxTextLength}
    autocomplete="off"
    spellcheck="true"
    enterkeyhint="done"
    aria-describedby={showCounter ? "new-todo-counter" : undefined}
    aria-keyshortcuts="/"
    {onkeydown}
    oninput={() => {
      completedTag = null;
      trackCaret();
    }}
    onkeyup={trackCaret}
    onclick={trackCaret}
  />

  <Button
    type="submit"
    variant="default"
    size="icon-sm"
    class={["rounded-full transition-[opacity,transform]", empty ? "scale-90 opacity-40" : "animate-pop"]}
    tooltip={i18n.t("input.add")}
    disabled={empty}
  >
    <PlusIcon class="size-[18px]" strokeWidth={3} />
  </Button>

  {#if suggestions.length > 0}
    <!-- Tab completes the first suggestion; clicking completes any. -->
    <div class="absolute top-full left-[52px] z-20 mt-1 flex flex-wrap gap-1" role="group" aria-label={i18n.t("tags.suggestions")}>
      {#each suggestions as tag (tag)}
        <button
          type="button"
          tabindex={-1}
          class="rounded-full border-2 border-border bg-sheet px-2 text-[12.5px] leading-5 font-extrabold shadow-sticker-sm hover:bg-sky"
          onmousedown={event => event.preventDefault()}
          onclick={() => void pick(tag)}
        >#{tag}</button>
      {/each}
    </div>
  {/if}

  {#if understood && suggestions.length === 0}
    <!-- What the text was understood as; the ✕ keeps the words as plain text instead. Screen readers hear the
         status below, so only the ✕ is left for them here. -->
    <div class="absolute top-full left-[52px] z-20 mt-1 flex items-center gap-1 rounded-full border-2 border-border bg-sheet py-0.5 pr-0.5 pl-2 text-[12px] font-extrabold shadow-sticker-sm">
      {#if parsed.due !== null}
        <CalendarIcon class="size-3.5" aria-hidden="true" />
        <span aria-hidden="true">{formatDue(parsed.due, new Date()).label}</span>
      {/if}
      {#if parsed.repeat !== null}
        <RepeatIcon class="ml-1 size-3.5" aria-hidden="true" />
        <span aria-hidden="true">{formatRule(parsed.repeat)}</span>
      {/if}
      <Tip label={i18n.t("input.ignore")}>
        {#snippet children(tip)}
          <button
            {...mergeProps(tip, { onclick: () => (ignoreParse = true) })}
            type="button"
            tabindex={-1}
            class="-my-1 ml-0.5 grid size-6 place-items-center rounded-full hover:bg-muted"
            aria-label={i18n.t("input.ignore")}
            onmousedown={event => event.preventDefault()}
          >
            <XIcon class="size-3" strokeWidth={3} />
          </button>
        {/snippet}
      </Tip>
    </div>
  {/if}

  {#if showCounter}
    <p
      id="new-todo-counter"
      class={["absolute right-12 -bottom-[9px] rounded-full border-2 border-border bg-sheet px-1.5 text-[11px] leading-4 font-bold", left === 0 ? "text-destructive" : "text-foreground"]}
    >
      {i18n.t("input.charactersLeft", left)}
    </p>
  {/if}

  <!-- Always present, so changes are announced: tag suggestions, what the text was understood as, and the characters left. -->
  <p class="sr-only" role="status">
    {suggestions.length > 0 ? i18n.t("tags.complete", [suggestions[0]!]) : completedTag === null ? "" : i18n.t("tags.completed", [completedTag])}
    {understood && suggestions.length === 0
      ? i18n.t("item.understoodAs", [[parsed.due === null ? "" : formatDue(parsed.due, new Date()).label, parsed.repeat === null ? "" : formatRule(parsed.repeat)].filter(part => part !== "").join(", ")])
      : ""}
    {milestone === null ? "" : i18n.t("input.charactersLeft", milestone)}
  </p>
</form>
