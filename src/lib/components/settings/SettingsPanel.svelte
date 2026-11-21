<script lang="ts">
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { Dialog } from "bits-ui";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";

  import DataSettings from "./DataSettings.svelte";
  import ListsSettings from "./ListsSettings.svelte";
  import RemindersSettings from "./RemindersSettings.svelte";
  import SettingsSection from "./SettingsSection.svelte";



  type Props = {
    open: boolean;
    store: TodoStore;
  };

  let { open = $bindable(false), store }: Props = $props();

  const version = browser.runtime.getManifest().version;
  const linkClass = "rounded-sm font-bold underline underline-offset-2 outline-none hover:no-underline focus-visible:focus-ring";
</script>

<!-- Settings slide in over the whole popup; Escape or the back arrow closes them. -->
<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Content
      class="desk fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-6 duration-200"
    >
      <header class="flex shrink-0 items-center gap-2 px-3 pt-3.5 pb-2">
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" size="icon-sm" aria-label={i18n.t("settings.close")}>
              <ArrowLeftIcon />
            </Button>
          {/snippet}
        </Dialog.Close>
        <Dialog.Title class="font-hand text-[29px] leading-[0.9] font-bold">{i18n.t("settings.title")}</Dialog.Title>
      </header>

      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-1 pb-4">
        <SettingsSection id="lists" title={i18n.t("settings.lists.title")}>
          <ListsSettings {store} />
        </SettingsSection>

        <SettingsSection id="reminders" title={i18n.t("settings.reminders.title")}>
          <RemindersSettings {store} />
        </SettingsSection>

        <SettingsSection id="data" title={i18n.t("settings.data.title")}>
          <DataSettings {store} />
        </SettingsSection>

        <SettingsSection id="about" title={i18n.t("settings.about.title")}>
          <p class="text-[13px] font-semibold">{i18n.t("settings.about.version", [version])}</p>
          <p class="mt-1 flex gap-3 text-[13px]">
            <a class={linkClass} href="https://github.com/eoussama/swift-todo/releases/tag/v{version}" target="_blank" rel="noopener noreferrer">{i18n.t("settings.about.releaseNotes")}</a>
            <a class={linkClass} href="https://github.com/eoussama/swift-todo" target="_blank" rel="noopener noreferrer">{i18n.t("settings.about.source")}</a>
          </p>
        </SettingsSection>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
