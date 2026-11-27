<script lang="ts" module>
  import type { TStatus } from "@/lib/todos/status";

  import CircleIcon from "@lucide/svelte/icons/circle";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import { i18n } from "#i18n";


  /** Each status's icon: an empty circle, one under way, and one checked. */
  export const STATUS_ICONS = { todo: CircleIcon, doing: CircleDashedIcon, done: CircleCheckIcon } as const;

  /**
   * A status's name.
   *
   * @param status The status.
   * @returns "To do", "In progress" or "Done".
   */
  export function statusLabel(status: TStatus): string {
    return { todo: () => i18n.t("status.todo"), doing: () => i18n.t("status.doing"), done: () => i18n.t("status.done") }[status]();
  }
</script>

<script lang="ts">
  import type { TStage } from "@/lib/todos/status";

  import * as DropdownMenu from "@/lib/components/ui/dropdown-menu";
  import { stagesUnder, STATUSES } from "@/lib/todos/status";



  type Props = {
    /** Where the to-do stands now. */
    status: TStatus;
    /** The stage of one's own it's at, if any. */
    stage: TStage | null;
    /** Every stage of one's own. */
    stages: ReadonlyArray<TStage>;
    onstatus: (status: TStatus, stage: TStage | null) => void;
  };

  const { status, stage, stages, onstatus }: Props = $props();

  // One value per choice: a status, or a stage under it.
  const value = $derived(stage === null ? status : `${status}:${stage.id}`);

  function choose(chosen: string): void {
    const [picked, id] = chosen.split(":") as [TStatus, string | undefined];

    onstatus(picked, stages.find(entry => entry.id === id) ?? null);
  }
</script>

<!-- The three statuses, each with its stages of one's own under it, in a menu. -->
<DropdownMenu.RadioGroup {value} onValueChange={choose}>
  {#each STATUSES as main (main)}
    {@const Icon = STATUS_ICONS[main]}
    <DropdownMenu.RadioItem value={main} closeOnSelect data-status={main}>
      <Icon />
      {statusLabel(main)}
    </DropdownMenu.RadioItem>
    {#each stagesUnder(stages, main) as entry (entry.id)}
      <DropdownMenu.RadioItem value="{main}:{entry.id}" closeOnSelect class="pl-7 font-semibold" data-stage={entry.id}>
        {entry.name}
      </DropdownMenu.RadioItem>
    {/each}
  {/each}
</DropdownMenu.RadioGroup>
