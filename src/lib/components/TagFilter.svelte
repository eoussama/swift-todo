<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";



  type Props = {
    tag: string;
    onclear: () => void;
  };

  const { tag, onclear }: Props = $props();
</script>

<!-- Shown under the input while a tag filter is on. -->
<div class="margin-line flex min-h-9 shrink-0 items-center border-b border-rule bg-(--row-hover) pr-2 pl-[52px]" role="status">
  <span class="text-[13px] font-extrabold">{i18n.t("tags.showing", [tag])}</span>
  <Button variant="ghost" size="icon-xs" class="ml-auto" aria-label={i18n.t("tags.clear")} onclick={onclear}>
    <XIcon strokeWidth={3} />
  </Button>
</div>
