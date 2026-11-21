<script lang="ts" module>
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
  import type { VariantProps } from "tailwind-variants";
  import type { WithElementRef } from "@/lib/utils.js";

  import { tv } from "tailwind-variants";


  // Restyled after the icon: thick navy outlines and a flat offset shadow that presses in.
  export const buttonVariants = tv({
    base: "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 text-sm font-bold whitespace-nowrap transition-[transform,box-shadow,background-color,color] outline-none select-none focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    variants: {
      variant: {
        default: "border-border bg-primary text-primary-foreground shadow-sticker-sm hover:brightness-105 active:translate-y-0.5 active:shadow-none",
        outline: "border-border bg-card text-foreground shadow-sticker-sm hover:bg-secondary active:translate-y-0.5 active:shadow-none",
        secondary: "border-border bg-secondary text-secondary-foreground hover:brightness-105",
        ghost: "border-transparent text-foreground hover:bg-muted",
        destructive: "border-transparent text-muted-foreground hover:bg-destructive-soft hover:text-destructive",
        link: "border-transparent text-foreground underline-offset-4 hover:underline",
      },
      size: {
        "default": "h-9 px-3",
        "sm": "h-8 px-2.5 text-[13px]",
        "lg": "h-11 px-4",
        "icon": "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
  export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

  export type ButtonProps = WithElementRef<HTMLButtonAttributes>
    & WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
    };
</script>

<script lang="ts">
  import { cn } from "@/lib/utils.js";



  let {
    class: className,
    variant = "default",
    size = "default",
    ref = $bindable(null),
    href = undefined,
    type = "button",
    disabled,
    children,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    href={disabled ? undefined : href}
    aria-disabled={disabled}
    role={disabled ? "link" : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {type}
    {disabled}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}
