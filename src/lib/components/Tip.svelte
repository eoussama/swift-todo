<script lang="ts">
  import type { Snippet } from "svelte";

  import { Keys } from "@/lib/components/ui/keys";
  import * as Tooltip from "@/lib/components/ui/tooltip";



  type Props = {
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    /** Classes for the tooltip, like `break-all` for a web address. */
    class?: string;
    /** Its keyboard shortcut, shown as keys at the right end. */
    shortcut?: string;
    /** The element, given the props that make it the trigger; merge them with its own through `mergeProps`. */
    children: Snippet<[Record<string, unknown>]>;
  };

  const { label, side = "top", class: className = "", shortcut, children }: Props = $props();
</script>

<!-- A tooltip for an icon-only control that isn't a `Button` (those take a `tooltip` prop). -->
<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      {@render children(props)}
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content {side} class={className}>
    {label}
    {#if shortcut !== undefined}<Keys keys={shortcut} class="ml-1.5" />{/if}
  </Tooltip.Content>
</Tooltip.Root>
