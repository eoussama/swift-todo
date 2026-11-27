<script lang="ts">
  import { cn } from "@/lib/utils.js";



  type Props = {
    /** Keys pressed together are joined by "+", alternatives by " / ", as in "Enter / F2" or "Ctrl+C". */
    keys: string;
    class?: string;
  };

  const { keys, class: className }: Props = $props();

  const groups = $derived(keys.split(" / ").map(group => group.split("+").map(key => key.trim())));
</script>

<!-- A shortcut as key caps, in the current color. Screen readers hear it from `aria-keyshortcuts`, or a label, where it is used. -->
<span class={cn("inline-flex shrink-0 items-center gap-1", className)} aria-hidden="true">
  {#each groups as group, g (g)}
    {#if g > 0}<span class="opacity-60" aria-hidden="true">/</span>{/if}
    {#each group as key, k (k)}
      {#if k > 0}<span class="opacity-60" aria-hidden="true">+</span>{/if}
      <kbd class="min-w-5 rounded-[4px] border border-current/35 px-1 text-center font-sans text-[11px] leading-4 font-bold" aria-hidden="true">{key}</kbd>
    {/each}
  {/each}
</span>
