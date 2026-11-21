<script lang="ts">
  import type { WithoutChildrenOrChild } from "@/lib/utils.js";

  import { Checkbox as CheckboxPrimitive } from "bits-ui";

  import { cn } from "@/lib/utils.js";



  let {
    ref = $bindable(null),
    checked = $bindable(false),
    indeterminate = $bindable(false),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();
</script>

<!-- A box like the ones in the icon: checking it fills it mint and draws the check like a pen stroke. -->
<CheckboxPrimitive.Root
  bind:ref
  data-slot="checkbox"
  class={cn(
    "peer relative flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-2 border-border bg-sheet text-primary-foreground transition-[background-color,transform] duration-150 outline-none after:absolute after:-inset-2 hover:bg-muted focus-visible:focus-ring active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
    className,
  )}
  bind:checked
  bind:indeterminate
  {...restProps}
>
  {#snippet children({ checked: isChecked })}
    {#if isChecked}
      <svg viewBox="0 0 24 24" class="size-4" fill="none" aria-hidden="true">
        <path
          d="M5 12.8l4.3 4.2L19.2 7"
          pathLength="1"
          stroke="currentColor"
          stroke-width="3.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="animate-draw [stroke-dasharray:1]"
        />
      </svg>
    {/if}
  {/snippet}
</CheckboxPrimitive.Root>
