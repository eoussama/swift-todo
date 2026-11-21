<script lang="ts">
  import type { TResolvedTheme } from "@/lib/appearance";
  import type { TAccent, TSkin, TTheme } from "@/lib/prefs/prefs";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import { i18n } from "#i18n";

  import { ACCENT_SWATCHES } from "@/lib/accents";
  import { ACCENTS, SKINS, THEMES } from "@/lib/prefs/prefs";



  type Props = {
    store: TodoStore;
    /** The theme shown, so the thumbnails match it. */
    theme: TResolvedTheme;
  };

  const { store, theme }: Props = $props();

  const SKIN_NAMES: Record<TSkin, string> = {
    notepad: i18n.t("settings.appearance.skins.notepad"),
    sticky: i18n.t("settings.appearance.skins.sticky"),
    chalk: i18n.t("settings.appearance.skins.chalk"),
    scroll: i18n.t("settings.appearance.skins.scroll"),
    minimal: i18n.t("settings.appearance.skins.minimal"),
    aurora: i18n.t("settings.appearance.skins.aurora"),
  };

  const ACCENT_NAMES: Record<TAccent, string> = {
    mint: i18n.t("settings.appearance.accents.mint"),
    sky: i18n.t("settings.appearance.accents.sky"),
    coral: i18n.t("settings.appearance.accents.coral"),
    violet: i18n.t("settings.appearance.accents.violet"),
    amber: i18n.t("settings.appearance.accents.amber"),
    rose: i18n.t("settings.appearance.accents.rose"),
    teal: i18n.t("settings.appearance.accents.teal"),
    ink: i18n.t("settings.appearance.accents.ink"),
  };

  const THEME_NAMES: Record<TTheme, string> = {
    system: i18n.t("settings.appearance.themes.system"),
    light: i18n.t("settings.appearance.themes.light"),
    dark: i18n.t("settings.appearance.themes.dark"),
  };

  // The chalkboard is dark even in light mode, so it takes the dark-surface fills.
  const tone = $derived(theme === "dark" || store.prefs.skin === "chalk" ? "dark" : "light");
  const legend = "mb-1.5 text-[13px] font-bold";
</script>

<div class="flex flex-col gap-3">
  <fieldset>
    <legend class={legend}>{i18n.t("settings.appearance.skin")}</legend>
    <div class="grid grid-cols-3 gap-2">
      {#each SKINS as skin (skin)}
        <label class="group flex cursor-pointer flex-col items-center gap-1 text-xs font-bold">
          <input class="peer sr-only" type="radio" name="pref-skin" value={skin} checked={store.prefs.skin === skin} onchange={() => void store.savePrefs({ skin })} />
          <!-- A live thumbnail: the skin's own tokens apply inside it. -->
          <span
            data-skin={skin}
            data-theme={theme}
            class="desk relative flex h-14 w-full items-center justify-center overflow-hidden rounded-md border-2 border-border/70 peer-checked:border-border peer-checked:shadow-[0_0_0_2px_var(--ring)] peer-focus-visible:focus-ring"
            aria-hidden="true"
          >
            <span class="flex h-10 w-[76%] flex-col gap-1 rounded-sm border-2 border-border bg-sheet px-1.5 py-1 text-foreground" style:background-image="var(--sheet-image)">
              <span class="font-hand text-[15px] leading-none font-bold">Aa</span>
              <span class="flex items-center gap-1">
                <span class="size-2 rounded-[2px] border border-border bg-primary"></span>
                <span class="h-0.5 flex-1 rounded-full bg-foreground/50"></span>
              </span>
            </span>
          </span>
          {SKIN_NAMES[skin]}
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend class={legend}>{i18n.t("settings.appearance.accent")}</legend>
    <div class="flex flex-wrap gap-1.5">
      {#each ACCENTS as accent (accent)}
        <label class="relative cursor-pointer" title={ACCENT_NAMES[accent]}>
          <input class="peer sr-only" type="radio" name="pref-accent" value={accent} checked={store.prefs.accent === accent} onchange={() => void store.savePrefs({ accent })} aria-label={ACCENT_NAMES[accent]} />
          <span
            class="block size-7 rounded-full border-2 border-border peer-checked:shadow-[0_0_0_3px_var(--sheet),0_0_0_5px_var(--border)] peer-focus-visible:focus-ring"
            style:background={ACCENT_SWATCHES[accent][tone].fill}
            aria-hidden="true"
          ></span>
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend class={legend}>{i18n.t("settings.appearance.theme")}</legend>
    <div class="flex gap-1.5">
      {#each THEMES as option (option)}
        <label class="cursor-pointer">
          <input class="peer sr-only" type="radio" name="pref-theme" value={option} checked={store.prefs.theme === option} onchange={() => void store.savePrefs({ theme: option })} />
          <span class="flex h-7 items-center rounded-full border-2 border-border/70 px-3 text-xs font-extrabold peer-checked:border-border peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:focus-ring">
            {THEME_NAMES[option]}
          </span>
        </label>
      {/each}
    </div>
  </fieldset>
</div>
