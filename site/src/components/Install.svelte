<script lang="ts">
  import type { TBrowser } from "../links";

  import { onMount } from "svelte";

  import { BROWSERS, detectBrowser, INSTALL_GUIDE, installUrl, RELEASE, STORES, VERSION } from "../links";



  const waiting = Object.values(STORES).some(url => url === null);
  let browser = $state<TBrowser | null>(null);

  onMount(() => {
    browser = detectBrowser(navigator.userAgent);
  });
</script>

<section id="install" class="section install" aria-labelledby="install-title">
  <div class="page">
    <h2 id="install-title" class="title">Get <span class="marker">Swift TODO</span></h2>
    <p class="lead">Free, for good. Version {VERSION}.</p>

    <ul class="browsers" role="list">
      {#each BROWSERS as entry (entry.id)}
        {@const store = STORES[entry.id]}
        <li class={["browser", browser === entry.id && "yours"]} data-reveal>
          {#if browser === entry.id}
            <span class="badge hand">Your browser</span>
          {/if}
          <h3 class="hand">{entry.name}</h3>
          <p>{entry.note}</p>
          <a class="button" href={installUrl(entry.id)}>
            {store === null ? `Download for ${entry.name}` : `Add to ${entry.name}`}
          </a>
        </li>
      {/each}
    </ul>

    {#if waiting}
      <p class="soon">
        Store listings are on the way. Until then, download the zip for your browser from the
        <a href={RELEASE}>latest release</a> and <a href={INSTALL_GUIDE}>load it in two steps</a>.
      </p>
    {/if}

    <p class="then hand">Then press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> whenever something comes up.</p>
  </div>
</section>

<style>
  .install {
    text-align: center;
  }

  .lead {
    margin: 16px auto 0;
  }

  .browsers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
    gap: 28px;
    margin-top: 48px;
  }

  .browser {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    padding: 32px 22px 28px;
    background: var(--sheet);
    border: 3px solid var(--line);
    border-radius: 20px;
    box-shadow: 0 8px 0 var(--shadow);
  }

  .browser.yours {
    background: var(--note-yellow);
  }

  .badge {
    position: absolute;
    top: -18px;
    padding: 2px 12px;
    font-size: 22px;
    color: #242c88;
    background: var(--pencil);
    border: 2px solid var(--line);
    border-radius: 999px;
    transform: rotate(-3deg);
  }

  h3 {
    font-size: 40px;
  }

  .browser p {
    margin-bottom: 14px;
    font-weight: 700;
    color: var(--muted);
  }

  .soon {
    max-width: 40em;
    margin: 36px auto 0;
    font-weight: 600;
    color: var(--muted);
  }

  .soon a {
    font-weight: 800;
    color: var(--fg);
  }

  .then {
    margin-top: 36px;
    font-size: clamp(26px, 3.4vw, 34px);
  }

  .then kbd {
    font-size: 0.6em;
    vertical-align: 0.2em;
  }
</style>
