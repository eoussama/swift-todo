<script lang="ts">
  import type { WithoutChildrenOrChild } from "@/lib/utils.js";

  import CheckIcon from "@lucide/svelte/icons/check";
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

<!-- A mint box with a navy check, like the ones in the icon. -->
<CheckboxPrimitive.Root
  bind:ref
  data-slot="checkbox"
  class={cn(
    "peer relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-2 border-border bg-card text-primary-foreground transition-colors outline-none after:absolute after:-inset-2 hover:bg-muted focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
    className,
  )}
  bind:checked
  bind:indeterminate
  {...restProps}
>
  {#snippet children({ checked: isChecked })}
    {#if isChecked}
      <CheckIcon class="size-3.5 animate-in zoom-in-50 duration-150" strokeWidth={4} />
    {/if}
  {/snippet}
</CheckboxPrimitive.Root>
