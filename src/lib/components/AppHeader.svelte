<script lang="ts">
  import { i18n } from "#i18n";

  import icon from "@/assets/icon.svg";



  type Props = {
    remaining: number;
    total: number;
  };

  const { remaining, total }: Props = $props();

  const summary = $derived(total === 0 ? i18n.t("header.empty") : i18n.t("header.remaining", remaining));
  const allDone = $derived(total > 0 && remaining === 0);
</script>

<header class="flex items-center gap-3 px-4 pt-4 pb-3">
  <img src={icon} alt="" class="size-10 -rotate-6 drop-shadow-[0_2px_0_var(--sticker)]" />
  <h1 class="text-lg leading-none font-extrabold tracking-tight">{i18n.t("extName")}</h1>
  <p
    class={[
      "ml-auto rounded-full border-2 border-border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap transition-colors",
      allDone ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
    ]}
    aria-live="polite"
  >
    {summary}
  </p>
</header>
