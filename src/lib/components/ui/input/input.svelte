<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import type { WithElementRef } from "@/lib/utils.js";

  import { cn } from "@/lib/utils.js";



  type Props = WithElementRef<Omit<HTMLInputAttributes, "type"> & { type?: "text" | "search" }>;

  let {
    ref = $bindable(null),
    value = $bindable(),
    type = "text",
    class: className,
    "data-slot": dataSlot = "input",
    ...restProps
  }: Props = $props();
</script>

<input
  bind:this={ref}
  data-slot={dataSlot}
  class={cn(
    "h-11 w-full min-w-0 rounded-lg border-2 border-input bg-card px-3 text-[15px] font-semibold text-foreground shadow-sticker-sm transition-shadow outline-none placeholder:font-medium placeholder:text-muted-foreground focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--ring)_75%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
    className,
  )}
  {type}
  bind:value
  {...restProps}
/>
