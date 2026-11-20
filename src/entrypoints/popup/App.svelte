<script lang="ts">
  import { i18n } from "#i18n";

  import icon from "~/assets/icon.svg";
</script>

<main class="flex w-95 flex-col items-center gap-3 p-8 text-center">
  <img src={icon} alt="" class="size-20" />
  <h1 class="text-2xl font-extrabold">{i18n.t("extName")}</h1>
  <p class="text-ink/70">{i18n.t("popup.tagline")}</p>
</main>
