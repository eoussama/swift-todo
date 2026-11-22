<script lang="ts">
  import { onMount } from "svelte";

  import { perFrame } from "../frame";
  import { PRIVACY, REPO } from "../links";
  import GitHub from "./GitHub.svelte";
  import Logo from "./Logo.svelte";



  type Props = {
    /** Where the page's sections are: "" on the home page, "/" elsewhere. */
    home?: string;
  };

  const { home = "" }: Props = $props();

  // The page's sections, in the bar and in the menu.
  const SECTIONS = [["try", "Try it"], ["features", "Features"], ["skins", "Skins"], ["faq", "FAQ"]] as const;

  let scrolled = $state(false);
  let menuOpen = $state(false);
  let progress = $state(0);

  // A pencil line under the bar writes itself as the page is read.
  onMount(() => {
    const update = (): void => {
      const room = document.documentElement.scrollHeight - innerHeight;

      scrolled = scrollY > 8;
      progress = room <= 0 ? 0 : Math.min(1, scrollY / room);
    };
    const onScroll = perFrame(update);

    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);

    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  });
</script>

<header class={["bar", scrolled && "scrolled"]}>
  <nav class="page inner" aria-label="Main">
    <a class="brand" href="{home}#top" aria-label="Swift TODO, back to the top">
      <Logo size={34} />
      <span class="hand">Swift TODO</span>
    </a>

    <ul class="links" role="list">
      {#each SECTIONS as [id, label] (id)}
        <li class="wide"><a href="{home}#{id}">{label}</a></li>
      {/each}
      <li><a href={PRIVACY}>Privacy</a></li>
    </ul>

    <!-- Below 860px the section links fold into this menu. -->
    <details class="menu" bind:open={menuOpen}>
      <summary>Menu</summary>
      <ul role="list">
        {#each SECTIONS as [id, label] (id)}
          <li><a href="{home}#{id}" onclick={() => (menuOpen = false)}>{label}</a></li>
        {/each}
        <li class="narrow"><a href={PRIVACY}>Privacy</a></li>
      </ul>
    </details>

    <a class="github" href={REPO} target="_blank" rel="noopener noreferrer" aria-label="Swift TODO on GitHub" title="Swift TODO on GitHub">
      <GitHub />
    </a>
    <a class="button small" href="{home}#install">Install</a>
  </nav>

  <!-- The extension's progress pencil: it grows along the dashed line as the page is read. -->
  <div class="pencil" aria-hidden="true">
    <span class="eraser"></span>
    <span class="band"></span>
    <span class="track">
      <span class="grow" style:width="calc(12px + (100% - 12px) * {progress})">
        <span class="body"></span>
        <svg viewBox="0 0 16 18" class="tip">
          <path d="M1 1 L15 9 L1 17 Z" fill="var(--wood)" stroke="var(--line)" stroke-width="2" stroke-linejoin="round" />
          <path d="M9.6 5.8 L15 9 L9.6 12.2 Z" fill="var(--line)" />
        </svg>
      </span>
    </span>
  </div>
</header>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 50;
    padding-block: 10px;
    background: color-mix(in srgb, var(--desk) 82%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 2px solid color-mix(in srgb, var(--line) 14%, transparent);
    transition: box-shadow 0.25s, background-color 0.25s;
  }

  .bar.scrolled {
    background: color-mix(in srgb, var(--desk) 92%, transparent);
    box-shadow: 0 6px 18px -10px color-mix(in srgb, var(--shadow) 55%, transparent);
  }

  .pencil {
    position: absolute;
    right: 12px;
    bottom: -9px;
    left: 12px;
    display: flex;
    align-items: center;
    height: 17px;
    pointer-events: none;
  }

  .eraser {
    flex: none;
    width: 13px;
    height: 100%;
    background: var(--eraser);
    border: 2px solid var(--line);
    border-right: 0;
    border-radius: 5px 0 0 5px;
  }

  .band {
    flex: none;
    width: 9px;
    height: 100%;
    background: var(--ferrule) linear-gradient(to right, transparent 45%, rgb(36 44 136 / 0.25) 45% 55%, transparent 55%);
    border: 2px solid var(--line);
  }

  .track {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 100%;
  }

  /* The line still to write. */
  .track::before {
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    content: "";
    border-top: 2px dashed color-mix(in srgb, var(--line) 30%, transparent);
    transform: translateY(-50%);
  }

  .grow {
    position: absolute;
    inset-block: 0;
    left: 0;
    display: flex;
  }

  .body {
    flex: 1;
    min-width: 0;
    background: var(--pencil) linear-gradient(to bottom, transparent 38%, rgb(0 0 0 / 0.09) 38% 62%, transparent 62%);
    border-block: 2px solid var(--line);
  }

  .tip {
    flex: none;
    width: 16px;
    height: 100%;
    margin-left: -1px;
  }

  .inner {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .brand {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-right: auto;
    text-decoration: none;
  }

  .brand span {
    font-size: 29px;
    white-space: nowrap;
  }

  .links {
    display: flex;
    gap: 4px;
  }

  .links a {
    position: relative;
    display: block;
    padding: 6px 12px;
    font-weight: 800;
    text-decoration: none;
    border-radius: 10px;
  }

  /* A highlighter stroke slides in under the hovered link. */
  .links a::after {
    position: absolute;
    right: 10px;
    bottom: 6px;
    left: 10px;
    height: 7px;
    content: "";
    background: var(--highlight);
    border-radius: 2px;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.25s cubic-bezier(0.6, 0, 0.3, 1);
    z-index: -1;
  }

  .links a:hover::after {
    transform: scaleX(1);
  }

  .github {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    transition: transform 0.2s;
  }

  .github:hover {
    background: color-mix(in srgb, var(--sheet) 70%, transparent);
    transform: rotate(-8deg);
  }

  .menu {
    position: relative;
    display: none;
  }

  .menu summary {
    padding: 6px 12px;
    font-weight: 800;
    list-style: none;
    border-radius: 10px;
    cursor: pointer;
  }

  .menu summary::-webkit-details-marker {
    display: none;
  }

  .menu summary::after {
    margin-left: 6px;
    content: "▾";
  }

  .menu[open] summary::after {
    content: "▴";
  }

  .menu ul {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 160px;
    padding: 8px;
    margin: 0;
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 6px 0 var(--shadow);
  }

  .menu a {
    display: block;
    padding: 8px 12px;
    font-weight: 800;
    text-decoration: none;
    border-radius: 10px;
  }

  .menu a:hover {
    background: var(--chip);
  }

  @media (max-width: 860px) {
    .wide {
      display: none;
    }

    .menu {
      display: block;
    }
  }

  .menu .narrow {
    display: none;
  }

  /* Phones: Privacy joins the menu, so the bar fits. */
  @media (max-width: 560px) {
    .links {
      display: none;
    }

    .menu .narrow {
      display: block;
    }
  }

  @media (max-width: 420px) {
    .inner {
      gap: 6px;
    }

    .github {
      display: none;
    }

    .links a {
      padding-inline: 8px;
    }

    .brand span {
      font-size: 25px;
    }
  }

  /* The smallest phones keep the logo, which is still labeled, and drop the name. */
  @media (max-width: 350px) {
    .brand span {
      display: none;
    }
  }
</style>
