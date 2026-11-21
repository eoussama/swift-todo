<script lang="ts">
  import { onMount } from "svelte";

  import { PRIVACY, REPO } from "../links";
  import GitHub from "./GitHub.svelte";
  import Logo from "./Logo.svelte";



  type Props = {
    /** Where the page's sections are: "" on the home page, "/" elsewhere. */
    home?: string;
  };

  const { home = "" }: Props = $props();

  let scrolled = $state(false);
  let progress = $state(0);

  // A pencil line under the bar writes itself as the page is read.
  onMount(() => {
    let queued = false;

    const update = (): void => {
      queued = false;

      const room = document.documentElement.scrollHeight - innerHeight;

      scrolled = scrollY > 8;
      progress = room <= 0 ? 0 : Math.min(1, scrollY / room);
    };

    const onScroll = (): void => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };

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
      <li class="wide"><a href="{home}#try">Try it</a></li>
      <li class="wide"><a href="{home}#features">Features</a></li>
      <li class="wide"><a href="{home}#skins">Skins</a></li>
      <li class="wide"><a href="{home}#faq">FAQ</a></li>
      <li><a href={PRIVACY}>Privacy</a></li>
    </ul>

    <a class="github" href={REPO} aria-label="Swift TODO on GitHub" title="Swift TODO on GitHub">
      <GitHub />
    </a>
    <a class="button small" href="{home}#install">Install</a>
  </nav>

  <div class="pencil" style:width="{progress * 100}%" aria-hidden="true"></div>
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

  /* The yellow body with a wood tip, like the extension's progress pencil. */
  .pencil {
    position: absolute;
    bottom: -3px;
    left: 0;
    height: 4px;
    background: var(--pencil);
    border-radius: 0 2px 2px 0;
  }

  .pencil::after {
    position: absolute;
    top: -2px;
    right: -9px;
    width: 0;
    height: 0;
    content: "";
    border-block: 4px solid transparent;
    border-left: 9px solid var(--wood);
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

  @media (max-width: 860px) {
    .wide {
      display: none;
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
