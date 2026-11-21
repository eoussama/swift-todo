<script lang="ts">
  import type { TStorageStatus } from "@/lib/todos/repository";

  import CloudCheckIcon from "@lucide/svelte/icons/cloud-check";
  import CloudUploadIcon from "@lucide/svelte/icons/cloud-upload";
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
  import KeyboardIcon from "@lucide/svelte/icons/keyboard";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import * as Tooltip from "@/lib/components/ui/tooltip";
  import { CAPACITY_WARNING_RATIO } from "@/lib/todos/limits";



  type Props = {
    status: TStorageStatus;
    completed: number;
    onclear: () => void;
  };

  const { status, completed, onclear }: Props = $props();

  const local = $derived(status.mode === "local");
  const percent = $derived(Math.round(status.usage.ratio * 100));
  const showMeter = $derived(!local && status.usage.ratio >= CAPACITY_WARNING_RATIO);

  const shortcuts = [
    i18n.t("shortcuts.add"),
    i18n.t("shortcuts.focusInput"),
    i18n.t("shortcuts.navigate"),
    i18n.t("shortcuts.toggle"),
    i18n.t("shortcuts.edit"),
    i18n.t("shortcuts.delete"),
    i18n.t("shortcuts.reorder"),
    i18n.t("shortcuts.sync"),
    i18n.t("shortcuts.undo"),
  ];
</script>

<footer class="flex flex-col gap-2 border-t-2 border-hairline px-4 py-2.5 text-xs font-semibold text-muted-foreground">
  {#if showMeter}
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <div {...props} class="flex items-center gap-2" tabindex="-1">
            <div
              class="h-2 flex-1 overflow-hidden rounded-full border-2 border-border bg-card"
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
            <span class="whitespace-nowrap">{i18n.t("footer.usage", [String(percent)])}</span>
          </div>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="top" class="max-w-64">{i18n.t("footer.usageHint")}</Tooltip.Content>
    </Tooltip.Root>
  {/if}

  <div class="flex items-center gap-2">
    <Tooltip.Root disabled={!local}>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <p {...props} class="flex min-w-0 items-center gap-1.5" aria-live="polite">
            {#if local}
              <HardDriveIcon class="size-4 shrink-0" />
              <span>{i18n.t("footer.local")}</span>
            {:else if status.pending > 0}
              <CloudUploadIcon class="size-4 shrink-0 animate-pulse" />
              <span>{i18n.t("footer.saving")}</span>
            {:else}
              <CloudCheckIcon class="size-4 shrink-0 text-mint" />
              <span>{i18n.t("footer.synced")}</span>
            {/if}
            {#if !local && status.deviceOnly > 0}
              <span class="truncate">· {i18n.t("footer.deviceOnly", status.deviceOnly)}</span>
            {/if}
          </p>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="top" class="max-w-64">{i18n.t("footer.localHint")}</Tooltip.Content>
    </Tooltip.Root>

    <div class="ml-auto flex items-center gap-1">
      {#if completed > 0}
        <Button variant="ghost" size="sm" onclick={onclear}>
          {i18n.t("footer.clearCompleted", completed)}
        </Button>
      {/if}

      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" size="icon-sm" aria-label={i18n.t("footer.shortcuts")}>
              <KeyboardIcon />
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="top" align="end" class="block max-w-none">
          <p class="mb-1 font-extrabold">{i18n.t("footer.shortcuts")}</p>
          <ul class="space-y-0.5 font-medium">
            {#each shortcuts as shortcut (shortcut)}
              <li>{shortcut}</li>
            {/each}
          </ul>
        </Tooltip.Content>
      </Tooltip.Root>
    </div>
  </div>
</footer>
