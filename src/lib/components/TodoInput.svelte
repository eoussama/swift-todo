<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { onMount } from "svelte";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { Input } from "@/lib/components/ui/input";
  import { TODO_LIMITS } from "@/lib/todos/limits";



  type Props = {
    /** Adds the to-do; resolves to whether it was added, so the text can be cleared. */
    onadd: (text: string) => Promise<boolean>;
    /** Called on Arrow Down, to move focus into the list. */
    onnavigatedown: () => void;
  };

  const { onadd, onnavigatedown }: Props = $props();

  /** Counter shows once this few characters are left. */
  const COUNTER_THRESHOLD = 50;

  let value = $state("");
  let ref = $state<HTMLInputElement | null>(null);

  const left = $derived(TODO_LIMITS.maxTextLength - value.length);
  const showCounter = $derived(left <= COUNTER_THRESHOLD);

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

    if (value.trim().length === 0) {
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

<form class="flex gap-2" onsubmit={submit}>
  <label class="sr-only" for="new-todo">{i18n.t("input.label")}</label>
  <Input
    id="new-todo"
    bind:ref
    bind:value
    placeholder={i18n.t("input.placeholder")}
    maxlength={TODO_LIMITS.maxTextLength}
    autocomplete="off"
    spellcheck="true"
    enterkeyhint="done"
    aria-describedby={showCounter ? "new-todo-counter" : undefined}
    aria-keyshortcuts="/"
    {onkeydown}
  />
  <Button type="submit" size="icon-lg" aria-label={i18n.t("input.add")} disabled={value.trim().length === 0}>
    <PlusIcon class="size-5" strokeWidth={3} />
  </Button>
</form>

{#if showCounter}
  <p id="new-todo-counter" class={["mt-1.5 px-1 text-xs font-semibold", left === 0 ? "text-destructive" : "text-muted-foreground"]} aria-live="polite">
    {i18n.t("input.charactersLeft", left)}
  </p>
{/if}
