<script lang="ts">
  import { AUTHOR, CHANGELOG, ISSUES, LICENSE, PRIVACY, REPO, VERSION } from "../links";
  import Logo from "./Logo.svelte";
</script>

<footer class="footer">
  <div class="page inner">
    <p class="brand">
      <Logo size={30} />
      <span class="hand">Swift TODO</span>
      <span class="version">v{VERSION}</span>
    </p>

    <ul class="links" role="list">
      <li><a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a></li>
      <li><a href={CHANGELOG} target="_blank" rel="noopener noreferrer">What's new</a></li>
      <li><a href={PRIVACY}>Privacy policy</a></li>
      <li><a href={ISSUES} target="_blank" rel="noopener noreferrer">Report a problem</a></li>
    </ul>

    <p class="credit">Made by <a href={AUTHOR} target="_blank" rel="noopener noreferrer">Oussama Essamadi</a>, under the <a href={LICENSE} target="_blank" rel="noopener noreferrer">MIT license</a>.</p>
  </div>
</footer>

<style>
  .footer {
    padding-block: 36px 44px;
    border-top: 2px dashed color-mix(in srgb, var(--line) 30%, transparent);
  }

  .inner {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 32px;
    align-items: center;
    justify-content: space-between;
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
    display: flex;
    flex-wrap: wrap;
    gap: 6px 22px;
    font-weight: 800;
  }

  .credit {
    width: 100%;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }
</style>
