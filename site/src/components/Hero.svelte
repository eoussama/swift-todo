<script lang="ts">
  import type { TBrowser } from "../links";

  import PlayIcon from "@lucide/svelte/icons/play";
  import { onMount } from "svelte";

  import overview from "../../../showcase/overview.png";
  import notepadDark from "../../../showcase/skin-notepad-dark.png";
  import { BROWSERS, detectBrowser, STORES } from "../links";
  import Logo from "./Logo.svelte";
  import Pencil from "./Pencil.svelte";



  let browser = $state<TBrowser | null>(null);
  const name = $derived(BROWSERS.find(entry => entry.id === browser)?.name ?? null);
  const store = $derived(browser === null ? null : STORES[browser]);

  // The main button is named after the visitor's browser once the page knows it.
  onMount(() => {
    browser = detectBrowser(navigator.userAgent);
  });
</script>

<section id="top" class="hero">
  <div class="page grid">
    <div class="copy">
      <p class="brand">
        <Logo size={64} />
        <span class="name">Swift TODO</span>
      </p>

      <h1 class="title">Your to-dos, <span class="marker">one click</span> away.</h1>

      <p class="lead">
        A quick to-do list in your browser toolbar. Click the icon or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>,
        type, press <kbd>Enter</kbd>, and get back to what you were doing.
      </p>

      <div class="actions">
        <a class="button" href={store ?? "#install"} target={store === null ? undefined : "_blank"} rel={store === null ? undefined : "noopener noreferrer"}>
          {name === null ? "Get Swift TODO" : store === null ? `Get it for ${name}` : `Add to ${name}`}
        </a>
        <a class="button secondary" href="#trailer">
          <PlayIcon fill="currentColor" />
          Watch the trailer
        </a>
      </div>

      <p class="small">Free and open source · Chrome, Edge and Firefox · No sign-up</p>
    </div>

    <!-- Each layer drifts at its own depth while scrolling (data-parallax, see main.ts). -->
    <div class="art" aria-hidden="true">
      <div class="layer back-layer" data-parallax="0.08"><img class="shot back" src={notepadDark} alt="" width="380" height="560" /></div>
      <div class="layer front-layer" data-parallax="-0.04"><img class="shot front" src={overview} alt="" width="380" height="560" fetchpriority="high" /></div>
      <div class="layer pencil-layer" data-parallax="-0.2"><Pencil class="pencil" /></div>
    </div>
  </div>
</section>

<style>
  .hero {
    padding-block: clamp(36px, 7vw, 88px) clamp(64px, 9vw, 120px);
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: clamp(32px, 5vw, 72px);
    align-items: center;
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: 26px;
    align-items: flex-start;
  }

  .brand {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .name {
    font-family: var(--font-brush);
    font-size: clamp(40px, 5vw, 56px);
    line-height: 1;
  }

  .hero .title {
    font-size: clamp(56px, 8.4vw, 104px);
  }

  .lead {
    line-height: 1.7;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .small {
    font-size: 15px;
    font-weight: 700;
    color: var(--muted);
  }

  .art {
    position: relative;
    aspect-ratio: 1 / 1.08;
    width: 100%;
    max-width: 520px;
    margin-inline: auto;
    animation: float 7s 1.8s ease-in-out infinite;
  }

  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .front-layer {
    z-index: 2;
  }

  .pencil-layer {
    z-index: 3;
  }

  /* On load: the words rise one after another, then the art slides in around them. */
  .copy > * {
    animation: rise 0.8s cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
  }

  .copy > :nth-child(2) { animation-delay: 0.08s; }
  .copy > :nth-child(3) { animation-delay: 0.22s; }
  .copy > :nth-child(4) { animation-delay: 0.34s; }
  .copy > :nth-child(5) { animation-delay: 0.44s; }

  .hero .marker {
    animation: highlight 0.7s 0.75s cubic-bezier(0.6, 0, 0.3, 1) backwards;
  }

  .front {
    animation: front-in 1s 0.2s cubic-bezier(0.2, 0.8, 0.3, 1.08) backwards;
  }

  .back {
    animation: back-in 1s 0.38s cubic-bezier(0.2, 0.8, 0.3, 1.08) backwards;
  }

  .art :global(.pencil) {
    animation: pencil-in 0.9s 0.6s cubic-bezier(0.2, 0.8, 0.3, 1) backwards;
  }

  @keyframes front-in {
    from {
      opacity: 0;
      transform: translate(90px, 50px) rotate(9deg);
    }
  }

  @keyframes back-in {
    from {
      opacity: 0;
      transform: translate(60px, 80px) rotate(18deg);
    }
  }

  @keyframes pencil-in {
    from {
      opacity: 0;
      transform: translateX(-70%) rotate(-9deg);
    }
  }

  .shot {
    position: absolute;
    width: 66%;
    border: 3px solid var(--line);
    border-radius: 18px;
    box-shadow: 0 9px 0 var(--shadow);
  }

  .front {
    top: 2%;
    left: 4%;
    transform: rotate(-4deg);
    z-index: 2;
  }

  .back {
    top: 6%;
    right: 0;
    transform: rotate(6deg);
    z-index: 1;
  }

  .art :global(.pencil) {
    position: absolute;
    bottom: -4%;
    left: -2%;
    z-index: 3;
    width: 92%;
    transform: rotate(-9deg);
    filter: drop-shadow(0 6px 0 var(--shadow));
  }

  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .art {
      max-width: 420px;
    }
  }
</style>
