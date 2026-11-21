<script lang="ts">
  type TKind = "note" | "check" | "star" | "swirl" | "circle" | "plane" | "clip" | "plus";

  type TDoodle = {
    kind: TKind;
    /** Down the page, in percent of its height. */
    top: number;
    side: "left" | "right";
    /** From that side, in percent of the width. */
    inset: number;
    size: number;
    turn: number;
    /** How far away it is: the higher, the slower it scrolls. */
    depth: number;
    color?: "yellow" | "pink" | "mint" | "blue";
  };

  // Scattered down the margins, at different depths.
  const DOODLES: ReadonlyArray<TDoodle> = [
    { kind: "note", top: 1.6, side: "left", inset: 0.6, size: 46, turn: -12, depth: 0.3, color: "yellow" },
    { kind: "star", top: 8, side: "right", inset: 2.5, size: 38, turn: 10, depth: 0.45 },
    { kind: "check", top: 14, side: "left", inset: 3, size: 54, turn: -6, depth: 0.18 },
    { kind: "plane", top: 19.5, side: "right", inset: 3, size: 76, turn: -8, depth: 0.32 },
    { kind: "swirl", top: 26, side: "left", inset: 0.5, size: 96, turn: 0, depth: 0.22 },
    { kind: "note", top: 31, side: "right", inset: 1.5, size: 56, turn: 9, depth: 0.38, color: "pink" },
    { kind: "circle", top: 37.5, side: "left", inset: 2, size: 86, turn: -4, depth: 0.2 },
    { kind: "clip", top: 43, side: "right", inset: 3.5, size: 46, turn: 22, depth: 0.3 },
    { kind: "star", top: 49, side: "left", inset: 5, size: 30, turn: -14, depth: 0.5 },
    { kind: "note", top: 54.5, side: "left", inset: 1.5, size: 58, turn: 7, depth: 0.26, color: "mint" },
    { kind: "check", top: 60, side: "right", inset: 2.5, size: 48, turn: 8, depth: 0.34 },
    { kind: "plus", top: 66, side: "left", inset: 4, size: 34, turn: 0, depth: 0.42 },
    { kind: "swirl", top: 71.5, side: "right", inset: 0.5, size: 92, turn: 180, depth: 0.22 },
    { kind: "plane", top: 78, side: "left", inset: 2.5, size: 66, turn: 14, depth: 0.32 },
    { kind: "note", top: 84, side: "right", inset: 2.5, size: 54, turn: -10, depth: 0.28, color: "blue" },
    { kind: "star", top: 90, side: "left", inset: 6, size: 34, turn: 6, depth: 0.4 },
    { kind: "circle", top: 95, side: "right", inset: 3, size: 70, turn: 12, depth: 0.24 },
  ];
</script>

<!-- The desk, drifting slower than the page, and doodles at different depths. Decoration only. -->
<div class="desk" data-desk aria-hidden="true"></div>

<div class="doodles" aria-hidden="true">
  {#each DOODLES as doodle, i (i)}
    <div
      class="doodle {doodle.kind} {doodle.color ?? ""}"
      data-parallax={doodle.depth}
      style:top="{doodle.top}%"
      style:left={doodle.side === "left" ? `${doodle.inset}%` : null}
      style:right={doodle.side === "right" ? `${doodle.inset}%` : null}
      style:width="{doodle.size}px"
      style:--r="{doodle.turn}deg"
    >
      {#if doodle.kind === "check"}
        <svg viewBox="0 0 60 56" fill="none"><path d="M7 30l15 14L53 11" stroke="var(--mint)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {:else if doodle.kind === "star"}
        <svg viewBox="0 0 60 60"><path d="M30 3c2 17 10 25 27 27-17 2-25 10-27 27-2-17-10-25-27-27C20 28 28 20 30 3z" fill="var(--pencil)" stroke="var(--line)" stroke-width="3" stroke-linejoin="round" /></svg>
      {:else if doodle.kind === "swirl"}
        <svg viewBox="0 0 96 60" fill="none"><path d="M4 46C16 12 40 8 40 30c0 16-20 16-18 2 3-18 34-22 70-10" stroke="var(--line)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 9" /></svg>
      {:else if doodle.kind === "circle"}
        <svg viewBox="0 0 100 70" fill="none"><path d="M52 8c30-2 46 14 42 32-4 18-38 26-66 18C6 52 4 30 20 18 34 8 62 4 80 14" stroke="var(--coral)" stroke-width="3.5" stroke-linecap="round" /></svg>
      {:else if doodle.kind === "plane"}
        <svg viewBox="0 0 80 74" fill="none"><path d="M4 32L76 4 54 70 38 44z" fill="var(--sheet)" stroke="var(--line)" stroke-width="3.5" stroke-linejoin="round" /><path d="M38 44L76 4M38 44l-4 18 12-12" stroke="var(--line)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" /></svg>
      {:else if doodle.kind === "clip"}
        <svg viewBox="0 0 40 80" fill="none"><path d="M12 56V16a8 8 0 0 1 16 0v46a12 12 0 0 1-24 0V22" stroke="var(--line)" stroke-width="3.5" stroke-linecap="round" /></svg>
      {:else if doodle.kind === "plus"}
        <svg viewBox="0 0 40 40" fill="none"><path d="M20 5v30M5 20h30" stroke="var(--eraser)" stroke-width="7" stroke-linecap="round" /></svg>
      {/if}
    </div>
  {/each}
</div>

<style>
  .desk {
    position: fixed;
    inset: -24px 0;
    z-index: -1;
    background: radial-gradient(var(--desk-dots) 1.4px, transparent 1.7px) 0 0 / 22px 22px;
    pointer-events: none;
    will-change: translate;
  }

  .doodles {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .doodle {
    position: absolute;
    opacity: 0.7;
    transform: rotate(var(--r));
    will-change: translate;
  }

  .doodle svg {
    width: 100%;
    height: auto;
  }

  .note {
    aspect-ratio: 1;
    background: var(--note);
    opacity: 0.85;
    box-shadow: 0 4px 0 color-mix(in srgb, var(--shadow) 18%, transparent);
  }

  .note::before {
    position: absolute;
    top: -8px;
    left: 25%;
    width: 50%;
    height: 16px;
    content: "";
    background: var(--tape);
    transform: rotate(-4deg);
  }

  .yellow { --note: var(--note-yellow); }
  .pink { --note: var(--note-pink); }
  .mint { --note: var(--note-mint); }
  .blue { --note: var(--note-blue); }

  .star {
    animation: twinkle 3.6s ease-in-out 1;
  }

  .star:nth-of-type(2n) {
    animation-delay: -1.8s;
  }

  @media (max-width: 900px) {
    .doodles {
      display: none;
    }
  }
</style>
