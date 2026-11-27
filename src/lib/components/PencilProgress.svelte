<script lang="ts">
  import type { TWritingTool } from "@/lib/appearance";

  import { i18n } from "#i18n";



  type Props = {
    done: number;
    total: number;
    /** Changes whenever the pencil should cheer. */
    wiggle: number;
    /** Overrides what assistive tech hears, when the pencil shows a timer. */
    label?: string;
    valuetext?: string;
    /** What it's drawn as, by skin (`SKIN_TOOLS`). */
    tool?: TWritingTool;
  };

  const { done, total, wiggle, label = i18n.t("header.progressLabel"), valuetext = i18n.t("header.progress", [String(done), String(total)]), tool = "pencil" }: Props = $props();

  const ratio = $derived(total === 0 ? 0 : done / total);
  const TIP = 16;

  // Each tool's back end (eraser, cap, button, feather tip), the band after it, and its body: the part
  // that grows along the line as to-dos get done. Ink-colored lines are the skin's own border color.
  const BACK: Record<Exclude<TWritingTool, "bar">, string> = {
    pencil: "h-full w-3 rounded-l-[6px] border-2 border-r-0 border-border bg-eraser",
    marker: "h-full w-3 rounded-l-[5px] border-2 border-r-0 border-border bg-primary",
    chalk: "h-full w-2 rounded-l-full border-2 border-r-0 border-border/70 bg-(--chalk)",
    quill: "",
    ballpoint: "h-2.5 w-2 rounded-l-[3px] border-2 border-r-0 border-border bg-muted",
  };

  const BAND: Record<Exclude<TWritingTool, "bar">, string> = {
    pencil: "h-full w-2 border-2 border-border bg-ferrule [background-image:linear-gradient(to_right,transparent_45%,rgb(36_44_136/0.25)_45%_55%,transparent_55%)]",
    marker: "h-full w-[3px] bg-border",
    chalk: "",
    quill: "",
    ballpoint: "h-full w-1.5 border-2 border-border bg-(--metal)",
  };

  const BODY: Record<Exclude<TWritingTool, "bar">, string> = {
    // Yellow, with the flat of a hexagonal pencil along it.
    pencil: "border-y-2 border-border bg-pencil [background-image:linear-gradient(to_bottom,transparent_38%,rgb(0_0_0/0.09)_38%_62%,transparent_62%)]",
    // A pale barrel with a band of the ink's color.
    marker: "border-y-2 border-border bg-(--barrel) [background-image:linear-gradient(to_bottom,transparent_30%,var(--primary)_30%_70%,transparent_70%)]",
    // A white stick, lit from above, with chalk dust in its grain.
    chalk: "border-y-2 border-border/70 bg-(--chalk) [background-image:radial-gradient(rgb(0_0_0/0.09)_0.7px,transparent_1.1px),linear-gradient(to_bottom,rgb(255_255_255/0.8)_0_22%,transparent_22%_62%,rgb(0_0_0/0.11)_62%)] [background-size:5px_4px,auto]",
    // A feather's vane: a shaft down the middle, barbs slanting back from it.
    quill: "border-y-2 border-border bg-(--feather) [background-image:linear-gradient(to_bottom,transparent_calc(50%-1px),var(--border)_calc(50%-1px)_calc(50%+0.5px),transparent_calc(50%+0.5px)),repeating-linear-gradient(115deg,transparent_0_4px,var(--barb)_4px_5px),repeating-linear-gradient(65deg,transparent_0_4px,var(--barb)_4px_5px)] [background-size:100%_100%,100%_50%,100%_50%] [background-position:0_0,0_0,0_100%] bg-no-repeat",
    // A smooth barrel in the accent, catching the light on top.
    ballpoint: "border-y-2 border-border bg-primary [background-image:linear-gradient(to_bottom,rgb(255_255_255/0.3)_0_30%,transparent_30%)]",
  };
</script>

<!--
  The icon's pencil as a progress bar: a writing tool that grows along a dashed line as
  to-dos get done. Each skin writes with its own: a pencil, a felt-tip marker, a stick of
  chalk, a quill, a ballpoint, or (Aurora) a plain bar.
-->
<div
  class="flex h-[18px] w-full items-center [--barb:color-mix(in_srgb,var(--border)_28%,transparent)] [--barrel:#fbfaf5] [--chalk:#f7f6ef] [--feather:#f6eedc] [--metal:#d4d4d8]"
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={Math.max(total, 1)}
  aria-valuenow={done}
  aria-valuetext={valuetext}
  data-tool={tool}
