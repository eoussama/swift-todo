<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";

  import policy from "../../PRIVACY.md?raw";
  import Footer from "./components/Footer.svelte";
  import Nav from "./components/Nav.svelte";
  import { renderMarkdown } from "./markdown";


  // PRIVACY.md is the one source; this page shows it as it is in the repository.
  const html = renderMarkdown(policy);
</script>

<a class="skip" href="#main">Skip to content</a>
<Nav home="/" />
<main id="main" class="page">
  <a class="back" href="/"><ArrowLeftIcon aria-hidden="true" /> Back to Swift TODO</a>
  <article class="sheet sticker">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- PRIVACY.md from this repository, escaped by renderMarkdown. -->
    {@html html}
  </article>
</main>
<Footer />

<style>
  main {
    max-width: 860px;
    padding-block: 40px 96px;
  }

  .back {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 24px;
    font-weight: 800;
    text-decoration: none;
  }

  .back :global(svg) {
    width: 20px;
    height: 20px;
  }

  .sheet {
    padding: clamp(28px, 6vw, 64px) clamp(20px, 6vw, 64px);
    font-size: 17px;
    font-weight: 600;
    line-height: 1.7;
    background: var(--sheet);
    border-radius: 22px;
  }

  .sheet :global(h1) {
    font-family: var(--font-brush);
    font-size: clamp(44px, 7vw, 68px);
    font-weight: 400;
    line-height: 1;
  }

  .sheet :global(h2) {
    margin-top: 40px;
    font-family: var(--font-hand);
    font-size: 34px;
    line-height: 1.1;
  }

  .sheet :global(p),
  .sheet :global(ul) {
    margin-top: 14px;
  }

  .sheet :global(ul) {
    padding-left: 22px;
  }

  .sheet :global(li + li) {
    margin-top: 8px;
  }

  .sheet :global(em) {
    color: var(--muted);
  }

  .sheet :global(code) {
    padding: 1px 6px;
    font-size: 0.9em;
    background: var(--tag);
    border-radius: 6px;
  }

  .sheet :global(a) {
    font-weight: 800;
  }
</style>
