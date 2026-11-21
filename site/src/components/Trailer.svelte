<script lang="ts">
  import PlayIcon from "@lucide/svelte/icons/play";

  import poster from "../../public/og.png?webp";
  import { TRAILER } from "../links";



  let playing = $state(false);
  let player = $state<HTMLIFrameElement | null>(null);

  // The poster had focus; the player that replaces it takes it.
  $effect(() => {
    player?.focus();
  });

  // Nothing loads from YouTube until the visitor asks for the video.
  function play(event: MouseEvent): void {
    // Open in YouTube as usual with a modifier key (new tab, new window).
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    playing = true;
  }
</script>

<section id="trailer" class="section trailer" aria-labelledby="trailer-title">
  <div class="page">
    <h2 id="trailer-title" class="title">Thirty seconds, <span class="marker">start to done</span></h2>
    <p class="lead">From a pile of sticky notes to “All done!”, with everything in between.</p>

    <div class="frame sticker" data-reveal="pop">
      {#if playing}
        <iframe
          bind:this={player}
          src={TRAILER.embed}
          title="Swift TODO trailer"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      {:else}
        <a class="poster" href={TRAILER.url} target="_blank" rel="noopener noreferrer" onclick={play}>
          <img src={poster} alt="" width="1280" height="720" loading="lazy" decoding="async" />
          <span class="play"><PlayIcon fill="currentColor" /></span>
          <span class="visually-hidden">Play the Swift TODO trailer (30 seconds)</span>
        </a>
      {/if}
    </div>

    <p class="note">Nothing loads from YouTube until you press play.</p>
  </div>
</section>

<style>
  .trailer {
    text-align: center;
  }

  .lead {
    margin: 16px auto 0;
  }

  .frame {
    position: relative;
    max-width: 960px;
    margin: 40px auto 0;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    background: var(--sheet);
    border-radius: 22px;
  }

  iframe,
  .poster,
  .poster img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .poster img {
    object-fit: cover;
    transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1);
  }

  .poster:hover img {
    transform: scale(1.02);
  }

  .poster:focus-visible {
    outline-offset: -6px;
  }

  .play {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: clamp(72px, 11vw, 104px);
    aspect-ratio: 1;
    color: #242c88;
    background: var(--pencil);
    border: 4px solid #242c88;
    border-radius: 50%;
    box-shadow: 0 7px 0 #242c88;
    transform: translate(-50%, -50%);
    transition: transform 0.15s;
  }

  /* A ring that keeps rippling out from the button. */
  .play::after {
    position: absolute;
    inset: -4px;
    content: "";
    border: 4px solid var(--pencil);
    border-radius: 50%;
    animation: ripple 2.2s 1s ease-out 2;
  }

  @keyframes ripple {
    from {
      opacity: 0.9;
      transform: scale(1);
    }

    to {
      opacity: 0;
      transform: scale(1.6);
    }
  }

  .play :global(svg) {
    width: 42%;
    height: 42%;
    margin-left: 8%;
  }

  .poster:hover .play {
    transform: translate(-50%, -50%) scale(1.08) rotate(-4deg);
  }

  .note {
    margin-top: 22px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }
</style>
