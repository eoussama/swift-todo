<script lang="ts">
  import type { TResolvedTheme } from "@/lib/appearance";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import { Dialog } from "bits-ui";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";

  import AppearanceSettings from "./AppearanceSettings.svelte";
  import DataSettings from "./DataSettings.svelte";
  import FocusSettings from "./FocusSettings.svelte";
  import ListsSettings from "./ListsSettings.svelte";
  import RemindersSettings from "./RemindersSettings.svelte";
  import SettingsSection from "./SettingsSection.svelte";



  type Props = {
    open: boolean;
    store: TodoStore;
    /** The theme shown, for the skin thumbnails. */
    theme: TResolvedTheme;
  };

  let { open = $bindable(false), store, theme }: Props = $props();

  const version = browser.runtime.getManifest().version;
  // Links that open a tab say so, with an icon and in words for screen readers.
  const newTabLabel = i18n.t("link.newTab");
  // A light tint of the accent behind a link on hover, as on a tag.
  const linkClass = "-mx-0.5 rounded-sm px-0.5 font-bold underline underline-offset-2 outline-none transition-colors hover:bg-(--tag) hover:no-underline focus-visible:focus-ring";
</script>

{#snippet newTab()}
  <ExternalLinkIcon class="ml-0.5 inline size-3 align-[-1px]" aria-hidden="true" /><span class="sr-only"> ({newTabLabel})</span>
{/snippet}

<!-- Settings slide in over the whole popup; Escape or the back arrow closes them. -->
<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Content
      class="desk fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-6 duration-200"
    >
      <header class="flex shrink-0 items-center gap-2 px-3 pt-3.5 pb-2">
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" size="icon-sm" tooltip={i18n.t("settings.close")} tooltipSide="bottom">
              <ArrowLeftIcon />
            </Button>
          {/snippet}
        </Dialog.Close>
        <Dialog.Title class="font-hand text-[29px] leading-[0.9] font-bold">{i18n.t("settings.title")}</Dialog.Title>
      </header>

      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-1 pb-4">
        <SettingsSection id="appearance" title={i18n.t("settings.appearance.title")}>
          <AppearanceSettings {store} {theme} />
        </SettingsSection>

        <SettingsSection id="lists" title={i18n.t("settings.lists.title")}>
          <ListsSettings {store} />
        </SettingsSection>

        <SettingsSection id="reminders" title={i18n.t("settings.reminders.title")}>
          <RemindersSettings {store} />
        </SettingsSection>

        <SettingsSection id="focus" title={i18n.t("settings.focus.title")}>
          <FocusSettings {store} />
        </SettingsSection>

        <SettingsSection id="data" title={i18n.t("settings.data.title")}>
          <DataSettings {store} />
        </SettingsSection>

        <SettingsSection id="about" title={i18n.t("settings.about.title")}>
          <p class="text-[13px] font-semibold">{i18n.t("settings.about.version", [version])}</p>
          <p class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
            <a class={linkClass} href="https://github.com/eoussama/swift-todo/releases/tag/v{version}" target="_blank" rel="noopener noreferrer">{i18n.t("settings.about.releaseNotes")}{@render newTab()}</a>
            <a class={linkClass} href="https://github.com/eoussama/swift-todo" target="_blank" rel="noopener noreferrer">{i18n.t("settings.about.source")}{@render newTab()}</a>
            <a class={linkClass} href="https://to.ouss.es/tip" target="_blank" rel="noopener noreferrer">{i18n.t("settings.about.tip")}{@render newTab()}</a>
          </p>
        </SettingsSection>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
