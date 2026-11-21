<script lang="ts">
  import type { Component, Snippet } from "svelte";

  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";



  type Props = {
    /** Visible title, which is also the toggle's accessible name. */
    label: string;
    expanded: boolean;
    /** ID of the list this header shows and hides. */
    controls: string;
    ontoggle: () => void;
    /** Optional icon shown before the title. */
    icon?: Component<{ class?: string }>;
    /** Buttons on the right, like "Erase all". */
    action?: Snippet;
  };

  const { label, expanded, controls, ontoggle, icon: Icon, action }: Props = $props();
</script>

<!-- A section title on a ruled line: the arrow sits in the margin, in line with the checkboxes. -->
<div class="margin-line flex min-h-11 shrink-0 items-center border-b border-rule bg-sheet pr-2">
  <button
    type="button"
    class="group/section flex min-h-11 flex-1 items-center self-stretch text-left outline-none focus-visible:bg-(--row-focus) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border focus-visible:outline-solid"
    aria-expanded={expanded}
    aria-controls={controls}
    onclick={ontoggle}
  >
    <span class="flex w-10 shrink-0 justify-center text-muted-foreground group-hover/section:text-foreground">
      <ChevronDownIcon class={["size-[18px] transition-transform", !expanded && "-rotate-90"]} strokeWidth={3} />
    </span>
    <span class="flex items-center gap-1.5 pl-3 font-hand text-[22px] leading-none font-bold text-muted-foreground group-hover/section:text-foreground">
      {#if Icon}
        <Icon class="size-4" />
      {/if}
      {label}
    </span>
  </button>

  {@render action?.()}
</div>
