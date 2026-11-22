<script lang="ts">
  import Backdrop from "./components/Backdrop.svelte";
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
<div class="shell">
  <Backdrop />
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
</div>

<style>
  /* Tilted screenshots may poke past the edges; they never make the page scroll sideways. */
  /* The doodles cover the whole page, behind everything else. */
  .shell {
    position: relative;
  }

  main {
    position: relative;
    z-index: 1;
    overflow-x: clip;
  }

  .shell > :global(footer) {
    position: relative;
    z-index: 1;
  }
</style>
