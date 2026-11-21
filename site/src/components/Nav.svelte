<script lang="ts">
  import { REPO } from "../links";
  import GitHub from "./GitHub.svelte";
  import Logo from "./Logo.svelte";



  type Props = {
    /** Where the page's sections are: "" on the home page, "/" elsewhere. */
    home?: string;
  };

  const { home = "" }: Props = $props();
</script>

<header class="bar">
  <nav class="page inner" aria-label="Main">
    <a class="brand" href="{home}#top" aria-label="Swift TODO, back to the top">
      <Logo size={34} />
      <span class="hand">Swift TODO</span>
    </a>

    <ul class="links" role="list">
      <li><a href="{home}#try">Try it</a></li>
      <li><a href="{home}#features">Features</a></li>
      <li><a href="{home}#skins">Skins</a></li>
      <li><a href="{home}#faq">FAQ</a></li>
    </ul>

    <a class="github" href={REPO} aria-label="Swift TODO on GitHub" title="Swift TODO on GitHub">
      <GitHub />
    </a>
    <a class="button small" href="{home}#install">Install</a>
  </nav>
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
    display: block;
    padding: 6px 12px;
    font-weight: 800;
    text-decoration: none;
    border-radius: 10px;
  }

  .links a:hover {
    background: color-mix(in srgb, var(--sheet) 70%, transparent);
  }

  .github {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
  }

  .github:hover {
    background: color-mix(in srgb, var(--sheet) 70%, transparent);
  }

  @media (max-width: 760px) {
    .links {
      display: none;
    }
  }
</style>
