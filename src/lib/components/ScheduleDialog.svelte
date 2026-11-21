<script lang="ts">
  import type { DateValue } from "@internationalized/date";
  import type { TTodo } from "@/lib/todos/model";

  import { parseDate } from "@internationalized/date";
  import { i18n } from "#i18n";

  import { Button } from "@/lib/components/ui/button";
  import { Calendar } from "@/lib/components/ui/calendar";
  import * as Dialog from "@/lib/components/ui/dialog";
  import { Switch } from "@/lib/components/ui/switch";
  import { truncate } from "@/lib/messages";
  import { addDays, parseDue, toDateString } from "@/lib/time/date";
  import { shownText } from "@/lib/todos/model";



  type Props = {
    open: boolean;
    todo: TTodo | null;
    /** Saves the new due value, or `null` to remove the date. */
    onsave: (due: string | null) => void;
  };

  let { open = $bindable(false), todo, onsave }: Props = $props();

  let date = $state<DateValue | undefined>(undefined);
  let withTime = $state(false);
  let time = $state("09:00");

  // Start from the to-do's current date each time the dialog opens.
  $effect.pre(() => {
    if (!open || todo === null) {
      return;
    }

    if (todo.due === null) {
      date = parseDate(toDateString(new Date()));
      withTime = false;
      time = "09:00";
    }
    else {
      const [day = "", clock] = todo.due.split("T");

      date = parseDate(day);
      withTime = clock !== undefined;
      time = clock ?? "09:00";
    }
  });

  const locale = navigator.language;

  function quick(days: number): void {
    date = parseDate(toDateString(addDays(new Date(), days)));
  }

  function save(): void {
    if (date === undefined) {
      return;
    }

    onsave(withTime && /^\d{2}:\d{2}$/.test(time) ? `${date.toString()}T${time}` : date.toString());
    open = false;
  }

  function clear(): void {
    onsave(null);
    open = false;
  }

  const current = $derived(todo?.due === null || todo === null ? null : parseDue(todo.due));
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="w-[340px] gap-3 bg-sheet p-3" showCloseButton={false}>
    <Dialog.Header class="gap-1 text-left">
      <Dialog.Title class="font-hand text-[26px] leading-none font-bold">{i18n.t("schedule.title")}</Dialog.Title>
      <Dialog.Description class="text-[13px] font-semibold text-muted-foreground">
        {i18n.t("schedule.description", [truncate(todo === null ? "" : shownText(todo, i18n.t("item.hidden")), 36)])}
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid grid-cols-3 gap-1.5">
      <Button variant="outline" size="sm" onclick={() => quick(0)}>{i18n.t("schedule.today")}</Button>
      <Button variant="outline" size="sm" onclick={() => quick(1)}>{i18n.t("schedule.tomorrow")}</Button>
      <Button variant="outline" size="sm" onclick={() => quick(7)}>{i18n.t("schedule.nextWeek")}</Button>
    </div>

    <!-- The week's seven days spread across the whole box. -->
    <Calendar type="single" bind:value={date} {locale} class="w-full rounded-md border-2 border-border p-2 [--cell-size:2rem] [&_tr]:justify-between" />

    <div class="flex items-center gap-2">
      <Switch id="schedule-with-time" bind:checked={withTime} />
      <label for="schedule-with-time" class="cursor-pointer text-[13px] font-bold">{i18n.t("schedule.addTime")}</label>
      {#if withTime}
        <input
          type="time"
          bind:value={time}
          aria-label={i18n.t("schedule.time")}
          class="ml-auto h-8 rounded-md border-2 border-border bg-sheet px-2 text-sm font-bold outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_75%,transparent)]"
        />
      {/if}
    </div>

    <!-- Sized to this dialog's padding, so the band lines up with the edges. -->
    <Dialog.Footer class="-mx-3 -mb-3 flex-row justify-between gap-2 rounded-b-md p-3">
      {#if current !== null}
        <Button variant="destructive" size="sm" onclick={clear}>{i18n.t("schedule.clear")}</Button>
      {:else}
        <span></span>
      {/if}
      <div class="flex gap-2">
        <Button variant="ghost" size="sm" onclick={() => (open = false)}>{i18n.t("schedule.cancel")}</Button>
        <Button size="sm" disabled={date === undefined} onclick={save}>{i18n.t("schedule.save")}</Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
