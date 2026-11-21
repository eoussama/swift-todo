<script lang="ts">
  import { PRIVACY, REPO } from "../links";
</script>

<section class="section" aria-labelledby="privacy-title">
  <div class="page card sticker" data-reveal="pop">
    <p class="stamp hand" aria-hidden="true">No sign-up · No servers · No tracking</p>

    <h2 id="privacy-title" class="title">Your list stays <span class="marker">yours</span></h2>

    <div class="columns">
      <p>
        Your to-dos live in your browser's own storage and travel between your devices through your browser account, the
        same way your bookmarks do. They never pass through a server of ours. There isn't one.
      </p>
      <p>
        Browser sync holds a few hundred to-dos. Past that, there's still no limit: new ones stay on the device, and you
        choose which ones sync. Not signed in to your browser? Everything works, on this device.
      </p>
    </div>

    <p class="links">
      <a href={PRIVACY}>Read the privacy policy</a>
      <span aria-hidden="true">·</span>
      <a href={REPO} target="_blank" rel="noopener noreferrer">See every line of the code</a>
    </p>
  </div>
</section>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: clamp(40px, 6vw, 72px) clamp(22px, 6vw, 72px) clamp(32px, 5vw, 56px);
    background: var(--sheet) linear-gradient(transparent 31px, var(--rule) 31px, var(--rule) 32px) 0 18px / 100% 32px;
    border-radius: 22px;
  }

  .stamp {
    align-self: flex-start;
    padding: 6px 16px;
    font-size: clamp(22px, 3vw, 30px);
    color: color-mix(in srgb, var(--mint) 60%, var(--fg));
    border: 3px dashed currentColor;
    border-radius: 12px;
    transform: rotate(-2.5deg);
  }

  :global(.js) .card:not([data-shown]) .stamp {
    opacity: 0;
  }

  :global(.js) .card:global([data-shown]) .stamp {
    animation: stamp 0.55s 0.45s cubic-bezier(0.5, 0, 0.6, 1.6) backwards;
  }

  @keyframes stamp {
    from {
      opacity: 0;
      transform: scale(1.8) rotate(-12deg);
    }

    60% {
      opacity: 1;
    }
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 20px 48px;
    font-size: 18px;
    font-weight: 600;
    line-height: 32px;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    font-weight: 800;
  }
</style>
