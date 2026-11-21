<script lang="ts">
  import { Time } from "@internationalized/date";
  import { TimeField } from "bits-ui";

  import { cn } from "@/lib/utils.js";



  type Props = {
    /** The time as `HH:MM`, or `""` for none yet. */
    value: string;
    /** Names the field for assistive tech. */
    label: string;
    disabled?: boolean;
    class?: string;
    onValueChange?: (value: string) => void;
  };

  let { value = $bindable(), label, disabled = false, class: className, onValueChange }: Props = $props();

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
