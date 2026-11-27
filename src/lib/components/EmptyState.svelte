<script lang="ts">
  import { i18n } from "#i18n";

  import icon from "@/assets/icon.svg";
</script>

<!-- A blank ruled page, with a note written in the middle; the lines run on behind it. -->
<div class="ruled flex flex-1 flex-col items-center justify-center px-10 py-8 text-center">
  <div class="flex flex-col items-center gap-1 px-4 py-3">
    <img src={icon} alt="" class="mb-1.5 size-[72px] rotate-6 drop-shadow-[0_3px_0_var(--sticker)]" />
    <h2 class="font-hand text-[28px] leading-none font-bold">{i18n.t("empty.title")}</h2>
    <p class="text-[13px] font-semibold text-balance text-muted-foreground">{i18n.t("empty.body")}</p>
  </div>
</div>
