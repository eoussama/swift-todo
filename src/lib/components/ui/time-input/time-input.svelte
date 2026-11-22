<script lang="ts">
  import { Time } from "@internationalized/date";
  import { TimeField } from "bits-ui";
  import { tick } from "svelte";

  import { cn } from "@/lib/utils.js";



  type Props = {
    /** The time as `HH:MM`, or `""` for none yet. */
    value: string;
    /** Names the field for assistive tech. */
    label: string;
    disabled?: boolean;
    class?: string;
    onValueChange?: (value: string) => void;
    /** Some parts typed and others emptied: not a time yet, though `value` still holds the last whole one. */
    partial?: boolean;
  };

  let { value = $bindable(), label, disabled = false, class: className, onValueChange, partial = $bindable(false) }: Props = $props();

  let field = $state<HTMLElement | null>(null);

  // The field only reports a time once every part is filled, so emptying a part leaves the old one
  // in place. Its parts show "––" when empty: all of them empty is no time; some of them, not a time yet.
  function check(): void {
    const parts = [...(field?.querySelectorAll("[data-segment=\"hour\"], [data-segment=\"minute\"]") ?? [])];
    const empty = parts.filter(part => part.textContent?.includes("–")).length;

    if (parts.length > 0 && empty === parts.length && value !== "") {
      value = "";
      onValueChange?.(value);
    }

    partial = empty > 0 && empty < parts.length;
  }

  // A time set from outside fills every part.
  $effect(() => {
    void value;
    void tick().then(check);
  });

  const pad = (part: number): string => String(part).padStart(2, "0");

  function toTime(text: string): Time | undefined {
    const match = /^(\d{2}):(\d{2})$/.exec(text);

    return match === null ? undefined : new Time(Number(match[1]), Number(match[2]));
  }

  // Read once per change, so the field sees the same value until it really changes.
  const time = $derived(toTime(value));
  const locale = navigator.language;
</script>

<!-- A time typed segment by segment (Bits UI), in the locale's 12- or 24-hour format. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={field} class="contents" onkeyup={check} onfocusout={check}>
  <TimeField.Root
    bind:value={() => time,
    (time) => {
      value = time === undefined ? "" : `${pad(time.hour)}:${pad(time.minute)}`;
      onValueChange?.(value);
    }}
    {locale}
    granularity="minute"
    {disabled}
  >
    <TimeField.Label class="sr-only">{label}</TimeField.Label>
    <TimeField.Input
      class={cn(
        "flex h-8 min-w-0 items-center rounded-md border-2 border-border bg-sheet px-1 text-[13px] font-bold text-foreground tabular-nums transition-colors hover:border-primary focus-within:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-50",
        className,
      )}
    >
      {#snippet children({ segments })}
        {#each segments as { part, value: text }, i (i)}
          {#if part === "literal"}
            <TimeField.Segment {part} class="px-px text-muted-foreground">{text}</TimeField.Segment>
          {:else}
            <!-- Each part is a 24px target at least, as WCAG 2.2 asks. -->
            <TimeField.Segment {part} class="inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm px-0.5 outline-none focus:bg-primary focus:text-primary-foreground data-placeholder:text-muted-foreground">{text}</TimeField.Segment>
          {/if}
        {/each}
      {/snippet}
    </TimeField.Input>
  </TimeField.Root>
</div>
