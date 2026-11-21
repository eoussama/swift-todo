<script lang="ts">
  import PencilLineIcon from "@lucide/svelte/icons/pencil-line";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { onMount } from "svelte";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { TODO_LIMITS } from "@/lib/todos/limits";



  type Props = {
    /** Adds the to-do; resolves to whether it was added, so the text can be cleared. */
    onadd: (text: string) => Promise<boolean>;
    /** Called on Arrow Down, to move focus into the list. */
    onnavigatedown: () => void;
  };

  const { onadd, onnavigatedown }: Props = $props();

  /** The counter shows once this few characters are left. */
  const COUNTER_THRESHOLD = 50;

  let value = $state("");
  let ref = $state<HTMLInputElement | null>(null);

  const left = $derived(TODO_LIMITS.maxTextLength - value.length);
  const showCounter = $derived(left <= COUNTER_THRESHOLD);
  const empty = $derived(value.trim().length === 0);

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

    if (await onadd(value)) {
      value = "";
    }

    ref?.focus();
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onnavigatedown();
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
    class="h-12 min-w-0 flex-1 bg-transparent pr-2 pl-3 text-[15px] font-bold outline-none placeholder:font-hand placeholder:text-[22px] placeholder:font-semibold placeholder:text-muted-foreground"
    placeholder={i18n.t("input.placeholder")}
    maxlength={TODO_LIMITS.maxTextLength}
    autocomplete="off"
    spellcheck="true"
    enterkeyhint="done"
    aria-describedby={showCounter ? "new-todo-counter" : undefined}
    aria-keyshortcuts="/"
    {onkeydown}
  />

  <Button
    type="submit"
    variant="pencil"
    size="icon-sm"
    class={["rounded-full transition-[opacity,transform]", empty ? "scale-90 opacity-40" : "animate-pop"]}
    aria-label={i18n.t("input.add")}
    disabled={empty}
  >
    <PlusIcon class="size-[18px]" strokeWidth={3} />
  </Button>

  {#if showCounter}
    <p
      id="new-todo-counter"
      class={["absolute right-12 -bottom-[9px] rounded-full border-2 border-border bg-sheet px-1.5 text-[11px] leading-4 font-bold", left === 0 ? "text-destructive" : "text-foreground"]}
      aria-live="polite"
    >
      {i18n.t("input.charactersLeft", left)}
    </p>
  {/if}
</form>
