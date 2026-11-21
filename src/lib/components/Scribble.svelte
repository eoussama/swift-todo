<script lang="ts">
  type Props = { class?: string };

  const { class: className = "" }: Props = $props();
</script>

<!--
  Hidden text, scribbled over in the skin's own hand (see `.scribble` in decor.css):
  pencil, marker, chalk or ink, or a plain bar. Always the same width, so it doesn't
  give the text's length away.
-->
<svg class={["scribble", className]} viewBox="0 0 120 24" aria-hidden="true" focusable="false">
  <path class="scribble-line" d="M4 15C9 4 13 22 19 10S29 4 33 16 43 22 47 9 57 3 61 15 71 21 75 8 85 4 89 16 99 21 103 9 112 6 116 13" />
  <path class="scribble-line" d="M7 8C29 18 51 5 73 14S103 7 115 17" />
  <rect class="scribble-bar" x="2" y="5" width="116" height="14" rx="3" />
</svg>
