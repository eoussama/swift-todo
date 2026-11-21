<script lang="ts">
  import type { ToasterProps as SonnerProps } from "svelte-sonner";

  import { Toaster as Sonner } from "svelte-sonner";



  const { ...restProps }: SonnerProps = $props();
</script>

<!-- Toasts are sticky notes: pale yellow paper with a navy outline. -->
<Sonner
  theme="system"
  class="toaster group"
  style="--normal-bg: var(--color-note); --normal-text: var(--color-card-foreground); --normal-border: var(--color-border); --width: 330px;"
  toastOptions={{
    classes: {
      toast: "font-sans! border-2! rounded-[6px]! shadow-sticker! text-[13px]! font-bold!",
      actionButton: "bg-ink! text-paper! dark:bg-pencil! dark:text-ink! font-bold! rounded-full! px-3!",
    },
  }}
  {...restProps}
/>
