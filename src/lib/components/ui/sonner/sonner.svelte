<script lang="ts">
  import type { ToasterProps as SonnerProps } from "svelte-sonner";

  import { Toaster as Sonner } from "svelte-sonner";



  const { ...restProps }: SonnerProps = $props();
</script>

<!-- Follows the system theme, like the rest of the popup. -->
<Sonner
  theme="system"
  class="toaster group"
  style="--normal-bg: var(--color-card); --normal-text: var(--color-card-foreground); --normal-border: var(--color-border); --width: 340px;"
  toastOptions={{
    classes: {
      toast: "font-sans! border-2! rounded-xl! shadow-sticker! text-[13px]! font-semibold!",
      actionButton: "bg-primary! text-primary-foreground! border-2! border-border! font-bold! rounded-md!",
    },
  }}
  {...restProps}
/>
