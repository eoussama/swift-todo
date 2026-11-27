<script lang="ts">
  import type { TPeekKey } from "@/lib/prefs/prefs";
  import type { TStorageStatus } from "@/lib/todos/repository";

  import CloudCheckIcon from "@lucide/svelte/icons/cloud-check";
  import CloudUploadIcon from "@lucide/svelte/icons/cloud-upload";
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
  import KeyboardIcon from "@lucide/svelte/icons/keyboard";
  import { browser } from "wxt/browser";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as Dialog from "@/lib/components/ui/dialog";
  import { Keys } from "@/lib/components/ui/keys";
  import * as Tooltip from "@/lib/components/ui/tooltip";
  import { CAPACITY_WARNING_RATIO } from "@/lib/todos/limits";



  type Props = {
    status: TStorageStatus;
    /** The key held to see the whole of a to-do, listed with the shortcuts unless off. */
    peek: TPeekKey;
    /** Whether the shortcuts dialog is open; Ctrl+? opens it too. */
    shortcutsOpen?: boolean;
  };

  let { status, peek, shortcutsOpen = $bindable(false) }: Props = $props();

  const local = $derived(status.mode === "local");
  const percent = $derived(Math.round(status.usage.ratio * 100));
  const showMeter = $derived(!local && status.usage.ratio >= CAPACITY_WARNING_RATIO);


  // From the built manifest, so it always matches what is installed.
  const version = browser.runtime.getManifest().version;

  // A shortcut's keys, as key caps, or a gesture with the mouse, in words.
  type TShortcut = { action: string; keys: string; mouse?: boolean };

  const key = (name: string): TShortcut => ({ action: i18n.t(`shortcuts.${name}.action` as Parameters<typeof i18n.t>[0]), keys: i18n.t(`shortcuts.${name}.keys` as Parameters<typeof i18n.t>[0]) });
  const mouse = (name: string, how?: string): TShortcut => ({ action: i18n.t(`shortcuts.mouse.${name}.action` as Parameters<typeof i18n.t>[0]), keys: how ?? i18n.t(`shortcuts.mouse.${name}.how` as Parameters<typeof i18n.t>[0]), mouse: true });

  // Grouped by what they're for; the mouse's own ways, easy to miss, are written down too.
  const sections = $derived([
    { title: i18n.t("shortcuts.groups.writing"), items: [key("add"), key("newLine"), key("focusInput"), key("undo")] },
    { title: i18n.t("shortcuts.groups.moving"), items: [key("navigate"), key("reorder"), key("settings"), key("help")] },
    { title: i18n.t("shortcuts.groups.todo"), items: [key("toggle"), key("edit"), key("editFull"), key("copy"), key("paste"), key("menu"), key("view"), key("pin"), key("sync"), key("delete")] },
    {
      title: i18n.t("shortcuts.groups.mouse"),
      items: [
        mouse("edit"),
        mouse("peek", peek === "off" ? i18n.t("shortcuts.mouse.peek.how") : i18n.t("shortcuts.mouse.peek.hold", [i18n.t(`settings.appearance.peekKeys.${peek}`)])),
        mouse("chips"),
        mouse("tabMenu"),
        mouse("drag"),
        mouse("files"),
      ],
    },
  ]);
</script>

