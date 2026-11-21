<script lang="ts">
  type Props = { class?: string };

  const { class: className = "" }: Props = $props();
</script>

<!-- The icon's pencil, drawn long: pink eraser, metal band, yellow body, wood and lead. -->
<svg class={className} viewBox="0 0 640 84" fill="none" aria-hidden="true">
  <rect x="3" y="10" width="62" height="64" rx="20" fill="var(--eraser)" stroke="var(--line)" stroke-width="5" />
  <rect x="52" y="8" width="56" height="68" fill="var(--ferrule)" stroke="var(--line)" stroke-width="5" />
  <path d="M70 10v64M90 10v64" stroke="var(--line)" stroke-opacity="0.3" stroke-width="4" />
  <path d="M108 8h390v68H108z" fill="var(--pencil)" stroke="var(--line)" stroke-width="5" stroke-linejoin="round" />
  <path d="M108 32h390M108 52h390" stroke="#000" stroke-opacity="0.1" stroke-width="6" />
  <path d="M498 8l132 34-132 34z" fill="var(--wood)" stroke="var(--line)" stroke-width="5" stroke-linejoin="round" />
  <path d="M584 30l46 12-46 12z" fill="var(--line)" />
</svg>
