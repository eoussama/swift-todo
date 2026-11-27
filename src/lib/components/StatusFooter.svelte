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
  import * as Tooltip from "@/lib/components/ui/tooltip";
  import { CAPACITY_WARNING_RATIO } from "@/lib/todos/limits";



  type Props = {
    status: TStorageStatus;
    /** The key held to see the whole of a to-do, listed with the shortcuts unless off. */
    peek: TPeekKey;
  };

  const { status, peek }: Props = $props();

  const local = $derived(status.mode === "local");
  const percent = $derived(Math.round(status.usage.ratio * 100));
  const showMeter = $derived(!local && status.usage.ratio >= CAPACITY_WARNING_RATIO);

  let shortcutsOpen = $state(false);

  // From the built manifest, so it always matches what is installed.
  const version = browser.runtime.getManifest().version;

  // Each shortcut's keys: alternatives split on " / ", keys pressed together on "+".
  function keyGroups(keys: string): Array<Array<string>> {
    return keys.split(" / ").map(group => group.split("+").map(key => key.trim()));
  }

  // A shortcut's keys, as key caps, or a gesture with the mouse, in words.
  type TShortcut = { action: string; keys: string; mouse?: boolean };

  const key = (name: string): TShortcut => ({ action: i18n.t(`shortcuts.${name}.action` as Parameters<typeof i18n.t>[0]), keys: i18n.t(`shortcuts.${name}.keys` as Parameters<typeof i18n.t>[0]) });
  const mouse = (name: string, how?: string): TShortcut => ({ action: i18n.t(`shortcuts.mouse.${name}.action` as Parameters<typeof i18n.t>[0]), keys: how ?? i18n.t(`shortcuts.mouse.${name}.how` as Parameters<typeof i18n.t>[0]), mouse: true });

  // Grouped by what they're for; the mouse's own ways, easy to miss, are written down too.
  const sections = $derived([
    { title: i18n.t("shortcuts.groups.writing"), items: [key("add"), key("newLine"), key("focusInput"), key("undo")] },
    { title: i18n.t("shortcuts.groups.moving"), items: [key("navigate"), key("reorder")] },
    { title: i18n.t("shortcuts.groups.todo"), items: [key("toggle"), key("edit"), key("menu"), key("view"), key("pin"), key("sync"), key("delete")] },
    {
      title: i18n.t("shortcuts.groups.mouse"),
      items: [
        mouse("edit"),
        mouse("peek", peek === "off" ? i18n.t("shortcuts.mouse.peek.how") : i18n.t("shortcuts.mouse.peek.hold", [i18n.t(`settings.appearance.peekKeys.${peek}`)])),
        mouse("chips"),
        mouse("tabMenu"),
        mouse("drag"),
      ],
    },
  ].map(section => ({ ...section, items: section.items.map(item => ({ ...item, groups: keyGroups(item.keys) })) })));
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

  <!-- Opens on hover, on focus, and on click (for touch, or when hovering isn't obvious). -->
  <Tooltip.Root bind:open={shortcutsOpen} disableCloseOnTriggerClick>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="ghost"
          size="icon-sm"
          class="shrink-0"
          aria-label={i18n.t("footer.shortcuts")}
          onclick={(event: MouseEvent) => {
            (props.onclick as ((event: MouseEvent) => void) | undefined)?.(event);
            shortcutsOpen = true;
          }}
        >
          <KeyboardIcon />
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top" align="end" class="block max-h-(--bits-tooltip-content-available-height) w-[356px] max-w-none overflow-y-auto">
      <p class="mb-1 font-extrabold">{i18n.t("footer.shortcuts")}</p>
      <!-- In groups; action on the left, keys (or what to do with the mouse) on the right. -->
      {#each sections as section (section.title)}
        <p class="mt-1.5 mb-0.5 text-[10.5px] font-extrabold tracking-wide uppercase opacity-70">{section.title}</p>
        <dl class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 leading-[18px] font-medium">
          {#each section.items as shortcut (shortcut.action)}
            <dt>{shortcut.action}</dt>
            {#if shortcut.mouse}
              <dd class="text-right opacity-90">{shortcut.keys}</dd>
            {:else}
              <dd class="flex items-center justify-end gap-1" aria-label={shortcut.keys}>
                {#each shortcut.groups as group, g (g)}
                  {#if g > 0}<span class="opacity-60" aria-hidden="true">/</span>{/if}
                  {#each group as name, k (k)}
                    {#if k > 0}<span class="opacity-60" aria-hidden="true">+</span>{/if}
                    <kbd class="min-w-5 rounded-[4px] border border-current/35 px-1 text-center font-sans text-[11px] leading-4 font-bold" aria-hidden="true">{name}</kbd>
                  {/each}
                {/each}
              </dd>
            {/if}
          {/each}
        </dl>
      {/each}
    </Tooltip.Content>
  </Tooltip.Root>
</footer>
