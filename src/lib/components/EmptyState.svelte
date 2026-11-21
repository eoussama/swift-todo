<script lang="ts">
  import { i18n } from "#i18n";

  import icon from "@/assets/icon.svg";
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-10 text-center">
  <img src={icon} alt="" class="mb-2 size-24 rotate-3 opacity-90 drop-shadow-[0_3px_0_var(--sticker)]" />
  <h2 class="text-base font-extrabold">{i18n.t("empty.title")}</h2>
  <p class="text-sm font-medium text-balance text-muted-foreground">{i18n.t("empty.body")}</p>
</div>