>
  {#key wiggle}
    <div class={["flex h-full w-full origin-center items-center", wiggle > 0 && "animate-cheer"]}>
      {#if tool === "bar"}
        <!-- A slim, rounded bar in the accent. -->
        <span class="relative h-2 min-w-0 flex-1 rounded-full bg-foreground/9" data-pencil="track">
          <span
            class="absolute inset-y-0 left-0 min-w-2 rounded-full bg-[linear-gradient(90deg,color-mix(in_srgb,var(--primary)_55%,#ffffff),var(--primary))] transition-[width] duration-500 ease-out"
            data-pencil="grow"
            style:width="calc({TIP}px + (100% - {TIP}px) * {ratio})"
          ></span>
        </span>
      {:else}
        {#if tool === "quill"}
          <!-- The feather's tip, with its shaft running into the vane. -->
          <svg viewBox="0 0 12 18" class="h-full w-3 shrink-0" aria-hidden="true" data-pencil="back">
            <path d="M12 1 C6 1 2.5 5 1 9 C2.5 13 6 17 12 17 Z" fill="var(--feather)" />
            <path d="M12 1 C6 1 2.5 5 1 9 C2.5 13 6 17 12 17" fill="none" stroke="var(--border)" stroke-width="2" stroke-linejoin="round" />
            <path d="M4 9 H12" stroke="var(--border)" stroke-width="1.5" />
          </svg>
        {:else}
          <span class={["shrink-0", BACK[tool]]} data-pencil="back"></span>
        {/if}
        {#if BAND[tool] !== ""}
          <span class={["shrink-0", BAND[tool]]} data-pencil="band"></span>
        {/if}

        <span class="relative h-full min-w-0 flex-1" data-pencil="track">
          <!-- The line still to write. -->
          <span class="absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dashed border-border/30" data-pencil="line"></span>

          <span
            class="absolute inset-y-0 left-0 flex transition-[width] duration-500 ease-out"
            data-pencil="grow"
            style:width="calc({TIP}px + (100% - {TIP}px) * {ratio})"
          >
            <span data-pencil="body" class={["h-full min-w-0 flex-1", BODY[tool]]}></span>
            <svg viewBox="0 0 16 18" class="-ml-px h-full w-4 shrink-0" aria-hidden="true" data-pencil="tip">
              {#if tool === "pencil"}
                <!-- Sharpened wood, and the lead. -->
                <path d="M1 1 L15 9 L1 17 Z" fill="var(--wood)" stroke="var(--border)" stroke-width="2" stroke-linejoin="round" />
                <path d="M9.6 5.8 L15 9 L9.6 12.2 Z" fill="var(--border)" />
              {:else if tool === "marker"}
                <!-- The collar, and the felt tip in the ink's color. -->
                <path d="M1 1 L8 4.5 L8 13.5 L1 17 Z" fill="#d9d4c7" stroke="var(--border)" stroke-width="2" stroke-linejoin="round" />
                <path d="M8 6.5 L12.5 7.4 C15.4 8 15.4 10 12.5 10.6 L8 11.5 Z" fill="var(--primary)" stroke="var(--border)" stroke-width="1.6" stroke-linejoin="round" />
              {:else if tool === "chalk"}
                <!-- Worn round from writing, with no seam where it meets the stick. -->
                <path d="M0 1 H5 C11 1 15 5 15 9 C15 13 11 17 5 17 H0 Z" fill="var(--chalk)" />
                <path d="M0 1 H5 C11 1 15 5 15 9 C15 13 11 17 5 17 H0" fill="none" stroke="var(--border)" stroke-opacity="0.7" stroke-width="2" />
              {:else if tool === "quill"}
                <!-- The vane narrowing to the bare shaft, and the cut nib, wet with ink. -->
                <path d="M0 1 C3 1 5 5 7 7 L7 11 C5 13 3 17 0 17 Z" fill="var(--feather)" />
                <path d="M0 1 C3 1 5 5 7 7 M7 11 C5 13 3 17 0 17" fill="none" stroke="var(--border)" stroke-width="2" />
                <path d="M0 9 H10" stroke="var(--border)" stroke-width="1.5" />
                <path d="M7 7 H10 V11 H7 Z" fill="#eadcbc" stroke="var(--border)" stroke-width="1.4" stroke-linejoin="round" />
                <path d="M10 6.6 L15.5 9 L10 11.4 Z" fill="var(--border)" />
              {:else}
                <!-- A metal cone, and the ball. -->
                <path d="M1 1 L12 7.2 L12 10.8 L1 17 Z" fill="var(--metal)" stroke="var(--border)" stroke-width="2" stroke-linejoin="round" />
                <path d="M12 7.4 L15.5 9 L12 10.6 Z" fill="var(--border)" />
              {/if}
            </svg>
          </span>
        </span>
      {/if}
    </div>
  {/key}
</div>
