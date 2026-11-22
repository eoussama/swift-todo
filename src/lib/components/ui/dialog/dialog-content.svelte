<script lang="ts">
  import type { ComponentProps, Snippet } from "svelte";
  import type { WithoutChildrenOrChild } from "@/lib/utils.js";
  import XIcon from "@lucide/svelte/icons/x";
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { i18n } from "#i18n";
  import { Button } from "@/lib/components/ui/button/index.js";
  import { cn } from "@/lib/utils.js";
  import DialogOverlay from "./dialog-overlay.svelte";
  import DialogPortal from "./dialog-portal.svelte";



  let {
    ref = $bindable(null),
    class: className,
    portalProps,
    children,
    showCloseButton = true,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
    portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
    children: Snippet;
    showCloseButton?: boolean;
  } = $props();
</script>

<!-- Never taller than the popup (zoomed in, it has less room): a long dialog scrolls instead of spilling off screen. -->
<DialogPortal {...portalProps}>
  <DialogOverlay />
  <DialogPrimitive.Content
    bind:ref
    data-slot="dialog-content"
    class={cn(
      "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 border-2 border-border shadow-sticker grid max-w-[calc(100%_-_2rem)] gap-4 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-lg p-4 text-sm duration-100 sm:max-w-sm fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none",
      className,
    )}
    {...restProps}
  >
    {@render children?.()}
    {#if showCloseButton}
      <DialogPrimitive.Close data-slot="dialog-close">
        {#snippet child({ props })}
          <Button variant="ghost" class="absolute top-2 right-2" size="icon-sm" {...props}>
            <XIcon />
            <span class="sr-only">{i18n.t("view.close")}</span>
          </Button>
        {/snippet}
      </DialogPrimitive.Close>
    {/if}
  </DialogPrimitive.Content>
</DialogPortal>
