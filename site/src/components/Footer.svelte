<script lang="ts">
  import { AUTHOR, CHANGELOG, ISSUES, LICENSE, PRIVACY, REPO, TIP, VERSION } from "../links";
  import Logo from "./Logo.svelte";
</script>

<footer class="footer">
  <div class="page inner">
    <div class="about">
      <p class="brand">
        <Logo size={30} />
        <span class="hand">Swift TODO</span>
        <span class="version">v{VERSION}</span>
      </p>
      <p class="credit">Made by <a href={AUTHOR} target="_blank" rel="noopener noreferrer">Oussama Essamadi</a>, under the <a href={LICENSE} target="_blank" rel="noopener noreferrer">MIT license</a>. Enjoying it? <a href={TIP} target="_blank" rel="noopener noreferrer">Leave a tip</a>.</p>
    </div>

    <!-- Two rows, matching the two on the left. -->
    <ul class="links" role="list">
      <li><a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a></li>
      <li><a href={CHANGELOG} target="_blank" rel="noopener noreferrer">What's new</a></li>
      <li><a href={PRIVACY}>Privacy policy</a></li>
      <li><a href={ISSUES} target="_blank" rel="noopener noreferrer">Report a problem</a></li>
    </ul>
  </div>
</footer>

<style>
  .footer {
    padding-block: 36px 44px;
    border-top: 2px dashed color-mix(in srgb, var(--line) 30%, transparent);
  }

  .inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 24px 48px;
    align-items: center;
  }

  .about {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .brand {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .brand .hand {
    font-size: 26px;
  }

  .version {
    font-size: 14px;
    font-weight: 800;
    color: var(--muted);
  }

  .links {
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 10px 32px;
    font-weight: 800;
  }

  @media (max-width: 640px) {
    .inner {
      grid-template-columns: minmax(0, 1fr);
    }

    .links {
      justify-content: start;
    }
  }

  .credit {
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }
</style>
