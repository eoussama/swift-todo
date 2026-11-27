<script lang="ts">
  import type { TStatus } from "@/lib/todos/status";
  import type { TodoStore } from "@/lib/todos/todos.svelte";

  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { MAX_STAGE_NAME_LENGTH, MAX_STAGES_PER_STATUS, stagesUnder, STATUSES } from "@/lib/todos/status";

  import { STATUS_ICONS, statusLabel } from "../StatusItems.svelte";



  type Props = { store: TodoStore };

  const { store }: Props = $props();

  // A name being typed for each status's next stage.
  const names = $state<Record<TStatus, string>>({ todo: "", doing: "", done: "" });

  async function add(event: SubmitEvent, status: TStatus): Promise<void> {
    event.preventDefault();

    if ((await store.addStage(status, names[status])) !== undefined) {
      names[status] = "";
    }
  }

  function rename(id: string, input: HTMLInputElement, current: string): void {
    // A blank name puts the old one back.
    if (input.value.trim() === "") {
      input.value = current;
    }
    else if (input.value !== current) {
      void store.renameStage(id, input.value);
    }
  }

  const fieldClass = "h-8 min-w-0 flex-1 rounded-md border-2 border-border bg-sheet px-2 text-sm font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground focus-visible:focus-ring";
</script>

<p class="mb-2 text-[13px] font-semibold text-muted-foreground">{i18n.t("settings.stages.intro")}</p>

<div class="flex flex-col gap-3">
  {#each STATUSES as status (status)}
    {@const Icon = STATUS_ICONS[status]}
    {@const stages = stagesUnder(store.prefs.stages, status)}
    <section aria-labelledby="stages-{status}" data-stages={status}>
      <h4 id="stages-{status}" class="mb-1 flex items-center gap-1.5 text-[12.5px] font-extrabold text-muted-foreground uppercase">
        <Icon class="size-4" aria-hidden="true" />{statusLabel(status)}
      </h4>
      {#if stages.length > 0}
        <ul class="mb-1.5 flex flex-col gap-1 pl-3" aria-label={i18n.t("settings.stages.under", [statusLabel(status)])}>
          {#each stages as stage, index (stage.id)}
            <li class="flex items-center gap-1">
              <input
                class={fieldClass}
                value={stage.name}
                aria-label={i18n.t("settings.stages.name")}
                maxlength={MAX_STAGE_NAME_LENGTH}
                onchange={event => rename(stage.id, event.currentTarget, stage.name)}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <Button variant="ghost" size="icon-xs" tooltip={i18n.t("settings.lists.moveUp", [stage.name])} aria-label={i18n.t("settings.lists.moveUp", [stage.name])} disabled={index === 0} onclick={() => void store.moveStage(stage.id, -1)}>
                <ArrowUpIcon />
              </Button>
              <Button variant="ghost" size="icon-xs" tooltip={i18n.t("settings.lists.moveDown", [stage.name])} aria-label={i18n.t("settings.lists.moveDown", [stage.name])} disabled={index === stages.length - 1} onclick={() => void store.moveStage(stage.id, 1)}>
                <ArrowDownIcon />
              </Button>
              <Button variant="ghost" size="icon-xs" class="hover:text-destructive" tooltip={i18n.t("settings.stages.delete", [stage.name])} aria-label={i18n.t("settings.stages.delete", [stage.name])} onclick={() => void store.deleteStage(stage.id)}>
                <TrashIcon />
              </Button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if stages.length < MAX_STAGES_PER_STATUS}
        <form class="flex gap-1.5 pl-3" onsubmit={event => void add(event, status)}>
          <input
            class={fieldClass}
            bind:value={names[status]}
            placeholder={i18n.t("settings.stages.placeholder")}
            aria-label={i18n.t("settings.stages.add", [statusLabel(status)])}
            maxlength={MAX_STAGE_NAME_LENGTH}
          />
          <Button type="submit" variant="outline" size="sm" disabled={names[status].trim().length === 0} aria-label={i18n.t("settings.stages.add", [statusLabel(status)])}>
            <PlusIcon />{i18n.t("settings.stages.addShort")}
          </Button>
        </form>
      {/if}
    </section>
  {/each}
</div>
<p class="mt-2 text-xs font-semibold text-muted-foreground">{i18n.t("settings.stages.deleteHint")}</p>
