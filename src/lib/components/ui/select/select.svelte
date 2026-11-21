<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { Select as SelectPrimitive } from "bits-ui";

  import { cn } from "@/lib/utils.js";



  export type TSelectOption = { value: string; label: string };

  type Props = {
    "value": string;
    "options": ReadonlyArray<TSelectOption>;
    /** Names the control for assistive tech, when no `<label>` wraps it. */
    "aria-label"?: string;
    "id"?: string;
    "disabled"?: boolean;
    "class"?: string;
    "onValueChange"?: (value: string) => void;
  };

  let { value = $bindable(), options, "aria-label": ariaLabel, id, disabled = false, class: className, onValueChange }: Props = $props();

  const selected = $derived(options.find(option => option.value === value));
</script>

<!-- A dropdown in the app's own style (Bits UI), in place of the browser's select. -->
<SelectPrimitive.Root
  type="single"
  bind:value
  items={options as Array<TSelectOption>}
  {disabled}
  onValueChange={next => onValueChange?.(next)}
>
  <SelectPrimitive.Trigger
    {id}
    aria-label={ariaLabel}
    class={cn(
      "group flex h-8 w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-md border-2 border-border bg-sheet px-2 text-left text-[13px] font-bold text-foreground normal-case outline-none transition-colors hover:border-primary focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-primary",
      className,
    )}
  >
    <span class="truncate">{selected?.label ?? ""}</span>
    <ChevronDownIcon class="size-4 shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
  </SelectPrimitive.Trigger>
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      sideOffset={4}
      collisionPadding={8}
      class="z-50 max-h-(--bits-select-content-available-height) min-w-(--bits-select-anchor-width) origin-(--bits-select-content-transform-origin) overflow-y-auto rounded-lg border-2 border-border bg-popover p-1 font-bold text-popover-foreground shadow-sticker duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
    >
      {#each options as option (option.value)}
        <SelectPrimitive.Item
          value={option.value}
          label={option.label}
          class="relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-7 pl-2 text-[13px] outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-selected:text-foreground"
        >
          {#snippet children({ selected: isSelected })}
            <span class="truncate">{option.label}</span>
            {#if isSelected}
              <CheckIcon class="absolute right-2 size-4 text-foreground" aria-hidden="true" />
            {/if}
          {/snippet}
        </SelectPrimitive.Item>
      {/each}
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
</SelectPrimitive.Root>
