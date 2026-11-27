<script lang="ts">
  import type { TPeekKey } from "@/lib/prefs/prefs";

  import LightbulbIcon from "@lucide/svelte/icons/lightbulb";
  import XIcon from "@lucide/svelte/icons/x";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { hints } from "@/lib/hints.svelte";



  type Props = {
    /** The key held to see a whole to-do, named in the tip about long ones. */
    peek: TPeekKey;
  };

  const { peek }: Props = $props();

  const text = $derived(
    hints.current === "long"
      ? (peek === "off" ? i18n.t("hints.longNoKey") : i18n.t("hints.long", [i18n.t(`settings.appearance.peekKeys.${peek}`)]))
      : i18n.t("hints.tabs"),
  );
</script>

<!-- A tip, once, at the foot of the page, when what it points out has just become useful. -->
{#if hints.current !== null}
  {@const hint = hints.current}
  <aside
    class="margin-line flex shrink-0 items-start gap-2 border-t-2 border-rule bg-note py-1.5 pr-1.5 pl-[52px] text-[12.5px] leading-snug font-semibold animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
    aria-label={i18n.t("hints.label")}
    data-hint={hint}
  >
    <LightbulbIcon class="mt-0.5 -ml-[34px] size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <p class="ml-2 flex-1 py-0.5">{text}</p>
    <Button variant="ghost" size="icon-xs" class="shrink-0" tooltip={i18n.t("hints.dismiss")} onclick={() => hints.done(hint)}>
      <XIcon />
    </Button>
  </aside>
{/if}
