<script lang="ts">
  import type { ToasterProps as SonnerProps } from "svelte-sonner";

  import { Toaster as Sonner } from "svelte-sonner";
  import { i18n } from "#i18n";



  const { ...restProps }: SonnerProps = $props();
</script>

<!--
  Toasts are sticky notes: pale yellow paper with a navy outline, and a close button at the
  right end (after Undo, when there is one), in place of sonner's badge on the corner.
-->
<Sonner
  theme="system"
  class="toaster group"
  closeButton
  closeButtonAriaLabel={i18n.t("toast.close")}
  style="--normal-bg: var(--color-note); --normal-text: var(--color-card-foreground); --normal-border: var(--color-border); --width: 330px;"
  toastOptions={{
    classes: {
      toast: "font-sans! border-2! rounded-[6px]! shadow-sticker! text-[13px]! font-bold!",
      content: "min-w-0 flex-1",
      closeButton: "static! order-last! size-6! shrink-0 -mr-1.5 transform-none! rounded-full! border-0! bg-transparent! text-current! opacity-70 hover:bg-(--tag)! hover:opacity-100 focus-visible:focus-ring [&_svg]:size-3.5",
      actionButton: "bg-ink! text-paper! dark:bg-pencil! dark:text-ink! font-bold! rounded-full! px-3!",
    },
  }}
  {...restProps}
/>
