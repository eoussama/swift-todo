<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { tick } from "svelte";

  import notepadLight from "../../../showcase/overview.png?webp";
  import auroraDark from "../../../showcase/skin-aurora-dark.png?webp";
  import auroraLight from "../../../showcase/skin-aurora-light.png?webp";
  import chalkDark from "../../../showcase/skin-chalk-dark.png?webp";
  import chalkLight from "../../../showcase/skin-chalk-light.png?webp";
  import minimalDark from "../../../showcase/skin-minimal-dark.png?webp";
  import minimalLight from "../../../showcase/skin-minimal-light.png?webp";
  import notepadDark from "../../../showcase/skin-notepad-dark.png?webp";
  import scrollDark from "../../../showcase/skin-scroll-dark.png?webp";
  import scrollLight from "../../../showcase/skin-scroll-light.png?webp";
  import stickyDark from "../../../showcase/skin-sticky-dark.png?webp";
  import stickyLight from "../../../showcase/skin-sticky-light.png?webp";



  type TTheme = "light" | "dark";

  const SKINS = [
    { id: "notepad", name: "Notepad", about: "Stacked sheets, navy ink and a yellow pencil.", light: notepadLight, dark: notepadDark },
    { id: "sticky", name: "Sticky board", about: "A sticky note pinned to a cork board.", light: stickyLight, dark: stickyDark },
    { id: "chalk", name: "Chalkboard", about: "Chalk on a green board, in a wooden frame.", light: chalkLight, dark: chalkDark },
    { id: "scroll", name: "Scroll", about: "Parchment between wooden rollers, in ink.", light: scrollLight, dark: scrollDark },
    { id: "minimal", name: "Minimal", about: "Flat and calm, with your system's font.", light: minimalLight, dark: minimalDark },
    { id: "aurora", name: "Aurora", about: "Clean and modern, over a glow in your accent color.", light: auroraLight, dark: auroraDark },
  ] as const;

  const ACCENTS = [
    ["Mint", "#39c89a"],
    ["Sky", "#4fb3ef"],
    ["Coral", "#ff7366"],
    ["Violet", "#6d4fe0"],
    ["Amber", "#f4b223"],
    ["Rose", "#ee6aa2"],
    ["Teal", "#17a8a2"],
    ["Ink", "#2d3596"],
  ] as const;

  // Each card's place in the fan: 0 in front, -2 to 2 around it, and the one left over waiting out
  // of sight at the edge (-3 or 3). Turning the fan moves every card one place; the card that has to
  // come round from the far side jumps there while hidden, then slides in from that edge, so no card
  // ever sweeps across the fan.
  const EDGE = 3;
  const places = $state(SKINS.map((_, index) => ((index + SKINS.length + 2) % SKINS.length) - 2));
  // Cards jumping round, out of sight: they move at once, without sliding.
  const jumping = $state(SKINS.map(() => false));
  const front = $derived(places.indexOf(0));
  // The skin picked: the one in front, or the one the fan is turning to, which the buttons and caption show at once.
  let wanted = $state<number | null>(null);
  const selected = $derived(wanted ?? front);
  let theme = $state<TTheme>("light");
  const current = $derived(SKINS[selected]!);
  // A newer turn stops an older one still stepping.
  let turn = 0;
  let stepping: Promise<void> = Promise.resolve();

  const frame = async (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  /**
   * Turns the fan one place: forward brings the next skin to the front.
   *
   * @param by 1 forward, -1 back.
   * @returns Once the cards are on their way.
   */
  async function stepOnce(by: 1 | -1): Promise<void> {
    // The hidden card on the side the fan turns away from comes round to the other side first.
    const from = by === 1 ? -EDGE : EDGE;

    if (places.includes(from)) {
      const index = places.indexOf(from);

      jumping[index] = true;
      places[index] = -from;
      await tick();
      await frame();
      jumping[index] = false;
    }

    for (const index of places.keys()) {
      places[index] = places[index]! - by;
    }
  }

  /**
   * Brings a skin to the front, a place at a time the shortest way round.
   *
   * @param target The skin.
   * @returns Once it's in front.
   */
  async function show(target: number): Promise<void> {
    const mine = ++turn;

    wanted = target;

    // A place at a time, looking again where the fan is before each one; at most a full turn each way.
    for (let moves = 0; moves < SKINS.length * 2; moves++) {
      // A step under way (from an earlier turn, too) finishes first, so steps never overlap.
      await stepping;

      if (mine !== turn || front === target) {
        break;
      }

      if (moves > 0) {
        await new Promise(resolve => setTimeout(resolve, 140));

        if (mine !== turn) {
          break;
        }
      }

      const ahead = (target - front + SKINS.length) % SKINS.length;

      stepping = stepOnce(ahead <= SKINS.length / 2 ? 1 : -1);
    }

    if (mine === turn) {
      wanted = null;
    }
  }

  function step(by: 1 | -1): void {
    void show((selected + by + SKINS.length) % SKINS.length);
  }
</script>

<section id="skins" class="section skins" aria-labelledby="skins-title">
  <div class="page">
    <h2 id="skins-title" class="title">Six skins, <span class="marker">light and dark</span></h2>
    <p class="lead">Pick the desk your list sits on. The theme follows your system, or whichever you choose.</p>

    <div class="carousel" data-reveal>
      <div class="fan" aria-hidden="true">
        {#each SKINS as skin, index (skin.id)}
          {@const place = places[index]!}
          <button
            type="button"
            tabindex="-1"
            class={["card", Math.abs(place) >= EDGE && "away", jumping[index] && "jumping"]}
            style:--offset={place}
            style:--depth={Math.abs(place)}
            style:z-index={10 - Math.abs(place)}
            onclick={() => void show(index)}
          >
            <img src={skin[theme]} alt="" width="380" height="560" loading="lazy" decoding="async" />
          </button>
        {/each}
      </div>

      <p class="caption" aria-live="polite">
        <span class="hand">{current.name}</span>
        <span>{current.about}</span>
        <span class="visually-hidden">Showing the {theme} version.</span>
      </p>

      <div class="controls">
        <button type="button" class="arrow" aria-label="Previous skin" title="Previous skin" onclick={() => step(-1)}>
          <ChevronLeftIcon />
        </button>

        <fieldset class="pills">
          <legend class="visually-hidden">Skin</legend>
          {#each SKINS as skin, index (skin.id)}
            <label class="pill">
              <input type="radio" name="site-skin" value={skin.id} checked={selected === index} onchange={() => void show(index)} />
              <span>{skin.name}</span>
            </label>
          {/each}
        </fieldset>

        <button type="button" class="arrow" aria-label="Next skin" title="Next skin" onclick={() => step(1)}>
          <ChevronRightIcon />
        </button>
      </div>

      <fieldset class="themes">
        <legend class="visually-hidden">Theme</legend>
        <label class="pill">
          <input type="radio" name="site-theme" value="light" bind:group={theme} />
          <span><SunIcon aria-hidden="true" /> Light</span>
        </label>
        <label class="pill">
          <input type="radio" name="site-theme" value="dark" bind:group={theme} />
          <span><MoonIcon aria-hidden="true" /> Dark</span>
        </label>
      </fieldset>

      <p class="accents">
        <span>Plus eight accent colors:</span>
        <span class="swatches" role="list">
          {#each ACCENTS as [name, color] (name)}
            <span class="swatch" role="listitem" style:background={color} title={name}><span class="visually-hidden">{name}</span></span>
          {/each}
        </span>
      </p>
    </div>
  </div>
</section>

<style>
  .skins {
    overflow: hidden;
    text-align: center;
  }

  .lead {
    margin: 16px auto 0;
  }

  .carousel {
    display: flex;
    flex-direction: column;
    gap: 22px;
    align-items: center;
    margin-top: 40px;
  }

  .fan {
    --card: clamp(190px, 26vw, 290px);

    position: relative;
    width: 100%;
    height: calc(var(--card) * 1.474 + 40px);
    perspective: 1400px;
  }

  .card {
    position: absolute;
    top: 10px;
    left: calc(50% - var(--card) / 2);
    width: var(--card);
    padding: 0;
    background: none;
    border: 0;
    transform:
      translateX(calc(var(--offset) * var(--spread) * var(--card) * 0.62))
      translateZ(calc(var(--depth) * var(--spread) * -120px))
      rotateY(calc(var(--offset) * var(--spread) * -22deg))
      rotate(calc(var(--offset) * 2deg));
    transition: transform 0.55s cubic-bezier(0.2, 0.7, 0.3, 1), filter 0.55s, opacity 0.4s;
    filter: brightness(calc(1 - var(--depth) * 0.08));
  }

  /* The card left over, out of sight at the edge, until it comes round. */
  .card.away {
    opacity: 0;
    pointer-events: none;
  }

  .card.jumping {
    transition: none;
  }

  /* Stacked until the section scrolls in, then fanned out. */
  .fan {
    --spread: 1;
  }

  :global(.js) .carousel:not([data-shown]) .fan {
    --spread: 0;
  }

  :global(.js) .carousel:global([data-shown]) .card {
    transition-duration: 0.9s;
    transition-delay: 0.15s;
  }

  .card img {
    width: 100%;
    border: 3px solid var(--line);
    border-radius: 18px;
    box-shadow: 0 9px 0 var(--shadow);
  }

  .caption {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
    min-height: 3.4em;
    font-weight: 700;
    color: var(--muted);
  }

  .caption .hand {
    font-size: 34px;
    color: var(--fg);
  }

  .controls {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
    max-width: 100%;
  }

  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    min-width: 0;
    padding: 0;
    margin: 0;
    border: 0;
  }

  .pill {
    position: relative;
  }

  .pill input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .pill span {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 7px 14px;
    font-size: 15px;
    font-weight: 800;
    white-space: nowrap;
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 999px;
    box-shadow: 0 3px 0 var(--shadow);
    transition: background-color 0.15s, transform 0.12s, box-shadow 0.12s;
  }

  .pill :global(svg) {
    width: 16px;
    height: 16px;
  }

  .pill:hover span {
    background: var(--chip);
  }

  .pill input:checked + span {
    color: #242c88;
    background: var(--pencil);
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--shadow);
  }

  .pill input:focus-visible + span {
    outline: 2px solid var(--line);
    outline-offset: 2px;
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--pencil-deep) 70%, transparent);
  }

  .arrow {
    display: grid;
    flex: none;
    place-items: center;
    width: 42px;
    height: 42px;
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 50%;
    box-shadow: 0 3px 0 var(--shadow);
  }

  .arrow:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--shadow);
  }

  .accents {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: var(--muted);
  }

  .swatches {
    display: flex;
    gap: 6px;
  }

  .swatch {
    width: 22px;
    height: 22px;
    border: 2px solid var(--line);
    border-radius: 50%;
  }

  @media (max-width: 640px) {
    .arrow {
      display: none;
    }
  }
</style>
