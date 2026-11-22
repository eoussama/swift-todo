<script lang="ts">
  import focus from "../../../showcase/focus.png?webp";
  import today from "../../../showcase/today.png?webp";
</script>

<section class="section focus" aria-labelledby="focus-title">
  <div class="page grid">
    <div class="art" data-reveal="group">
      <img class="shot left" src={today} alt="The Today tab: to-dos due today, overdue, or added to Today." width="380" height="560" loading="lazy" decoding="async" />
      <img class="shot right" src={focus} alt="Focus mode: one to-do in large handwriting, with Done, Skip and a 25-minute timer." width="380" height="560" loading="lazy" decoding="async" />
    </div>

    <div class="copy" data-reveal="right">
      <h2 id="focus-title" class="title">Today, then <span class="marker">focus</span></h2>
      <p class="lead">
        The Today tab gathers what's due and overdue, plus anything you add to it. When it's time to get going, the ◎ button
        shows one to-do at a time, big, with Done and Skip.
      </p>
      <p class="lead">
        Start a timer and close the popup: the toolbar badge counts down the minutes, and a notification says when it's over.
      </p>
    </div>
  </div>
</section>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: clamp(32px, 6vw, 88px);
    align-items: center;
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .art {
    position: relative;
    aspect-ratio: 1.15 / 1;
    width: 100%;
    max-width: 540px;
    margin-inline: auto;
  }

  .shot {
    position: absolute;
    top: 0;
    width: 56%;
    border: 3px solid var(--line);
    border-radius: 18px;
    box-shadow: 0 9px 0 var(--shadow);
  }

  .left {
    left: 0;
    transform: rotate(-5deg);
  }

  .right {
    right: 0;
    top: 6%;
    transform: rotate(4deg);
  }

  /* Dealt like two cards: from one stack, out to their places. */
  :global(.js) .art:global([data-shown]) .left {
    animation: deal-left 0.9s cubic-bezier(0.2, 0.8, 0.3, 1.1) backwards;
  }

  :global(.js) .art:global([data-shown]) .right {
    animation: deal-right 0.9s 0.12s cubic-bezier(0.2, 0.8, 0.3, 1.1) backwards;
  }

  @keyframes deal-left {
    from {
      opacity: 0;
      transform: translate(40%, 30px) rotate(4deg);
    }
  }

  @keyframes deal-right {
    from {
      opacity: 0;
      transform: translate(-40%, 50px) rotate(-6deg);
    }
  }

  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .art {
      order: 2;
      max-width: 440px;
    }
  }
</style>
