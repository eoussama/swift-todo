<script lang="ts">
  import type { Snippet } from "svelte";

  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";



  type Props = {
    id: string;
    title: string;
    /** Folds away from its title; on by default. */
    collapsible?: boolean;
    children: Snippet;
  };

  const { id, title, collapsible = true, children }: Props = $props();

  // Folded sections stay folded on this device, like the list's Done section.
  const FOLDED_KEY = "swift-todo:settings-folded";

  function readFolded(): Array<string> {
    try {
      const value = JSON.parse(String(localStorage.getItem(FOLDED_KEY))) as unknown;

      return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
    }
    catch {
      return [];
    }
  }

  let folded = $state(false);

  $effect.pre(() => {
    folded = collapsible && readFolded().includes(id);
  });

  function toggle(): void {
    folded = !folded;

    const others = readFolded().filter(entry => entry !== id);

    try {
      localStorage.setItem(FOLDED_KEY, JSON.stringify(folded ? [...others, id] : others));
    }
    catch {}
  }
</script>

<!-- A card of settings, like a page clipped to the desk; its title folds it away. -->
<section class="rounded-md border-2 border-border bg-sheet p-3 shadow-sticker-sm" aria-labelledby="settings-{id}">
  {#if collapsible}
    <h3 id="settings-{id}" class={["font-hand text-[22px] leading-none font-bold", !folded && "mb-2"]}>
      <button
        type="button"
        class="-m-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-2 rounded-sm p-1 text-left outline-none hover:bg-(--row-hover) focus-visible:focus-ring"
        aria-expanded={!folded}
        aria-controls="settings-{id}-body"
        onclick={toggle}
      >
        {title}
        <ChevronDownIcon class={["size-4 shrink-0 text-muted-foreground transition-transform duration-200", folded && "-rotate-90"]} aria-hidden="true" />
      </button>
    </h3>
    <div id="settings-{id}-body" hidden={folded}>
      {@render children()}
    </div>
  {:else}
    <h3 id="settings-{id}" class="mb-2 font-hand text-[22px] leading-none font-bold">{title}</h3>
    {@render children()}
  {/if}
</section>
