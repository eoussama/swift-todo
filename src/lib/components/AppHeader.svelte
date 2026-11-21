<script lang="ts">
  import { i18n } from "#i18n";

  import icon from "@/assets/icon.svg";

  import PencilProgress from "./PencilProgress.svelte";



  type Props = {
    done: number;
    total: number;
    /** False until the list has loaded, so opening a finished list doesn't celebrate. */
    ready: boolean;
  };

  const { done, total, ready }: Props = $props();

  const allDone = $derived(total > 0 && done === total);
  const summary = $derived(
    total === 0
      ? i18n.t("header.empty")
      : allDone
      ? i18n.t("header.allDone")
      : i18n.t("header.progress", [String(done), String(total)]),
  );

  // Celebrate when the last to-do gets checked off.
  let celebrations = $state(0);
  let wasAllDone: boolean | null = null;

  $effect(() => {
    const now = allDone;

    if (!ready) {
      return;
    }

    if (wasAllDone === false && now) {
      celebrations++;
    }

    wasAllDone = now;
  });

  const COLORS = ["var(--mint)", "var(--pencil)", "var(--eraser)", "var(--sky)"];

  // Fixed pseudo-random spread, fanning down from the top center of the popup.
  const PIECES = 28;
  const confetti = Array.from({ length: PIECES }, (_, i) => {
    const angle = Math.PI * (0.08 + 0.84 * (i / (PIECES - 1))) + ((i % 3) - 1) * 0.06;
    const distance = 80 + ((i * 53) % 130);

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * 0.95 + 16,
      r: ((i * 97) % 360) - 180,
      delay: (i % 6) * 30,
      color: COLORS[i % COLORS.length],
      round: i % 3 === 0,
    };
  });
</script>

<header class="relative px-4 pt-3.5 pb-3">
  <div class="flex items-end gap-2.5">
    <img src={icon} alt="" class="size-9 -rotate-6 drop-shadow-[0_2px_0_var(--sticker)]" />
    <h1 class="font-hand text-[29px] leading-[0.9] font-bold tracking-tight">{i18n.t("extName")}</h1>
    <p
      class={["ml-auto font-hand text-[21px] leading-none font-bold whitespace-nowrap transition-colors", allDone && "text-[color-mix(in_srgb,var(--mint)_55%,var(--foreground))]"]}
      aria-live="polite"
    >
      {summary}
    </p>
  </div>

  <div class="relative mt-2.5">
    <PencilProgress {done} {total} wiggle={celebrations} />

    {#key celebrations}
      {#if celebrations > 0}
        <div class="pointer-events-none fixed top-0 left-1/2 z-50" aria-hidden="true">
          {#each confetti as piece, i (i)}
            <span
              class={["absolute block border-[1.5px] border-border animate-burst", piece.round ? "size-2 rounded-full" : "h-2.5 w-1.5 rounded-[1px]"]}
              style:background={piece.color}
              style:--x="{piece.x}px"
              style:--y="{piece.y}px"
              style:--r="{piece.r}deg"
              style:animation-delay="{piece.delay}ms"
            ></span>
          {/each}
        </div>
      {/if}
    {/key}
  </div>
</header>
