<script lang="ts">
  import MinusIcon from "@lucide/svelte/icons/minus";
  import PlusIcon from "@lucide/svelte/icons/plus";

  import { Button } from "@/lib/components/ui/button";
  import { cn } from "@/lib/utils.js";



  type Props = {
    /** The number, or `null` while what's typed isn't one. */
    value: number | null;
    min: number;
    max: number;
    /** Names the field for assistive tech. */
    label: string;
    /** Names the buttons, like "Fewer minutes" and "More minutes". */
    less: string;
    more: string;
    disabled?: boolean;
    class?: string;
    /** Called with the number when Enter is pressed and it's valid. */
    onenter?: (value: number) => void;
    ref?: HTMLInputElement | null;
  };

  let { value = $bindable(), min, max, label, less, more, disabled = false, class: className, onenter, ref = $bindable(null) }: Props = $props();

  let text = $state("");

  // Shows the number as it changes from outside (the buttons, a reset), but not while it's being typed.
  $effect.pre(() => {
    const shown = value === null ? "" : String(value);

    if (Number.parseInt(text, 10) !== value) {
      text = shown;
    }
  });

  const valid = $derived(value !== null && value >= min && value <= max);

  function read(field: HTMLInputElement): void {
    text = field.value.replace(/\D/g, "").slice(0, String(max).length);
    value = text === "" ? null : Number.parseInt(text, 10);

    // Letters and extra digits don't stay on screen.
    if (field.value !== text) {
      field.value = text;
    }
  }

  const limit = "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:shadow-none aria-disabled:active:translate-y-0";

  function step(by: number): void {
    value = Math.min(max, Math.max(min, (value ?? min - by) + by));
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      step(event.key === "ArrowUp" ? 1 : -1);
    }
    else if (event.key === "Enter" && valid && value !== null) {
      event.preventDefault();
      onenter?.(value);
    }
  }
</script>

<!-- A number with − and + beside it, in place of the browser's spinner. At a limit, a button says
     so (aria-disabled) but stays focusable, so pressing it to the limit doesn't drop the focus. -->
<div class={cn("inline-flex items-center gap-1", className)}>
  <Button variant="outline" size="icon-xs" tooltip={less} {disabled} aria-disabled={(value ?? min) <= min} class={limit} onclick={() => step(-1)}>
    <MinusIcon />
  </Button>
  <input
    bind:this={ref}
    type="text"
    inputmode="numeric"
    role="spinbutton"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value ?? undefined}
    aria-invalid={!valid}
    value={text}
    {disabled}
    class="h-7 w-12 rounded-md border-2 border-border bg-sheet px-1 text-center text-[13px] font-bold tabular-nums outline-none transition-colors hover:border-primary focus-visible:focus-ring disabled:opacity-50 aria-invalid:border-destructive"
    oninput={event => read(event.currentTarget)}
    {onkeydown}
  />
  <Button variant="outline" size="icon-xs" tooltip={more} {disabled} aria-disabled={(value ?? max) >= max} class={limit} onclick={() => step(1)}>
    <PlusIcon />
  </Button>
</div>
