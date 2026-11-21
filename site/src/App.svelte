<script lang="ts">
  import Faq from "./components/Faq.svelte";
  import Features from "./components/Features.svelte";
  import Focus from "./components/Focus.svelte";
  import Footer from "./components/Footer.svelte";
  import Hero from "./components/Hero.svelte";
  import Install from "./components/Install.svelte";
  import Nav from "./components/Nav.svelte";
  import Privacy from "./components/Privacy.svelte";
  import Skins from "./components/Skins.svelte";
  import Trailer from "./components/Trailer.svelte";
  import TryIt from "./components/TryIt.svelte";
</script>

<a class="skip" href="#main">Skip to content</a>
<Nav />
<main id="main">
  <Hero />
  <Trailer />
  <TryIt />
  <Features />
  <Focus />
  <Skins />
  <Privacy />
  <Install />
  <Faq />
</main>
<Footer />

<style>
  /* Tilted screenshots may poke past the edges; they never make the page scroll sideways. */
  main {
    overflow-x: clip;
  }

  .skip {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 100;
    padding: 8px 14px;
    font-weight: 800;
    background: var(--sheet);
    border: 2px solid var(--line);
    border-radius: 10px;
    transform: translateY(-200%);
  }

  .skip:focus {
    transform: none;
  }
</style>
