<script lang="ts">
  import type { Snippet } from "svelte";



  type Props = {
    id: string;
    title: string;
    children: Snippet;
  };

  const { id, title, children }: Props = $props();
</script>

<!-- A card of settings, like a page clipped to the desk. -->
<section class="rounded-md border-2 border-border bg-sheet p-3 shadow-sticker-sm" aria-labelledby="settings-{id}">
  <h3 id="settings-{id}" class="mb-2 font-hand text-[22px] leading-none font-bold">{title}</h3>
  {@render children()}
</section>
