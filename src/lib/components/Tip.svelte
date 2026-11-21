<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Tooltip from "@/lib/components/ui/tooltip";



  type Props = {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    /** The element, given the props that make it the trigger; merge them with its own through `mergeProps`. */
    children: Snippet<[Record<string, unknown>]>;
  };

  const { label, side = "top", children }: Props = $props();
</script>

<!-- A tooltip for an icon-only control that isn't a `Button` (those take a `tooltip` prop). -->
<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      {@render children(props)}
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content {side}>{label}</Tooltip.Content>
</Tooltip.Root>
