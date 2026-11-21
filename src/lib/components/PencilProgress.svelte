<script lang="ts">
  import { i18n } from "#i18n";



  type Props = {
    done: number;
    total: number;
    /** Changes whenever the pencil should cheer. */
    wiggle: number;
  };

  const { done, total, wiggle }: Props = $props();

  const ratio = $derived(total === 0 ? 0 : done / total);
  const TIP = 16;
</script>

<!--
  The icon's pencil as a progress bar: eraser, metal band, and a yellow body
  that grows along a dashed line as to-dos get done.
-->
<div
  class="flex h-[18px] w-full items-center"
  role="progressbar"
  aria-label={i18n.t("header.progressLabel")}
  aria-valuemin={0}
  aria-valuemax={total}
  aria-valuenow={done}
  aria-valuetext={i18n.t("header.progress", [String(done), String(total)])}
>
  {#key wiggle}
    <div class={["flex h-full w-full origin-center items-center", wiggle > 0 && "animate-cheer"]}>
      <span class="h-full w-3 shrink-0 rounded-l-[6px] border-2 border-r-0 border-border bg-eraser"></span>
      <span class="h-full w-2 shrink-0 border-2 border-border bg-ferrule [background-image:linear-gradient(to_right,transparent_45%,rgb(36_44_136/0.25)_45%_55%,transparent_55%)]"></span>

      <span class="relative h-full min-w-0 flex-1">
        <!-- The line still to write. -->
        <span class="absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dashed border-border/30"></span>

        <span
          class="absolute inset-y-0 left-0 flex transition-[width] duration-500 ease-out"
          style:width="calc({TIP}px + (100% - {TIP}px) * {ratio})"
        >
          <span class="h-full min-w-0 flex-1 border-y-2 border-border bg-pencil [background-image:linear-gradient(to_bottom,transparent_38%,rgb(0_0_0/0.09)_38%_62%,transparent_62%)]"></span>
          <svg viewBox="0 0 16 18" class="-ml-px h-full w-4 shrink-0" aria-hidden="true">
            <path d="M1 1 L15 9 L1 17 Z" fill="var(--wood)" stroke="var(--border)" stroke-width="2" stroke-linejoin="round" />
            <path d="M9.6 5.8 L15 9 L9.6 12.2 Z" fill="var(--border)" />
          </svg>
        </span>
      </span>
    </div>
  {/key}
</div>
