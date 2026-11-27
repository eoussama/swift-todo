<script lang="ts" module>
  import type { TSort } from "@/lib/todos/sort";

  import ArrowDownAZIcon from "@lucide/svelte/icons/arrow-down-a-z";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ClockArrowDownIcon from "@lucide/svelte/icons/clock-arrow-down";
  import ClockArrowUpIcon from "@lucide/svelte/icons/clock-arrow-up";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import { i18n } from "#i18n";


  /** Each sort, with its icon. */
  export const SORT_ICONS = {
    manual: GripVerticalIcon,
    newest: ClockArrowDownIcon,
    oldest: ClockArrowUpIcon,
    due: CalendarIcon,
    alpha: ArrowDownAZIcon,
  } as const satisfies Record<TSort, unknown>;

  /**
   * A sort's name, for menus and the tab.
   *
   * @param sort The sort.
   * @returns "My order", "Due date"…
   */
  export function sortLabel(sort: TSort): string {
    return {
      manual: () => i18n.t("lists.sort.manual"),
      newest: () => i18n.t("lists.sort.newest"),
      oldest: () => i18n.t("lists.sort.oldest"),
      due: () => i18n.t("lists.sort.due"),
      alpha: () => i18n.t("lists.sort.alpha"),
    }[sort]();
  }
</script>

<script lang="ts">
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";

  import * as DropdownMenu from "@/lib/components/ui/dropdown-menu";
  import { SORTS } from "@/lib/todos/sort";

  import { SubMenu } from "./sub-menu.svelte";



  type Props = {
    sort: TSort;
    onsort: (sort: TSort) => void;
  };

  const { sort, onsort }: Props = $props();

  const sub = new SubMenu();

  $effect(() => () => sub.dispose());
</script>

<!-- "Sort by" and its choices, in a tab's right-click menu or its own menu (both are the same kind of menu). -->
<DropdownMenu.Sub bind:open={sub.open}>
  <DropdownMenu.SubTrigger {...sub.trigger}>
    <ArrowUpDownIcon />
    <span class="flex min-w-0 flex-1 items-center justify-between gap-3">
      {i18n.t("lists.menu.sort")}
      <span class="truncate text-xs font-semibold text-muted-foreground">{sortLabel(sort)}</span>
    </span>
  </DropdownMenu.SubTrigger>
  <DropdownMenu.SubContent {...sub.content}>
    <DropdownMenu.RadioGroup value={sort} onValueChange={value => onsort(value as TSort)}>
      {#each SORTS as option (option)}
        {@const Icon = SORT_ICONS[option]}
        <DropdownMenu.RadioItem value={option} closeOnSelect>
          <Icon />
          {sortLabel(option)}
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.SubContent>
</DropdownMenu.Sub>
