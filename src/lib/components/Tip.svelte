<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Tooltip from "@/lib/components/ui/tooltip";



  type Props = {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    /** Classes for the tooltip, like `break-all` for a web address. */
    class?: string;
    /** The element, given the props that make it the trigger; merge them with its own through `mergeProps`. */
    children: Snippet<[Record<string, unknown>]>;
  };

  const { label, side = "top", class: className = "", children }: Props = $props();
</script>

<!-- A tooltip for an icon-only control that isn't a `Button` (those take a `tooltip` prop). -->
<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      {@render children(props)}
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content {side} class={className}>{label}</Tooltip.Content>
</Tooltip.Root>
