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
        <a class="button" href={store ?? "#install"}>
          {name === null ? "Get Swift TODO" : store === null ? `Get it for ${name}` : `Add to ${name}`}
        </a>
        <a class="button secondary" href="#trailer">
          <PlayIcon fill="currentColor" />
          Watch the trailer
        </a>
      </div>

      <p class="small">Free and open source · Chrome, Edge and Firefox · No sign-up</p>
    </div>

    <div class="art" aria-hidden="true">
      <div class="note hand">dentist??</div>
      <img class="shot back" src={notepadDark} alt="" width="380" height="560" />
      <img class="shot front" src={overview} alt="" width="380" height="560" fetchpriority="high" />
      <Pencil class="pencil" />
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

  /* Peeking out from behind the popups. */
  .note {
    position: absolute;
    top: -9%;
    right: -7%;
    z-index: 0;
    display: grid;
    place-items: start center;
    width: 40%;
    aspect-ratio: 1;
    padding: 20px 12px;
    font-size: clamp(24px, 3vw, 34px);
    background: var(--note-mint);
    transform: rotate(8deg);
    box-shadow: 0 6px 0 color-mix(in srgb, var(--shadow) 25%, transparent);
  }

  .note::before {
    position: absolute;
    top: -12px;
    left: 30%;
    width: 40%;
    height: 24px;
    content: "";
    background: var(--tape);
    transform: rotate(3deg);
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