<!-- On the desk, under the notepad. -->
<footer class="flex shrink-0 items-center gap-2 px-4 pt-3.5 pb-2.5 text-xs font-bold text-foreground">
  <Tooltip.Root disabled={!local}>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <!-- The sync status, as a dashed stamp; focusable when it has a hint, so the keyboard reaches it too.
             Not announced as it changes: "Saving…" then "Synced" after every edit would talk over the list.
             Problems with sync show their own notice. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <p
          {...props}
          class="flex min-w-0 items-center gap-1.5 rounded-md border-2 border-dashed border-border/60 bg-sheet/60 px-2 py-0.5 outline-none focus-visible:focus-ring"
          tabindex={local ? 0 : undefined}
        >
          {#if local}
            <HardDriveIcon class="size-3.5 shrink-0" />
            <span>{i18n.t("footer.local")}</span>
          {:else if status.pending > 0}
            <CloudUploadIcon class="size-3.5 shrink-0 animate-pulse" />
            <span>{i18n.t("footer.saving")}</span>
          {:else}
            <CloudCheckIcon class="size-3.5 shrink-0" />
            <span>{i18n.t("footer.synced")}</span>
          {/if}
          {#if !local && status.deviceOnly > 0}
            <span class="truncate font-semibold">· {i18n.t("footer.deviceOnly", status.deviceOnly)}</span>
          {/if}
        </p>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top" class="max-w-64">{i18n.t("footer.localHint")}</Tooltip.Content>
  </Tooltip.Root>

  {#if showMeter}
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <!-- Focusable, so the keyboard can bring up what the meter means. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div {...props} class="flex min-w-0 flex-1 items-center gap-1.5 rounded-md outline-none focus-visible:focus-ring" tabindex="0">
            <div
              class="h-2.5 min-w-8 flex-1 overflow-hidden rounded-full border-2 border-border bg-sheet"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={i18n.t("footer.usage", [String(percent)])}
            >
              <div
                class={["h-full transition-[width]", status.usage.ratio >= 0.95 ? "bg-coral" : "bg-pencil-deep"]}
                style:width="{percent}%"
              ></div>
            </div>
            <span class="whitespace-nowrap">{percent}%</span>
          </div>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="top" class="max-w-64">
        <p class="font-extrabold">{i18n.t("footer.usage", [String(percent)])}</p>
        <p>{i18n.t("footer.usageHint")}</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}

  <!-- The version, linking to its release notes. -->
  <a
    href="https://github.com/eoussama/swift-todo/releases/tag/v{version}"
    target="_blank"
    rel="noopener noreferrer"
    class="ml-auto shrink-0 rounded-md px-1 font-hand text-[17px] leading-none font-bold text-foreground underline-offset-2 outline-none transition-colors hover:bg-(--tag) hover:underline focus-visible:focus-ring"
    aria-label={`${i18n.t("footer.version", [version])} (${i18n.t("link.newTab")})`}
  >v{version}</a>

  <!-- The shortcuts, in a dialog of their own, on click. -->
  <Button
    variant="ghost"
    size="icon-sm"
    class="shrink-0"
    tooltip={i18n.t("footer.shortcuts")}
    shortcut="Ctrl+?"
    onclick={() => (shortcutsOpen = true)}
  >
    <KeyboardIcon />
  </Button>
</footer>

<Dialog.Root bind:open={shortcutsOpen}>
  <Dialog.Content class="flex max-h-[calc(100%-24px)] w-[356px] flex-col gap-2 bg-sheet p-4">
    <Dialog.Header class="gap-0 text-left">
      <Dialog.Title class="font-hand text-[26px] leading-none font-bold">{i18n.t("footer.shortcuts")}</Dialog.Title>
      <Dialog.Description class="sr-only">{i18n.t("footer.shortcutsHint")}</Dialog.Description>
    </Dialog.Header>
    <!-- In groups; action on the left, keys (or what to do with the mouse) on the right. -->
    <div class="-mx-1 min-h-0 overflow-y-auto px-1 text-[12.5px]">
      {#each sections as section (section.title)}
        <h3 class="mt-2 mb-0.5 text-[10.5px] font-extrabold tracking-wide text-muted-foreground uppercase first:mt-0">{section.title}</h3>
        <dl class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 leading-[18px] font-semibold">
          {#each section.items as shortcut (shortcut.action)}
            <dt>{shortcut.action}</dt>
            {#if shortcut.mouse}
              <dd class="text-right text-muted-foreground">{shortcut.keys}</dd>
            {:else}
              <dd class="flex justify-end" aria-label={shortcut.keys}><Keys keys={shortcut.keys} /></dd>
            {/if}
          {/each}
        </dl>
      {/each}
    </div>
  </Dialog.Content>
</Dialog.Root>
